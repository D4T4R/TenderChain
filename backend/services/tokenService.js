const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');

/**
 * Access and refresh token issuance.
 *
 * Access tokens are short-lived JWTs carrying the user id, wallet address and
 * role. Refresh tokens are opaque random strings; only their hash is stored.
 *
 * The previous configuration shipped JWT_EXPIRE=7d, which as a single-token
 * scheme means a stolen token is usable for a week with no way to revoke it.
 * Here the access token is minutes-long and revocation happens at the refresh
 * layer, which is stateful.
 */

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRE || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.JWT_REFRESH_EXPIRE_DAYS || 30);

const ISSUER = process.env.JWT_ISSUER || 'tenderchain';
const AUDIENCE = process.env.JWT_AUDIENCE || 'tenderchain-api';

const INSECURE_SECRETS = new Set([
  'your_super_secret_jwt_key_here',
  'secret',
  'changeme',
]);

/**
 * Reads the signing secret, refusing to run with the placeholder value.
 * Resolved per call rather than at module load so tests can set it up.
 */
function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not set; refusing to issue tokens');
  }
  if (INSECURE_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET is still the example placeholder; set a real secret'
    );
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  return secret;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      wallet: user.walletAddress,
      role: user.userType,
    },
    getSecret(),
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

function verifyAccessToken(token) {
  // Algorithm is pinned. Without this, a token with alg:none or an algorithm
  // confusion attack could be accepted.
  return jwt.verify(token, getSecret(), {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

function refreshExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Issues a new refresh token, optionally continuing an existing family.
 */
async function issueRefreshToken(user, { family, context = {} } = {}) {
  const token = crypto.randomBytes(48).toString('base64url');

  await RefreshToken.create({
    tokenHash: hashToken(token),
    user: user._id,
    walletAddress: user.walletAddress,
    family: family || crypto.randomUUID(),
    expiresAt: refreshExpiryDate(),
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  return token;
}

async function issueTokenPair(user, context) {
  const [accessToken, refreshToken] = await Promise.all([
    Promise.resolve(signAccessToken(user)),
    issueRefreshToken(user, { context }),
  ]);

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
}

/**
 * Revokes every live token in a family. Used when reuse is detected.
 */
async function revokeFamily(family, reason) {
  const result = await RefreshToken.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  logger.warn(
    `Revoked refresh token family ${family} (${result.modifiedCount} tokens): ${reason}`
  );
}

class TokenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenError';
    this.statusCode = 401;
  }
}

/**
 * Rotates a refresh token.
 *
 * Presenting a token that has already been rotated means either the client
 * replayed it or it was stolen. Either way the whole family is revoked, which
 * logs out the attacker and the legitimate user, who can sign in again.
 */
async function rotateRefreshToken(presentedToken, context = {}) {
  const tokenHash = hashToken(presentedToken);

  const record = await RefreshToken.findOne({ tokenHash }).populate('user');

  if (!record) {
    throw new TokenError('Invalid refresh token');
  }

  if (record.replacedByHash) {
    await revokeFamily(record.family, 'refresh token reuse detected');
    throw new TokenError('Refresh token has already been used');
  }

  if (record.revokedAt) {
    throw new TokenError('Refresh token has been revoked');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new TokenError('Refresh token has expired');
  }

  if (!record.user) {
    throw new TokenError('User no longer exists');
  }

  if (record.user.isActive === false) {
    await revokeFamily(record.family, 'user deactivated');
    throw new TokenError('Account is not active');
  }

  const nextToken = await issueRefreshToken(record.user, {
    family: record.family,
    context,
  });

  record.replacedByHash = hashToken(nextToken);
  record.revokedAt = new Date();
  await record.save();

  return {
    accessToken: signAccessToken(record.user),
    refreshToken: nextToken,
    expiresIn: ACCESS_TOKEN_TTL,
    user: record.user,
  };
}

async function revokeRefreshToken(presentedToken) {
  const record = await RefreshToken.findOne({ tokenHash: hashToken(presentedToken) });
  if (!record || record.revokedAt) return false;

  record.revokedAt = new Date();
  await record.save();
  return true;
}

async function revokeAllForUser(userId) {
  const result = await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  revokeFamily,
  hashToken,
  TokenError,
  ACCESS_TOKEN_TTL,
};
