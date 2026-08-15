const mongoose = require('mongoose');

/**
 * A wallet address a user has proven control of.
 *
 * Identity is deliberately decoupled from the wallet: a user may have zero
 * wallets (signs in with a password, reads reports, edits their profile), one,
 * or several. Only on-chain actions require a proven wallet.
 *
 * "Proven" means the address was recovered from a SIWE signature over a
 * server-issued nonce. Merely connecting a wallet exposes an address the
 * extension chose to hand over and proves nothing, so connection alone must
 * never create a row here.
 */
const linkedWalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    address: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => /^0x[a-fA-F0-9]{40}$/.test(v),
        message: 'Invalid Ethereum wallet address format',
      },
    },
    /** First time control of this address was proven. */
    provenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    /**
     * Most recent proof. Step-up checks freshness against this, so a wallet
     * linked months ago still has to re-sign before it can transact.
     */
    lastProvenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    /** The address offered by default when the user is asked to transact. */
    isPrimary: {
      type: Boolean,
      default: false,
    },
    /** Optional user-facing name, e.g. "Ledger" or "office laptop". */
    label: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * An address may be actively linked to at most one user, otherwise two accounts
 * could claim the same on-chain identity. The partial filter still allows an
 * address to be re-linked elsewhere once revoked.
 */
// Index names are pinned to match backend/migrations/*-decouple-wallet-from-user.
// Without an explicit name Mongoose derives one from the key ("address_1") while
// the migration used its own, and MongoDB rejects the second definition as
// "index already exists with a different name".
linkedWalletSchema.index(
  { address: 1 },
  {
    name: 'address_active_unique',
    unique: true,
    partialFilterExpression: { revokedAt: null },
  }
);
linkedWalletSchema.index({ user: 1, revokedAt: 1 }, { name: 'user_revoked' });
linkedWalletSchema.index({ user: 1, isPrimary: 1 }, { name: 'user_primary' });

linkedWalletSchema.statics.findActiveByAddress = function (address) {
  return this.findOne({
    address: String(address).toLowerCase(),
    revokedAt: null,
  });
};

linkedWalletSchema.statics.findActiveForUser = function (userId) {
  return this.find({ user: userId, revokedAt: null }).sort({
    isPrimary: -1,
    provenAt: 1,
  });
};

/**
 * Records a fresh proof for an address, linking it if it is new.
 *
 * Throws when the address is already linked to a different user rather than
 * silently reassigning it.
 */
linkedWalletSchema.statics.recordProof = async function (userId, address, extra = {}) {
  const normalised = String(address).toLowerCase();
  const existing = await this.findActiveByAddress(normalised);

  if (existing) {
    if (!existing.user.equals(userId)) {
      const error = new Error('Wallet is already linked to another account');
      error.statusCode = 409;
      throw error;
    }
    existing.lastProvenAt = new Date();
    if (extra.label) existing.label = extra.label;
    await existing.save();
    return existing;
  }

  // First wallet for this user becomes the primary.
  const activeCount = await this.countDocuments({
    user: userId,
    revokedAt: null,
  });

  return this.create({
    user: userId,
    address: normalised,
    provenAt: new Date(),
    lastProvenAt: new Date(),
    isPrimary: activeCount === 0,
    label: extra.label,
  });
};

module.exports = mongoose.model('LinkedWallet', linkedWalletSchema);
