const mongoose = require('mongoose');

/**
 * Refresh token records.
 *
 * Only a SHA-256 hash of the token is stored: a database leak should not hand
 * an attacker usable credentials. Tokens rotate on every refresh, and the
 * replaced record keeps a pointer to its successor so that presenting an
 * already-rotated token can be detected as reuse.
 */
const refreshTokenSchema = new mongoose.Schema(
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
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // All tokens descended from a single sign-in share a family id. Detecting
    // reuse lets us revoke the whole family rather than just one token.
    family: {
      type: String,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    // Set when this token is rotated, pointing at the replacement.
    replacedByHash: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    userAgent: String,
    ipAddress: String,
  },
  { timestamps: true }
);

// TTL index: expired tokens are removed automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });
refreshTokenSchema.index({ family: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
