const express = require('express');
const { body, param, validationResult } = require('express-validator');

const User = require('../models/User');
const tokens = require('../services/tokenService');
const sessions = require('../services/sessionService');
const {
  requireAuth,
  loadUser,
  requireRole,
} = require('../middleware/authMiddleware');
const { HttpError } = require('../middleware/errorMiddleware');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function assertValid(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new HttpError(
      400,
      'Validation failed',
      result.array().map((e) => ({ field: e.path, message: e.msg }))
    );
  }
}

router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'user' });
});

/**
 * The caller's own profile.
 */
router.get(
  '/profile',
  requireAuth,
  loadUser,
  asyncHandler(async (req, res) => {
    res.json({ success: true, user: req.user.toJSON() });
  })
);

/**
 * Update the caller's own profile.
 *
 * Deliberately does not accept walletAddress, userType, kycStatus or
 * verificationStatus: those are either identity or privilege, and must not be
 * self-assignable.
 */
router.patch(
  '/profile',
  requireAuth,
  loadUser,
  [
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phoneNumber')
      .optional()
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Invalid phone number'),
    body('fullName').optional().isLength({ min: 2, max: 100 }),
    body('preferences').optional().isObject(),
  ],
  asyncHandler(async (req, res) => {
    assertValid(req);

    const allowed = ['email', 'phoneNumber', 'fullName', 'preferences'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    }

    await req.user.save();
    res.json({ success: true, user: req.user.toJSON() });
  })
);

/**
 * Active sessions for the caller, and a way to end them.
 */
router.delete(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const revoked = await tokens.revokeAllForUser(req.auth.userId);
    res.json({ success: true, revoked });
  })
);

/**
 * Admin: list users.
 */
router.get(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { userType, isActive, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (userType) filter.userType = userType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const perPage = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: Number(page) || 1,
      users: users.map((u) => u.toJSON()),
    });
  })
);

/**
 * Admin: change a user's role or active state.
 *
 * Note this only affects the application's view. On-chain authority is granted
 * separately by the registry admin; requireOnChainRole exists precisely so a
 * role set here cannot by itself unlock a contract action.
 */
router.patch(
  '/:userId/status',
  requireAuth,
  requireRole('admin'),
  [
    param('userId').isMongoId(),
    body('userType')
      .optional()
      .isIn(['contractor', 'government_officer', 'verifier', 'admin']),
    body('isActive').optional().isBoolean(),
    body('kycStatus')
      .optional()
      .isIn(['pending', 'under_review', 'approved', 'rejected']),
  ],
  asyncHandler(async (req, res) => {
    assertValid(req);

    const user = await User.findById(req.params.userId);
    if (!user) throw new HttpError(404, 'User not found');

    const roleChanged =
      req.body.userType !== undefined && req.body.userType !== user.userType;

    if (req.body.userType !== undefined) user.userType = req.body.userType;
    if (req.body.kycStatus !== undefined) user.kycStatus = req.body.kycStatus;

    if (req.body.isActive !== undefined) {
      user.isActive = req.body.isActive;
      // Deactivating must also cut existing sessions, otherwise the user keeps
      // working until their refresh token expires.
      if (req.body.isActive === false) {
        await Promise.all([
          tokens.revokeAllForUser(user._id),
          sessions.revokeAllForUser(user._id),
        ]);
      }
    }

    await user.save();

    // Authorisation reads the role from the session, so a change here has to be
    // pushed to live sessions. Without this a demotion would not take effect
    // until every existing session expired.
    if (roleChanged && user.isActive) {
      await sessions.updateRoleForUser(user._id, user.userType);
    }
    res.json({ success: true, user: user.toJSON() });
  })
);

module.exports = router;
