const mongoose = require('mongoose');

const extractedInfoSchema = new mongoose.Schema({
  organizations: [String],
  places: [String],
  money: [String],
  dates: [String],
  numbers: [String],
  projectTypes: [String],
  workDescription: [String],
  requirements: [String]
}, { _id: false });

const summarySchema = new mongoose.Schema({
  overview: {
    type: String,
    required: true
  },
  workType: {
    type: String,
    required: true
  },
  estimatedValue: {
    type: String,
    default: 'Not specified'
  },
  location: {
    type: String,
    default: 'Not specified'
  },
  keyRequirements: [String],
  timeline: {
    type: String,
    default: 'Not specified'
  },
  projectScope: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

const tenderSummarySchema = new mongoose.Schema({
  // Link to tender contract address or tender ID
  tenderAddress: {
    type: String,
    required: true,
    index: true
  },
  tenderId: {
    type: String,
    required: true,
    index: true
  },
  
  // Document information
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  
  // IPFS storage
  ipfsHash: {
    type: String,
    sparse: true,
    index: true
  },
  
  // Processing results
  originalText: {
    type: String,
    required: true
  },
  cleanText: {
    type: String,
    required: true
  },
  extractedInfo: {
    type: extractedInfoSchema,
    required: true
  },
  summary: {
    type: summarySchema,
    required: true
  },
  
  // Metadata
  uploadedBy: {
    type: String, // wallet address
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  textLength: {
    type: Number,
    required: true
  },
  processingDuration: {
    type: Number, // milliseconds
    default: 0
  },
  
  // Status and visibility
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'archived'],
    default: 'completed'
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Search optimization
  searchKeywords: [String],
  category: {
    type: String,
    default: 'general'
  },
  
  // Validation and quality
  validationScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  reviewedBy: {
    type: String, // wallet address of reviewer
    sparse: true
  },
  reviewedAt: {
    type: Date,
    sparse: true
  },
  
  // Error tracking
  errorLog: [{
    timestamp: { type: Date, default: Date.now },
    error: String,
    stack: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
tenderSummarySchema.index({ tenderAddress: 1, tenderId: 1 });
tenderSummarySchema.index({ 'summary.workType': 1 });
tenderSummarySchema.index({ 'summary.location': 1 });
tenderSummarySchema.index({ category: 1 });
tenderSummarySchema.index({ processedAt: -1 });
tenderSummarySchema.index({ isPublic: 1, status: 1 });
tenderSummarySchema.index({ searchKeywords: 1 });

// Text index for full-text search
tenderSummarySchema.index({
  'summary.overview': 'text',
  'summary.projectScope': 'text',
  searchKeywords: 'text'
});

// Virtual for public summary (filtered for public consumption)
tenderSummarySchema.virtual('publicSummary').get(function() {
  return {
    tenderId: this.tenderId,
    tenderAddress: this.tenderAddress,
    fileName: this.fileName,
    summary: {
      overview: this.summary.overview,
      workType: this.summary.workType,
      estimatedValue: this.summary.estimatedValue,
      location: this.summary.location,
      timeline: this.summary.timeline,
      projectScope: this.summary.projectScope,
      confidence: this.summary.confidence
    },
    category: this.category,
    processedAt: this.processedAt
  };
});

// Pre-save middleware to generate search keywords
tenderSummarySchema.pre('save', function(next) {
  if (this.isModified('summary') || this.isModified('extractedInfo')) {
    const keywords = new Set();
    
    // Add from summary
    if (this.summary.workType) keywords.add(this.summary.workType.toLowerCase());
    if (this.summary.location) keywords.add(this.summary.location.toLowerCase());
    
    // Add from extracted info
    this.extractedInfo.projectTypes.forEach(type => keywords.add(type.toLowerCase()));
    this.extractedInfo.organizations.forEach(org => keywords.add(org.toLowerCase()));
    this.extractedInfo.places.forEach(place => keywords.add(place.toLowerCase()));
    
    // Set category based on work type
    this.category = this.summary.workType.toLowerCase();
    
    this.searchKeywords = Array.from(keywords);
  }
  next();
});

// Static methods for querying
tenderSummarySchema.statics.findByTender = function(tenderAddress) {
  return this.findOne({ tenderAddress, status: 'completed' });
};

tenderSummarySchema.statics.findPublicSummaries = function(filters = {}) {
  const query = { isPublic: true, status: 'completed', ...filters };
  return this.find(query)
    .select('tenderId tenderAddress summary category processedAt fileName')
    .sort({ processedAt: -1 });
};

tenderSummarySchema.statics.searchSummaries = function(searchTerm, filters = {}) {
  const query = {
    isPublic: true,
    status: 'completed',
    $text: { $search: searchTerm },
    ...filters
  };
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .select('tenderId tenderAddress summary category processedAt fileName')
    .sort({ score: { $meta: 'textScore' }, processedAt: -1 });
};

tenderSummarySchema.statics.getStatistics = function() {
  return this.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$summary.confidence' },
        avgTextLength: { $avg: '$textLength' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Instance methods
tenderSummarySchema.methods.generatePublicView = function() {
  return this.publicSummary;
};

tenderSummarySchema.methods.updateValidationScore = function(score, reviewerAddress) {
  this.validationScore = score;
  this.reviewedBy = reviewerAddress;
  this.reviewedAt = new Date();
  return this.save();
};

tenderSummarySchema.methods.addError = function(error, stack = null) {
  this.errorLog.push({
    error: error.message || error,
    stack: stack || error.stack
  });
  this.status = 'failed';
  return this.save();
};

module.exports = mongoose.model('TenderSummary', tenderSummarySchema);
