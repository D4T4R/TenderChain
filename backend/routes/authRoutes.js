const crypto = require('crypto');
const express = require('express');

const User = require('../models/User');
const LinkedWallet = require('../models/LinkedWallet');
const PasswordResetToken = require('../models/PasswordResetToken');
const siwe = require('../services/siweService');
const tokens = require('../services/tokenService');
const passwords = require('../services/passwordService');
const mail = require('../services/mailService');
const sessions = require('../services/sessionService');
const { rateLimiter } = require('../config/rateLimit');
const { requireAuth, loadUser } = require('../middleware/authMiddleware');
const { HttpError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Authentication. Two entry paths, both issuing the same session type.
 *
 * Password (no wallet needed - read, reports, profile):
 *   POST /api/auth/register         create an account with a password
 *   POST /api/auth/login            email + password
 *   POST /api/auth/change-password  authenticated, requires current password
 *   POST /api/auth/forgot-password  request a reset link
 *   POST /api/auth/reset-password   consume a reset token
 *
 * Wallet (Sign-In With Ethereum, EIP-4361 - also grants on-chain capability):
 *   POST /api/auth/nonce            request a single-use nonce
 *   POST /api/auth/verify           exchange a signed message for tokens
 *
 * Shared:
 *   POST /api/auth/refresh          rotate the refresh token
 *   POST /api/auth/logout           revoke the presented refresh token
 *   GET  /api/auth/me               current user
 *
 * A password session carries no wallet claim, so on-chain actions are refused
 * with reason 'wallet_required' until the session is stepped up (2c).
 */

const RESET_TOKEN_TTL_MINUTES = Number(
  process.env.PASSWORD_RESET_TTL_MINUTES || 30
);

/**
 * Tighter limits than the global API limiter: these endpoints are the
 * brute-force surface.
 *
 * Built lazily for the same reason as the API limiter - at module load Redis
 * has not connected yet, and the limiter would quietly bind the in-memory
 * store instead of the shared one.
 */
let limiter;
const authLimiter = (req, res, next) => {
  if (!limiter) {
    limiter = rateLimiter({
      name: 'auth',
      windowMs: 15 * 60 * 1000,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
      message: { success: false, error: 'Too many authentication attempts' },
    });
  }
  return limiter(req, res, next);
};

function requestContext(req) {
  return {
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
  };
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Register with a password. No wallet involved.
 */
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, phoneNumber, fullName, userType } = req.body || {};

    if (!email || !phoneNumber || !fullName) {
      throw new HttpError(400, 'email, phoneNumber and fullName are required');
    }

    passwords.assertPolicy(password, { email, fullName });

    const normalisedEmail = String(email).toLowerCase().trim();

    // Privileged roles are never self-assignable at registration. An admin
    // promotes an account afterwards, and on-chain authority is separate again.
    const SELF_ASSIGNABLE = new Set(['contractor', 'public_verifier']);
    const requestedType = userType || 'contractor';
    if (!SELF_ASSIGNABLE.has(requestedType)) {
      throw new HttpError(
        403,
        `Cannot self-assign the '${requestedType}' role; an administrator must grant it`
      );
    }

    const passwordHash = await passwords.hash(password);

    let user;
    try {
      user = await User.create({
        userType: requestedType,
        email: normalisedEmail,
        phoneNumber,
        fullName,
        passwordHash,
        passwordUpdatedAt: new Date(),
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          registrationSource: 'password',
        },
      });
    } catch (error) {
      // The unique index on email surfaces as 11000. Answer the same way as a
      // success would look to a scraper is not possible here (the caller needs
      // to know), so return a 409 and rely on the rate limiter.
      if (error.code === 11000) {
        throw new HttpError(409, 'An account with that email already exists');
      }
      throw error;
    }

    // No wallet: read and off-chain writes only, until stepped up.
    const session = await sessions.createSession({
      user,
      method: 'password',
      context: requestContext(req),
    });
    const pair = await tokens.issueTokenPair(user, requestContext(req), {
      sid: session.sid,
    });
    await user.updateLastLogin();

    logger.info(`New user registered with password: ${normalisedEmail}`);

    res.status(201).json({
      success: true,
      created: true,
      user: user.toJSON(),
      wallets: [],
      ...pair,
    });
  })
);

