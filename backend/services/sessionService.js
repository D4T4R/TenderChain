const crypto = require('crypto');
const { getRedis, key } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Server-side sessions, held in Redis.
 *
 * The access token stays a JWT, but carries a session id rather than being the
 * whole truth. Every request verifies the signature (no I/O) and then loads the
 * session (one Redis read). That buys two things a bare JWT cannot do:
 *
 *   - instant revocation, instead of waiting out the token's lifetime;
 *   - capability upgrade mid-session, so proving a wallet raises an existing
 *     session rather than forcing a new sign-in.
 *
 * The second is the whole reason this comes before the wallet step-up work.
 */

/* ------------------------------------------------------------ capabilities */

const CAPABILITIES = {
  /** Read anything the role permits: dashboards, reports, downloads. */
  READ: 'read',
  /** Mutate application state that never touches the chain. */
  WRITE_OFFCHAIN: 'write:offchain',
  /** Submit transactions. Requires a wallet proven on this session. */
  WRITE_ONCHAIN: 'write:onchain',
};

/**
 * Capabilities granted by each sign-in method.
 *
 * A password sign-in deliberately reaches write:offchain — editing a profile or
 * uploading a document should not require a wallet, which is the whole point of
 * decoupling identity from the key.
 */
const PASSWORD_CAPABILITIES = [CAPABILITIES.READ, CAPABILITIES.WRITE_OFFCHAIN];
const WALLET_CAPABILITIES = [
  CAPABILITIES.READ,
  CAPABILITIES.WRITE_OFFCHAIN,
  CAPABILITIES.WRITE_ONCHAIN,
];

const SESSION_TTL_SECONDS = Number(
  process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 30
);

/**
 * How long a wallet proof keeps its on-chain capability before it must be
 * re-proven. Short on purpose: the ability to move value should not persist for
 * the whole life of a month-long session just because a wallet was signed once.
 */
const ONCHAIN_CAPABILITY_TTL_SECONDS = Number(
  process.env.ONCHAIN_CAPABILITY_TTL_SECONDS || 15 * 60
);

function sessionKey(sid) {
  return key('session', sid);
}

function userSessionsKey(userId) {
  return key('user-sessions', String(userId));
}

/* ------------------------------------------------------------- operations */

async function createSession({
  user,
  method,
  walletAddress = null,
  context = {},
}) {
  const redis = getRedis();
  const sid = crypto.randomUUID();

  const capabilities =
    method === 'wallet' ? [...WALLET_CAPABILITIES] : [...PASSWORD_CAPABILITIES];

  const now = Date.now();
  const session = {
    sid,
    userId: user._id.toString(),
    role: user.userType,
    method,
    walletAddress: walletAddress ? walletAddress.toLowerCase() : null,
    capabilities,
    // Only meaningful when write:onchain is held; used to expire it.
    walletProvenAt: method === 'wallet' ? now : null,
    createdAt: now,
    lastSeenAt: now,
    userAgent: context.userAgent ?? null,
    ipAddress: context.ipAddress ?? null,
  };

  await redis
    .multi()
    .set(sessionKey(sid), JSON.stringify(session), { EX: SESSION_TTL_SECONDS })
    // Index by user so "sign out everywhere" does not need a key scan.
    .sAdd(userSessionsKey(user._id), sid)
    .expire(userSessionsKey(user._id), SESSION_TTL_SECONDS)
    .exec();

  return session;
}

/**
 * Loads a session and applies time-based capability decay.
 *
 * write:onchain is dropped once the wallet proof goes stale, so an old session
 * silently loses the ability to transact rather than keeping it for weeks.
 */
