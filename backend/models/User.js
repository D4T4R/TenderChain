const mongoose = require('mongoose');
const validator = require('validator');

/**
 * A user identity.
 *
 * Note there is deliberately no walletAddress field. Identity is decoupled from
 * the wallet: a user may hold zero wallets and still sign in, read reports and
 * manage their profile. Proven wallets live in the LinkedWallet collection, and
 * only on-chain actions require one. Previously walletAddress was required and
 * unique here, which made an account impossible without a wallet.
 */
const userSchema = new mongoose.Schema({
  userType: {
    type: String,
    required: true,
    enum: [
      'contractor',
      'government_officer',
      // Official verifier: authorised, holds VERIFIER_ROLE on the registries.
      'verifier',
      // General-population verifier: not authorised but bonded, participates in
      // PublicClaims, which is stake-gated rather than role-gated.
      'public_verifier',
      'admin',
    ]
    // No standalone index: the { userType, isActive } compound index below has
    // userType as its prefix, so it already serves userType-only queries.
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      // The previous hand-rolled regex capped the TLD at 2-3 characters, so it
      // rejected .info, .email, .online and similar - including addresses that
      // are perfectly valid for the government bodies this system is for.
      validator: (v) => validator.isEmail(v),
      message: 'Invalid email format'
    }
  },
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[6-9]\d{9}$/.test(v); // Indian mobile number format
      },
      message: 'Invalid phone number format'
    }
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending'
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'verified', 'suspended'],
    default: 'unverified'
  },
  lastLogin: {
    type: Date
  },
  profileCompleteness: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true }
    },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Kolkata' }
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    registrationSource: String
  }
}, {
  timestamps: true,
  toJSON: {
    // virtuals were previously defined but never serialised, because this was
    // not set.
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      // Request metadata is operational PII and has no business leaving the API.
      delete ret.metadata;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Compound indexes matching the queries the API actually issues.
userSchema.index({ userType: 1, isActive: 1 });
userSchema.index({ kycStatus: 1, verificationStatus: 1 });
userSchema.index({ createdAt: -1 });
// Admin listings filter by type and sort by recency.
userSchema.index({ userType: 1, createdAt: -1 });

// Virtual for profile URL
userSchema.virtual('profileUrl').get(function() {
  return `/api/user/profile/${this._id}`;
});

// Method to update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to calculate profile completeness.
// walletAddress is no longer part of this: a user without a wallet is a valid,
// fully usable account, so counting it would permanently cap them at 80%.
userSchema.methods.calculateProfileCompleteness = function() {
  let completeness = 0;
  const requiredFields = ['email', 'phoneNumber', 'fullName'];

  requiredFields.forEach(field => {
    if (this[field]) completeness += 25;
  });

  if (this.kycStatus === 'approved') completeness += 25;

  this.profileCompleteness = completeness;
  return completeness;
};

/**
 * Resolve a user from a proven wallet address.
 *
 * Goes through LinkedWallet rather than a field on this document, so an account
 * can hold several wallets and a wallet can be rotated without touching the
 * identity.
 */
userSchema.statics.findByWallet = async function(walletAddress) {
  // Required lazily to avoid a circular import: LinkedWallet references User.
  const LinkedWallet = require('./LinkedWallet');
  const link = await LinkedWallet.findActiveByAddress(walletAddress);
  if (!link) return null;
  return this.findById(link.user);
};

// Static method to find active users by type
userSchema.statics.findActiveByType = function(userType) {
  return this.find({ userType, isActive: true });
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  // Calculate profile completeness before saving
  this.calculateProfileCompleteness();
  next();
});

// No pre('findOneAndUpdate') hook to stamp updatedAt: the timestamps option
// already maintains it on update queries, and setting it manually overwrote
// Mongoose's own value.

module.exports = mongoose.model('User', userSchema);