/**
 * Password login.
 *
 * Every failure returns the same message and spends the same bcrypt work,
 * whether the account is missing, has no password, or the password is wrong.
 * Anything else is an account-enumeration oracle.
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      throw new HttpError(400, 'email and password are required');
    }

    const user = await User.findByEmailWithSecrets(email);

    // Runs bcrypt against a dummy hash when there is no user or no password,
    // so the response time does not reveal which.
    const ok = await passwords.verify(password, user?.passwordHash);

    const GENERIC = 'Invalid email or password';

    if (!user || !ok) {
      if (user) await user.registerFailedLogin();
      throw new HttpError(401, GENERIC);
    }

    if (user.isLocked()) {
      // Distinct message: the credentials were right, so this leaks nothing a
      // successful login would not, and the user needs to know to wait.
      throw new HttpError(
        423,
        'Account is temporarily locked after repeated failed attempts. Try again later.'
      );
    }

    if (!user.isActive) {
      throw new HttpError(403, 'Account is not active');
    }

    await user.clearLoginFailures();

    const session = await sessions.createSession({
      user,
      method: 'password',
      context: requestContext(req),
    });
    const pair = await tokens.issueTokenPair(user, requestContext(req), {
      sid: session.sid,
    });
    await user.updateLastLogin();

    const wallets = await LinkedWallet.findActiveForUser(user._id);

    res.json({
      success: true,
      user: user.toJSON(),
      wallets: wallets.map((w) => ({
        address: w.address,
        isPrimary: w.isPrimary,
        label: w.label,
      })),
      ...pair,
    });
  })
);

/**
 * Change password while signed in. Requires the current one, so a stolen access
 * token alone cannot lock the owner out of their account.
 */
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    const user = await User.findById(req.auth.userId).select(
      '+passwordHash +failedLoginAttempts +lockedUntil'
    );
    if (!user) throw new HttpError(401, 'User no longer exists');

    if (user.hasPassword()) {
      const ok = await passwords.verify(currentPassword, user.passwordHash);
      if (!ok) throw new HttpError(401, 'Current password is incorrect');
    }
    // A SIWE-only account has no current password to prove; being signed in
    // with a proven wallet is the credential in that case.

    passwords.assertPolicy(newPassword, {
      email: user.email,
      fullName: user.fullName,
    });

    user.passwordHash = await passwords.hash(newPassword);
    user.passwordUpdatedAt = new Date();
    await user.save();

    // Changing a credential ends every other session; otherwise a thief keeps
    // their stolen session alive for the full refresh window.
    const revoked = await tokens.revokeAllForUser(user._id);
    await sessions.revokeAllForUser(user._id);

    const session = await sessions.createSession({
      user,
      method: 'password',
      context: requestContext(req),
    });
    const pair = await tokens.issueTokenPair(user, requestContext(req), {
      sid: session.sid,
    });

    res.json({ success: true, revokedSessions: revoked, ...pair });
  })
);

/**
 * Request a reset link.
 *
 * Always responds 202 with the same body, whether or not the address exists.
 * Confirming which emails have accounts is exactly the leak a login form is
 * usually careful to avoid.
 */
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    const ACCEPTED = {
      success: true,
      message:
        'If an account exists for that address, a reset link has been sent.',
    };

    if (!email) throw new HttpError(400, 'email is required');

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
    });

    if (!user || !user.isActive) return res.status(202).json(ACCEPTED);

    // Invalidate any outstanding tokens so only the newest link works.
    await PasswordResetToken.updateMany(
      { user: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    const token = crypto.randomBytes(32).toString('base64url');

    await PasswordResetToken.create({
      tokenHash: hashResetToken(token),
      user: user._id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      requestedByIp: req.ip,
    });

    const base = process.env.FRONTEND_BASE_URL || 'http://localhost:3002';
    const resetUrl = `${base}/reset-password?token=${token}`;

    /**
     * Deliberately not awaited.
     *
     * Awaiting the send makes the response time depend on whether the account
     * exists: a real address pays the full SMTP handshake (measured at ~2100ms
     * against a failing server) while an unknown one returns in ~1ms. That is a
     * far louder enumeration oracle than the response body ever was, and it
     * also lets an attacker tie up server time by spraying addresses.
     *
     * Delivery failures are logged, never surfaced.
     */
    void mail
      .sendPasswordReset({
        to: user.email,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      })
      .catch((error) => {
        logger.error(`Failed to send password reset to ${user.email}:`, error);
      });

    return res.status(202).json(ACCEPTED);
  })
);

