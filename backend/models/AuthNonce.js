const mongoose = require('mongoose');

/**
 * Single-use nonces for Sign-In With Ethereum (EIP-4361).
 *
 * The nonce is issued by the server, embedded in the message the wallet signs,
 * and consumed on verification. Without server-issued single-use nonces a
 * captured signature could be replayed indefinitely.
 *
 * Documents expire automatically via a TTL index, so expired nonces do not
 * accumulate and a stale nonce cannot be redeemed.
 */
const authNonceSchema = new mongoose.Schema(
  {
    nonce: {
      type: String,
      required: true,
      unique: true,
    },
    // The address that requested the nonce. Verification checks the recovered
    // signer against this, so a nonce issued for one wallet cannot be redeemed
    // by another.
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    // Marked at redemption. Combined with the unique index this makes the
    // nonce strictly single-use.
    consumedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index: MongoDB removes the document once expiresAt passes.
authNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authNonceSchema.index({ walletAddress: 1, consumedAt: 1 });

module.exports = mongoose.model('AuthNonce', authNonceSchema);
