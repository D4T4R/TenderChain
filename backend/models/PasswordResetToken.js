const mongoose = require('mongoose');

/**
 * Single-use password reset tokens.
 *
 * Only a SHA-256 hash is stored. A reset token is a bearer credential that
 * grants account takeover, so a database leak must not hand over working ones -
 * the same reasoning as RefreshToken.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    requestedByIp: String,
  },
  { timestamps: true }
);

// TTL index: expired tokens are reaped rather than accumulating.
passwordResetTokenSchema.index(
  { expiresAt: 1 },
  { name: 'reset_ttl', expireAfterSeconds: 0 }
);
passwordResetTokenSchema.index({ user: 1, usedAt: 1 }, { name: 'user_used' });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