/**
 * Consume a reset token and set a new password.
 */
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token) throw new HttpError(400, 'token is required');

    // Atomic consume: two concurrent submissions of the same link cannot both
    // succeed.
    const record = await PasswordResetToken.findOneAndUpdate(
      {
        tokenHash: hashResetToken(token),
        usedAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { usedAt: new Date() } },
      { new: true }
    );

    if (!record) {
      throw new HttpError(400, 'Reset link is invalid, already used, or expired');
    }

    const user = await User.findById(record.user).select(
      '+passwordHash +failedLoginAttempts +lockedUntil'
    );
    if (!user) throw new HttpError(400, 'Reset link is no longer valid');

    passwords.assertPolicy(newPassword, {
      email: user.email,
      fullName: user.fullName,
    });

    user.passwordHash = await passwords.hash(newPassword);
    user.passwordUpdatedAt = new Date();
    // A successful reset clears a lockout: the legitimate owner has proven
    // control of the mailbox, and leaving them locked out helps nobody.
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    const revoked = await tokens.revokeAllForUser(user._id);
    await sessions.revokeAllForUser(user._id);

    res.json({
      success: true,
      revokedSessions: revoked,
      message: 'Password updated. Please sign in again.',
    });
  })
);

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

    // Resolves through LinkedWallet, so an account can hold several wallets.
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

    // Record the proof. Refreshes lastProvenAt on an existing link, which is
    // what step-up freshness will be measured against.
    await LinkedWallet.recordProof(user._id, walletAddress);

    // Signing in with a wallet binds it to the session, so this session can act
    // on chain without a separate step-up.
    const session = await sessions.createSession({
      user,
      method: 'wallet',
      walletAddress,
      context: requestContext(req),
    });
    const pair = await tokens.issueTokenPair(user, requestContext(req), {
      walletAddress,
      sid: session.sid,
    });
    await user.updateLastLogin();

    res.status(created ? 201 : 200).json({
      success: true,
      created,
      user: user.toJSON(),
      wallets: (await LinkedWallet.findActiveForUser(user._id)).map((w) => ({
        address: w.address,
        isPrimary: w.isPrimary,
        label: w.label,
        provenAt: w.provenAt,
      })),
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

/**
 * Raise an existing session to write:onchain by proving a wallet.
 *
 * The session keeps its identity, age and history; only its capability
 * changes. That is the point of holding sessions in Redis — a stateless token
 * would have to be reissued, which loses the distinction between "this user
 * signed in an hour ago and has now proven a wallet" and "this is a new
 * session".
 *
 * The proven wallet is also linked to the account, so a password user adopting
 * a wallet does not need a separate linking step.
 */
router.post(
  '/step-up',
  authLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const { message, signature } = req.body || {};

    const walletAddress = await siwe.verifySignature({ message, signature });

    // The wallet must belong to this account, or be unclaimed. Without this a
    // signed-in user could raise their session using somebody else's wallet.
    const existing = await LinkedWallet.findActiveByAddress(walletAddress);
    if (existing && existing.user.toString() !== req.auth.userId) {
      throw new HttpError(409, 'That wallet is linked to another account');
    }

    await LinkedWallet.recordProof(req.auth.userId, walletAddress);

    const session = await sessions.grantOnChainCapability(
      req.auth.sid,
      walletAddress
    );
    if (!session) throw new HttpError(401, 'Session is no longer valid');

    const user = await User.findById(req.auth.userId);

    // A fresh access token so the client immediately carries the new wallet
    // claim; the session id, and therefore the session, is unchanged.
    const accessToken = tokens.signAccessToken(user, {
      walletAddress,
      sid: session.sid,
    });

    logger.info(
      `Session ${session.sid} stepped up to on-chain capability with ${walletAddress}`
    );

    res.json({
      success: true,
      accessToken,
      expiresIn: tokens.ACCESS_TOKEN_TTL,
      walletAddress,
      capabilities: session.capabilities,
      expiresInSeconds: sessions.ONCHAIN_CAPABILITY_TTL_SECONDS,
    });
  })
);

/** The current session's capabilities, so the UI can enable the right actions. */
router.get(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      session: {
        sid: req.auth.sid,
        method: req.auth.method,
        role: req.auth.role,
        capabilities: req.auth.capabilities,
        walletAddress: req.auth.walletAddress,
        createdAt: req.session.createdAt,
        lastSeenAt: req.session.lastSeenAt,
      },
    });
  })
);

/** Every live session for the account, so a user can audit and end them. */
router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const live = await sessions.listSessionsForUser(req.auth.userId);
    res.json({
      success: true,
      sessions: live.map((s) => ({
        sid: s.sid,
        current: s.sid === req.auth.sid,
        method: s.method,
        capabilities: s.capabilities,
        walletAddress: s.walletAddress,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
      })),
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
        if (err) {
          return res
            .status(401)
            .json({ success: false, error: 'Authentication required' });
        }
        const [count] = await Promise.all([
          tokens.revokeAllForUser(req.auth.userId),
          sessions.revokeAllForUser(req.auth.userId),
        ]);
        return res.json({ success: true, revoked: count });
      });
    }

    if (!refreshToken) throw new HttpError(400, 'refreshToken is required');

    const revoked = await tokens.revokeRefreshToken(refreshToken);

    // End the Redis session too, otherwise the access token stays usable for
    // the rest of its lifetime after a "sign out".
    if (req.headers.authorization) {
      await new Promise((resolve) =>
        requireAuth(req, res, async () => {
          if (req.auth?.sid) await sessions.revokeSession(req.auth.sid);
          resolve();
        })
      ).catch(() => {});
    }

    return res.json({ success: true, revoked: revoked ? 1 : 0 });
  })
);

router.get(
  '/me',
  requireAuth,
  loadUser,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      user: req.user.toJSON(),
      capabilities: req.auth.capabilities,
      walletAddress: req.auth.walletAddress,
    });
  })
);

module.exports = router;
