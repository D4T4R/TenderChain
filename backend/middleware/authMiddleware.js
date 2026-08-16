const { verifyAccessToken } = require('../services/tokenService');
const sessions = require('../services/sessionService');
const { HttpError } = require('./errorMiddleware');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Authentication and authorisation.
 *
 * A request is authenticated in two steps: the JWT signature proves identity
 * with no I/O, then the session in Redis supplies capabilities and the current
 * revocation state. Splitting it this way is what allows a session to be
 * revoked instantly, and to gain the ability to transact mid-life without
 * being reissued.
 */

const { CAPABILITIES } = sessions;

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifies the token and loads its session.
 *
 * Fails closed when Redis is unreachable: without the session we cannot tell a
 * live session from a revoked one, and serving the request anyway would mean
 * honouring sessions that were signed out.
 */
async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Access token has expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new HttpError(401, 'Invalid access token'));
    }
    // A configuration failure (missing/placeholder JWT_SECRET) is ours, not the
    // caller's, so it must not be reported as a 401.
    return next(error);
  }

  // Tokens issued before sessions existed carry no sid. Rejecting them means a
  // deploy signs everyone out once, rather than leaving unrevokable tokens in
  // circulation for their remaining lifetime.
  if (!payload.sid) {
    return next(
      new HttpError(401, 'Session is no longer valid; please sign in again')
    );
  }

  let session;
  try {
    session = await sessions.getSession(payload.sid);
  } catch (error) {
    if (error.code === 'REDIS_UNAVAILABLE') {
      logger.error('Refusing request: session store unavailable');
      return next(
        new HttpError(503, 'Session store is unavailable; please retry shortly')
      );
    }
    return next(error);
  }

  if (!session) {
    return next(
      new HttpError(401, 'Session has expired or been signed out')
    );
  }

  req.auth = {
    userId: session.userId,
    role: session.role,
    sid: session.sid,
    walletAddress: session.walletAddress,
    hasWallet: Boolean(session.walletAddress),
    capabilities: session.capabilities,
    method: session.method,
  };
  req.session = session;

  // Best effort; liveness tracking must not fail a request.
  void sessions.touchSession(session).catch(() => {});

  return next();
}

/**
 * Attaches req.auth when a valid session is present, but allows the request
 * through otherwise. For endpoints that expose more detail to signed-in users.
 */
async function optionalAuth(req, res, next) {
  if (!extractBearerToken(req)) return next();
  return requireAuth(req, res, () => next());
}

/**
 * Loads the full user document onto req.user, for handlers that need more than
 * the session's claims.
 */
async function loadUser(req, res, next) {
  if (!req.auth) return next(new HttpError(401, 'Authentication required'));

  try {
    const user = await User.findById(req.auth.userId);
    if (!user) return next(new HttpError(401, 'User no longer exists'));
    if (!user.isActive) return next(new HttpError(403, 'Account is not active'));

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Restricts a route to the given application roles (User.userType). */
function requireRole(...roles) {
  const allowed = roles.flat();

  return (req, res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Authentication required'));

    if (!allowed.includes(req.auth.role)) {
      logger.warn(
        `Role check failed: ${req.auth.userId} (${req.auth.role}) attempted ` +
          `${req.method} ${req.originalUrl}, requires ${allowed.join('/')}`
      );
      return next(new HttpError(403, 'Insufficient permissions'));
    }

    return next();
  };
}

/**
 * Requires a capability on the session.
 *
 * The refusal distinguishes "you need to prove a wallet" from "you are not
 * allowed", because the first is fixed by signing and the second is not — and
 * a client that cannot tell them apart cannot prompt correctly.
 */
function requireCapability(capability) {
  return (req, res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Authentication required'));

    if (req.auth.capabilities?.includes(capability)) return next();

    if (capability === CAPABILITIES.WRITE_ONCHAIN) {
      return next(
        new HttpError(
          403,
          'This action needs a wallet. Connect one and sign to continue.',
          {
            reason: req.auth.hasWallet
              ? 'wallet_proof_stale'
              : 'wallet_required',
            stepUpUrl: '/api/auth/step-up',
          }
        )
      );
    }

    return next(
      new HttpError(403, `This session lacks the '${capability}' capability`, {
        reason: 'capability_required',
        capability,
      })
    );
  };
}

/**
 * Checks a role against the on-chain registries.
 *
 * The API must not grant authority the contracts would reject: a user marked
 * 'verifier' in MongoDB is meaningless if the registry has not granted them
 * VERIFIER_ROLE.
 */
function requireOnChainRole(contractName, roleName) {
  return async (req, res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Authentication required'));

    // Capability first: a session that cannot transact should be told to step
    // up rather than have its (possibly stale) wallet checked on chain.
    if (!req.auth.capabilities?.includes(CAPABILITIES.WRITE_ONCHAIN)) {
      return requireCapability(CAPABILITIES.WRITE_ONCHAIN)(req, res, next);
    }

    try {
      // Required lazily so routes not using this do not force an RPC
      // connection at import time.
      const chain = require('../services/chainService');

      const hasRole = await chain.hasRole(
        contractName,
        roleName,
        req.auth.walletAddress
      );

      if (!hasRole) {
        return next(
          new HttpError(
            403,
            `Wallet ${req.auth.walletAddress} does not hold ${roleName} on ${contractName}`,
            { reason: 'role_not_granted', role: roleName }
          )
        );
      }

      return next();
    } catch (error) {
      // Do not fail open: if the chain cannot be reached we cannot prove
      // authority, so the request is refused.
      logger.error(`On-chain role check failed for ${roleName}:`, error);
      return next(
        new HttpError(503, 'Unable to verify on-chain permissions right now')
      );
    }
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  loadUser,
  requireRole,
  requireCapability,
  requireOnChainRole,
  extractBearerToken,
  CAPABILITIES,
};
