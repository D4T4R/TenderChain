const { verifyAccessToken } = require('../services/tokenService');
const { HttpError } = require('./errorMiddleware');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Authentication and authorisation middleware.
 *
 * Prior to this the API had no auth layer at all: jsonwebtoken was a
 * dependency that nothing imported, and every route was reachable
 * unauthenticated.
 */

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifies the access token and attaches req.auth.
 * Does not hit the database - the JWT claims are enough for authorisation.
 */
function requireAuth(req, res, next) {
  const token = extractBearerToken(req);

  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.sub,
      // Null for a password-only session; a session is not required to have a
      // wallet bound to it.
      walletAddress: payload.wallet || null,
      role: payload.role,
      hasWallet: Boolean(payload.wallet),
    };
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'Access token has expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new HttpError(401, 'Invalid access token'));
    }
    // A configuration failure (missing/placeholder JWT_SECRET) is ours, not
    // the caller's, so it must not be reported as a 401.
    return next(error);
  }
}

/**
 * Attaches req.auth when a valid token is present, but allows the request
 * through otherwise. For endpoints that expose more detail to signed-in users.
 */
function optionalAuth(req, res, next) {
  if (!extractBearerToken(req)) return next();
  return requireAuth(req, res, (err) => (err ? next() : next()));
}

/**
 * Loads the full user document onto req.user. Use where the handler needs more
 * than the token claims, or where an account may have been deactivated since
 * the token was issued.
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

/**
 * Restricts a route to the given application roles (User.userType).
 */
function requireRole(...roles) {
  const allowed = roles.flat();

  return (req, res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Authentication required'));

    if (!allowed.includes(req.auth.role)) {
      logger.warn(
        `Role check failed: ${req.auth.walletAddress} (${req.auth.role}) ` +
          `attempted ${req.method} ${req.originalUrl}, requires ${allowed.join('/')}`
      );
      return next(new HttpError(403, 'Insufficient permissions'));
    }

    return next();
  };
}

/**
 * Checks a role against the on-chain registries.
 *
 * The API must not grant authority the contracts would reject: a user marked
 * 'verifier' in MongoDB is meaningless if the registry has not granted them
 * VERIFIER_ROLE. This keeps the database from becoming a second, weaker source
 * of truth.
 *
 * @param {string} contractName key into the chain service's contract map
 * @param {string} roleName     e.g. 'VERIFIER_ROLE'
 */
function requireOnChainRole(contractName, roleName) {
  return async (req, res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Authentication required'));

    // A session with no proven wallet cannot act on chain. This is a distinct
    // condition from "wallet lacks the role", and the client needs to tell them
    // apart: one is fixed by connecting and signing, the other by an admin
    // granting the role.
    if (!req.auth.walletAddress) {
      return next(
        new HttpError(
          403,
          'This action requires a proven wallet. Connect a wallet and sign in with it to continue.',
          { reason: 'wallet_required' }
        )
      );
    }

    try {
      // Required lazily so that routes not using this middleware do not force
      // an RPC connection at import time.
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
            `Wallet ${req.auth.walletAddress} does not hold ${roleName} on ${contractName}`
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
  requireOnChainRole,
  extractBearerToken,
};