async function getSession(sid) {
  if (!sid) return null;

  const redis = getRedis();
  const raw = await redis.get(sessionKey(sid));
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    logger.error(`Session ${sid} held unparseable data; discarding`);
    await redis.del(sessionKey(sid));
    return null;
  }

  if (
    session.capabilities.includes(CAPABILITIES.WRITE_ONCHAIN) &&
    isWalletProofStale(session)
  ) {
    session.capabilities = session.capabilities.filter(
      (c) => c !== CAPABILITIES.WRITE_ONCHAIN
    );
    session.walletProvenAt = null;
    await redis.set(sessionKey(sid), JSON.stringify(session), {
      KEEPTTL: true,
    });
  }

  return session;
}

function isWalletProofStale(session) {
  if (!session.walletProvenAt) return true;
  const age = (Date.now() - session.walletProvenAt) / 1000;
  return age > ONCHAIN_CAPABILITY_TTL_SECONDS;
}

/**
 * Raises an existing session to write:onchain after a wallet proof.
 *
 * The session keeps its identity and history; only its capability changes.
 * This is what a stateless JWT cannot express without reissuing everything.
 */
async function grantOnChainCapability(sid, walletAddress) {
  const redis = getRedis();
  const session = await getSession(sid);
  if (!session) return null;

  session.walletAddress = walletAddress.toLowerCase();
  session.walletProvenAt = Date.now();
  if (!session.capabilities.includes(CAPABILITIES.WRITE_ONCHAIN)) {
    session.capabilities.push(CAPABILITIES.WRITE_ONCHAIN);
  }

  await redis.set(sessionKey(sid), JSON.stringify(session), { KEEPTTL: true });
  return session;
}

/** Records liveness. Throttled, since it runs on every authenticated request. */
async function touchSession(session) {
  const THROTTLE_MS = 60 * 1000;
  if (Date.now() - session.lastSeenAt < THROTTLE_MS) return;

  const redis = getRedis();
  session.lastSeenAt = Date.now();
  await redis.set(sessionKey(session.sid), JSON.stringify(session), {
    KEEPTTL: true,
  });
}

async function revokeSession(sid) {
  const redis = getRedis();
  const session = await getSession(sid);

  await redis.del(sessionKey(sid));
  if (session) await redis.sRem(userSessionsKey(session.userId), sid);

  return Boolean(session);
}

async function revokeAllForUser(userId) {
  const redis = getRedis();
  const sids = await redis.sMembers(userSessionsKey(userId));
  if (sids.length === 0) return 0;

  await redis.del(sids.map(sessionKey));
  await redis.del(userSessionsKey(userId));
  return sids.length;
}

async function listSessionsForUser(userId) {
  const redis = getRedis();
  const sids = await redis.sMembers(userSessionsKey(userId));

  const sessions = await Promise.all(sids.map((sid) => getSession(sid)));
  const live = sessions.filter(Boolean);

  // Prune index entries whose session has expired out from under it.
  const stale = sids.filter((sid) => !live.some((s) => s.sid === sid));
  if (stale.length) await redis.sRem(userSessionsKey(userId), stale);

  return live;
}

/**
 * Reflects a role change onto every live session for that user, so a
 * demotion takes effect immediately rather than at next sign-in.
 */
async function updateRoleForUser(userId, role) {
  const redis = getRedis();
  const sessions = await listSessionsForUser(userId);

  await Promise.all(
    sessions.map((session) => {
      session.role = role;
      return redis.set(sessionKey(session.sid), JSON.stringify(session), {
        KEEPTTL: true,
      });
    })
  );

  return sessions.length;
}

function hasCapability(session, capability) {
  return Boolean(session?.capabilities?.includes(capability));
}

module.exports = {
  CAPABILITIES,
  PASSWORD_CAPABILITIES,
  WALLET_CAPABILITIES,
  SESSION_TTL_SECONDS,
  ONCHAIN_CAPABILITY_TTL_SECONDS,
  createSession,
  getSession,
  grantOnChainCapability,
  touchSession,
  revokeSession,
  revokeAllForUser,
  listSessionsForUser,
  updateRoleForUser,
  hasCapability,
  isWalletProofStale,
};
