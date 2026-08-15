const express = require('express');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const siwe = require('../services/siweService');
const tokens = require('../services/tokenService');
const { requireAuth, loadUser } = require('../middleware/authMiddleware');
const { HttpError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Wallet authentication via Sign-In With Ethereum (EIP-4361).
 *
 *   POST /api/auth/nonce    request a single-use nonce
 *   POST /api/auth/verify   exchange a signed message for tokens
 *   POST /api/auth/refresh  rotate the refresh token
 *   POST /api/auth/logout   revoke the presented refresh token
 *   GET  /api/auth/me       current user
 */

// Tighter limits than the global API limiter: these endpoints are the
// brute-force surface.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts' },
});

function requestContext(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'auth' });
});

/**
 * Step 1: issue a nonce for the address the client intends to sign with.
 */
router.post(
  '/nonce',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { walletAddress } = req.body || {};
    const payload = await siwe.createNonce(walletAddress);
    res.json({ success: true, ...payload });
  })
);

/**
 * Step 2: verify the signed message and issue tokens.
 *
 * A user record is created on first successful sign-in. userType is only
 * honoured at creation and defaults to 'contractor'; a client cannot change
 * its own role on a later sign-in.
 */
router.post(
  '/verify',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { message, signature, profile } = req.body || {};

    const walletAddress = await siwe.verifySignature({ message, signature });

    let user = await User.findByWallet(walletAddress);
    let created = false;

    if (!user) {
      if (!profile?.email || !profile?.phoneNumber || !profile?.fullName) {
        throw new HttpError(
          400,
          'First sign-in requires profile.email, profile.phoneNumber and profile.fullName'
        );
      }

      user = await User.create({
        walletAddress,
        userType: profile.userType || 'contractor',
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        fullName: profile.fullName,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          registrationSource: 'siwe',
        },
      });
      created = true;
      logger.info(`New user registered via SIWE: ${walletAddress}`);
    }

    if (!user.isActive) {
      throw new HttpError(403, 'Account is not active');
    }

    const pair = await tokens.issueTokenPair(user, requestContext(req));
    await user.updateLastLogin();

    res.status(created ? 201 : 200).json({
      success: true,
      created,
      user: user.toJSON(),
      ...pair,
    });
  })
);

/**
 * Step 3: rotate. The presented token is invalidated and replaced.
 */
router.post(
  '/refresh',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw new HttpError(400, 'refreshToken is required');

    const result = await tokens.rotateRefreshToken(
      refreshToken,
      requestContext(req)
    );

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: result.user.toJSON(),
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken, allSessions } = req.body || {};

    if (allSessions) {
      // Requires a valid access token to know whose sessions to end.
      return requireAuth(req, res, async (err) => {
        if (err) return res.status(401).json({ success: false, error: 'Authentication required' });
        const count = await tokens.revokeAllForUser(req.auth.userId);
        return res.json({ success: true, revoked: count });
      });
    }

    if (!refreshToken) throw new HttpError(400, 'refreshToken is required');

    const revoked = await tokens.revokeRefreshToken(refreshToken);
    return res.json({ success: true, revoked: revoked ? 1 : 0 });
  })
);

router.get(
  '/me',
  requireAuth,
  loadUser,
  asyncHandler(async (req, res) => {
    res.json({ success: true, user: req.user.toJSON() });
  })
);

module.exports = router;
