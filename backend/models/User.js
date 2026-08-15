const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    // unique already creates the index; adding index: true as well made
    // Mongoose 7 emit a duplicate schema index warning.
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid Ethereum wallet address format'
    }
  },
  userType: {
    type: String,
    required: true,
    enum: ['contractor', 'government_officer', 'verifier', 'admin']
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
      validator: function(v) {
        return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
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

// Method to calculate profile completeness
userSchema.methods.calculateProfileCompleteness = function() {
  let completeness = 0;
  const requiredFields = ['walletAddress', 'email', 'phoneNumber', 'fullName'];
  
  requiredFields.forEach(field => {
    if (this[field]) completeness += 20;
  });
  
  if (this.kycStatus === 'approved') completeness += 20;
  
  this.profileCompleteness = completeness;
  return completeness;
};

// Static method to find by wallet address
userSchema.statics.findByWallet = function(walletAddress) {
  return this.findOne({ walletAddress: walletAddress.toLowerCase() });
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
