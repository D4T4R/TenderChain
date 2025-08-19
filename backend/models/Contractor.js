const mongoose = require('mongoose');

const contractorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  
  // Company Information
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  incorporationDate: {
    type: Date,
    required: true
  },
  companyType: {
    type: String,
    required: true,
    enum: ['private_limited', 'public_limited', 'partnership', 'llp', 'proprietorship', 'trust', 'society']
  },
  businessCategory: [{
    type: String,
    enum: ['construction', 'infrastructure', 'it_services', 'consulting', 'manufacturing', 'transportation', 'healthcare', 'education', 'environment', 'other']
  }],
  
  // Government Registration Details
  panNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
      },
      message: 'Invalid PAN number format'
    }
  },
  gstNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Invalid GST number format'
    }
  },
  
  // Address Information
  address: {
    street: { type: String, required: true, maxlength: 200 },
    city: { type: String, required: true, maxlength: 100 },
    state: { type: String, required: true, maxlength: 100 },
    pincode: { 
      type: String, 
      required: true,
      validate: {
        validator: function(v) {
          return /^[1-9][0-9]{5}$/.test(v);
        },
        message: 'Invalid pincode format'
      }
    },
    country: { type: String, default: 'India' }
  },
  
  // Bank Details
  bankDetails: {
    accountNumber: { type: String, required: true },
    ifscCode: { 
      type: String, 
      required: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
        },
        message: 'Invalid IFSC code format'
      }
    },
    bankName: { type: String, required: true, maxlength: 100 },
    accountHolderName: { type: String, required: true, maxlength: 100 },
    branchName: { type: String, maxlength: 100 }
  },
  
  // Document Storage (IPFS hashes)
  documents: {
    panCard: { type: String },
    gstCertificate: { type: String },
    incorporationCertificate: { type: String },
    bankStatement: { type: String },
    addressProof: { type: String },
    authorizedSignatoryProof: { type: String },
    experienceCertificates: [String],
    qualificationCertificates: [String],
    workPortfolio: [String]
  },
  
  // Financial Information
  financialInfo: {
    annualTurnover: {
      type: Number,
      min: 0,
      required: true
    },
    creditRating: {
      type: String,
      enum: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'unrated'],
      default: 'unrated'
    },
    taxStatus: {
      type: String,
      enum: ['compliant', 'non_compliant', 'under_review'],
      default: 'under_review'
    },
    financialYear: {
      type: String,
      required: true
    }
  },
  
  // Experience and Capabilities
  experience: {
    yearsInBusiness: {
      type: Number,
      required: true,
      min: 0
    },
    previousProjects: {
      type: Number,
      default: 0,
      min: 0
    },
    completedValue: {
      type: Number,
      default: 0,
      min: 0
    },
    specializations: [String],
    equipmentOwned: [String],
    certifications: [String]
  },
  
  // Performance Metrics
  performance: {
    totalBidsSubmitted: { type: Number, default: 0 },
    totalBidsWon: { type: Number, default: 0 },
    totalContractsCompleted: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    onTimeDeliveryRate: { type: Number, default: 0, min: 0, max: 100 },
    qualityRating: { type: Number, default: 0, min: 0, max: 5 },
    blacklisted: { type: Boolean, default: false },
    blacklistReason: String,
    blacklistDate: Date
  },
  
  // Subscription and Preferences
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    validTill: Date,
    features: [String]
  },
  
  preferences: {
    tenderCategories: [String],
    maxTenderValue: Number,
    minTenderValue: Number,
    preferredLocations: [String],
    notificationSettings: {
      newTenders: { type: Boolean, default: true },
      bidUpdates: { type: Boolean, default: true },
      contractAwards: { type: Boolean, default: true },
      payments: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      // Don't expose sensitive bank details in API responses
      if (ret.bankDetails) {
        ret.bankDetails = {
          ...ret.bankDetails,
          accountNumber: ret.bankDetails.accountNumber ? 
            `****${ret.bankDetails.accountNumber.slice(-4)}` : undefined
        };
      }
      return ret;
    }
  }
});

// Indexes for efficient queries
contractorSchema.index({ walletAddress: 1 });
contractorSchema.index({ panNumber: 1 });
contractorSchema.index({ gstNumber: 1 });
contractorSchema.index({ companyName: 'text' });
contractorSchema.index({ businessCategory: 1 });
contractorSchema.index({ 'address.state': 1, 'address.city': 1 });
contractorSchema.index({ 'performance.averageRating': -1 });
contractorSchema.index({ 'financialInfo.annualTurnover': -1 });
contractorSchema.index({ createdAt: -1 });

// Virtual for success rate
contractorSchema.virtual('successRate').get(function() {
  if (this.performance.totalBidsSubmitted === 0) return 0;
  return (this.performance.totalBidsWon / this.performance.totalBidsSubmitted) * 100;
});

// Method to update performance metrics
contractorSchema.methods.updatePerformanceMetrics = function(metrics) {
  Object.assign(this.performance, metrics);
  return this.save();
};

// Method to check eligibility for tender
contractorSchema.methods.isEligibleForTender = function(tenderCriteria) {
  if (this.performance.blacklisted) return false;
  
  if (tenderCriteria.minTurnover && this.financialInfo.annualTurnover < tenderCriteria.minTurnover) {
    return false;
  }
  
  if (tenderCriteria.minExperience && this.experience.yearsInBusiness < tenderCriteria.minExperience) {
    return false;
  }
  
  if (tenderCriteria.requiredCertifications) {
    const hasAllCertifications = tenderCriteria.requiredCertifications.every(cert => 
      this.experience.certifications.includes(cert)
    );
    if (!hasAllCertifications) return false;
  }
  
  return true;
};

// Static method to find by PAN
contractorSchema.statics.findByPAN = function(panNumber) {
  return this.findOne({ panNumber: panNumber.toUpperCase() });
};

// Static method to search contractors
contractorSchema.statics.searchContractors = function(criteria) {
  const query = {};
  
  if (criteria.businessCategory) {
    query.businessCategory = { $in: criteria.businessCategory };
  }
  
  if (criteria.minTurnover) {
    query['financialInfo.annualTurnover'] = { $gte: criteria.minTurnover };
  }
  
  if (criteria.location) {
    query['address.state'] = new RegExp(criteria.location, 'i');
  }
  
  if (criteria.rating) {
    query['performance.averageRating'] = { $gte: criteria.rating };
  }
  
  return this.find(query).populate('userId', 'fullName email phoneNumber verificationStatus');
};

module.exports = mongoose.model('Contractor', contractorSchema);
