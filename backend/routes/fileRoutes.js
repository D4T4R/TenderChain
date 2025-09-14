const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Queue = require('bull');
const router = express.Router();

const documentProcessor = require('../services/documentProcessor');
const TenderSummary = require('../models/TenderSummary');
const logger = require('../utils/logger');

// Create processing queue for background processing
const documentQueue = new Queue('document processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const hash = crypto.createHash('md5').update(file.originalname + uniqueSuffix).digest('hex');
    cb(null, hash + path.extname(file.originalname));
  }
});

// File filter for supported document types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ message: 'fileRoutes working', queueActive: documentQueue.client.status === 'ready' });
});

// Upload and process tender document
router.post('/upload-tender-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { tenderAddress, tenderId, uploaderAddress, processAsync = 'false' } = req.body;
    
    if (!tenderAddress || !tenderId || !uploaderAddress) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Missing required fields: tenderAddress, tenderId, uploaderAddress' 
      });
    }

    const fileInfo = {
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: uploaderAddress,
      tenderAddress,
      tenderId
    };

    // Check if summary already exists for this tender
    const existingSummary = await TenderSummary.findByTender(tenderAddress);
    if (existingSummary) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ 
        error: 'Document summary already exists for this tender',
        summaryId: existingSummary._id
      });
    }

    if (processAsync === 'true') {
      // Add to queue for background processing
      const job = await documentQueue.add('process-document', fileInfo, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });
      
      res.status(202).json({
        message: 'Document queued for processing',
        jobId: job.id,
        status: 'processing'
      });
    } else {
      // Process immediately
      const startTime = Date.now();
      const result = await documentProcessor.processDocument(
        req.file.path,
        req.file.mimetype,
        fileInfo
      );
      const processingDuration = Date.now() - startTime;
      
      // Create and save summary
      const summary = new TenderSummary({
        ...fileInfo,
        ...result,
        processingDuration
      });
      
      await summary.save();
      
      // Clean up original file
      fs.unlinkSync(req.file.path);
      
      res.status(201).json({
        message: 'Document processed successfully',
        summaryId: summary._id,
        summary: summary.generatePublicView(),
        processingTime: `${processingDuration}ms`
      });
    }
  } catch (error) {
    logger.error('Document upload/processing error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Document processing failed',
      details: error.message
    });
  }
});

// Get processing job status
router.get('/job-status/:jobId', async (req, res) => {
  try {
    const job = await documentQueue.getJob(req.params.jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const state = await job.getState();
    const progress = job.progress();
    
    res.json({
      jobId: job.id,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    });
  } catch (error) {
    logger.error('Job status error:', error);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Get tender summary
router.get('/tender-summary/:tenderAddress', async (req, res) => {
  try {
    const summary = await TenderSummary.findByTender(req.params.tenderAddress);
    
    if (!summary) {
      return res.status(404).json({ error: 'No summary found for this tender' });
    }
    
    res.json({
      summary: summary.generatePublicView()
    });
  } catch (error) {
    logger.error('Get tender summary error:', error);
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

// Get public summaries (for dashboard)
router.get('/public-summaries', async (req, res) => {
  try {
    const { 
      category,
      workType,
      location,
      limit = 20,
      page = 1,
      search
    } = req.query;
    
    let summaries;
    
    if (search) {
      // Text search
      summaries = await TenderSummary.searchSummaries(search, {
        ...(category && { category }),
        ...(workType && { 'summary.workType': workType }),
        ...(location && { 'summary.location': { $regex: location, $options: 'i' } })
      });
    } else {
      // Regular filtering
      const filters = {
        ...(category && { category }),
        ...(workType && { 'summary.workType': workType }),
        ...(location && { 'summary.location': { $regex: location, $options: 'i' } })
      };
      
      summaries = await TenderSummary.findPublicSummaries(filters);
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedSummaries = summaries.slice(skip, skip + parseInt(limit));
    
    res.json({
      summaries: paginatedSummaries,
      total: summaries.length,
      page: parseInt(page),
      limit: parseInt(limit),
      hasNext: skip + parseInt(limit) < summaries.length
    });
  } catch (error) {
    logger.error('Get public summaries error:', error);
    res.status(500).json({ error: 'Failed to retrieve summaries' });
  }
});

// Get summary statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = await TenderSummary.getStatistics();
    const total = await TenderSummary.countDocuments({ status: 'completed' });
    
    res.json({
      totalSummaries: total,
      categoryBreakdown: stats,
      lastUpdated: new Date()
    });
  } catch (error) {
    logger.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Delete summary (admin only - implement proper auth)
router.delete('/summary/:summaryId', async (req, res) => {
  try {
    const { summaryId } = req.params;
    const { adminAddress } = req.body;
    
    // TODO: Add proper admin authentication
    if (!adminAddress) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    const summary = await TenderSummary.findById(summaryId);
    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }
    
    await TenderSummary.findByIdAndDelete(summaryId);
    
    res.json({ message: 'Summary deleted successfully' });
  } catch (error) {
    logger.error('Delete summary error:', error);
    res.status(500).json({ error: 'Failed to delete summary' });
  }
});

// Process document queue jobs
documentQueue.process('process-document', async (job) => {
  const { data } = job;
  
  try {
    job.progress(10);
    
    const startTime = Date.now();
    const result = await documentProcessor.processDocument(
      data.filePath,
      data.mimeType,
      data
    );
    
    job.progress(80);
    
    const processingDuration = Date.now() - startTime;
    
    // Create and save summary
    const summary = new TenderSummary({
      ...data,
      ...result,
      processingDuration
    });
    
    await summary.save();
    
    job.progress(95);
    
    // Clean up original file
    if (fs.existsSync(data.filePath)) {
      fs.unlinkSync(data.filePath);
    }
    
    job.progress(100);
    
    return {
      summaryId: summary._id,
      summary: summary.generatePublicView(),
      processingTime: `${processingDuration}ms`
    };
  } catch (error) {
    logger.error('Queue processing error:', error);
    
    // Clean up file on error
    if (fs.existsSync(data.filePath)) {
      fs.unlinkSync(data.filePath);
    }
    
    throw error;
  }
});

// Queue event handlers
documentQueue.on('completed', (job, result) => {
  logger.info(`Document processing completed for job ${job.id}`);
});

documentQueue.on('failed', (job, err) => {
  logger.error(`Document processing failed for job ${job.id}:`, err);
});

module.exports = router;
