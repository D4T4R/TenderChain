# Document Processing and Summarization Feature

## Overview

This feature automatically processes tender documents uploaded by government officers and generates intelligent summaries for public transparency. It uses advanced NLP techniques and optional AI integration to extract key information and create readable summaries.

## Architecture

### Components

1. **Document Processor Service** (`backend/services/documentProcessor.js`)
   - Text extraction from PDF, Word, and text files
   - NLP processing for entity extraction
   - Rule-based and AI-powered summarization
   - Confidence scoring

2. **File Upload API** (`backend/routes/fileRoutes.js`)
   - Document upload handling
   - Background processing queue
   - Summary retrieval endpoints
   - Statistics and analytics

3. **Database Model** (`backend/models/TenderSummary.js`)
   - MongoDB schema for storing summaries
   - Search and filtering capabilities
   - Statistics and aggregation methods

4. **Public Dashboard** (`frontend/examples/dashboardNormal.html`)
   - Summary display with search and filters
   - Statistics dashboard
   - Modal views for detailed information

5. **Upload Interface** (`frontend/examples/tender-document-upload.html`)
   - Government officer document upload interface
   - Drag-and-drop functionality
   - Real-time processing feedback

## Features

### Document Processing

- **Supported Formats**: PDF, Word (.doc, .docx), Plain text
- **File Size Limit**: 10MB per document
- **Processing Modes**: Immediate or background processing
- **Duplicate Detection**: Prevents multiple summaries for the same tender

### Information Extraction

- **Basic Information**:
  - Work type (Construction, Roads, Bridges, etc.)
  - Location and places
  - Estimated values and monetary amounts
  - Timeline and dates
  - Organizations involved

- **Advanced Analysis**:
  - Project scope identification
  - Key requirements extraction
  - Work description summarization
  - Confidence scoring (0-100%)

### Public Dashboard Features

- **Search and Filtering**:
  - Text search across summaries
  - Filter by work type
  - Filter by location
  - Category-based filtering

- **Statistics**:
  - Total summaries count
  - Most common project types
  - Average confidence scores
  - Category breakdowns

- **Responsive Design**:
  - Card-based layout
  - Pagination support
  - Modal popups for detailed views
  - Mobile-friendly interface

## Installation and Setup

### 1. Install Dependencies

```bash
cd backend
npm install pdf-parse natural compromise multer mammoth @huggingface/inference bull redis
```

### 2. Environment Configuration

Add to your `.env` file:

```env
# AI/ML Configuration (optional)
HUGGINGFACE_API_TOKEN=your_huggingface_api_token_here

# Redis Configuration (for background processing)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain
```

### 3. Start Required Services

```bash
# Start MongoDB
sudo systemctl start mongodb

# Start Redis (optional, for background processing)
sudo systemctl start redis

# Start the backend server
cd backend
npm start
```

### 4. Access the Interfaces

- **Upload Interface**: `http://localhost:3000/tender-document-upload.html`
- **Public Dashboard**: `http://localhost:3000/dashboardNormal.html` (Tender Summaries tab)
- **API Endpoints**: `http://localhost:3001/api/files/`

## API Endpoints

### Upload Document
```http
POST /api/files/upload-tender-document
```

**Parameters**:
- `document`: File (PDF/Word/Text)
- `tenderId`: String
- `tenderAddress`: String (blockchain address)
- `uploaderAddress`: String (wallet address)
- `processAsync`: Boolean (optional)

### Get Public Summaries
```http
GET /api/files/public-summaries
```

**Query Parameters**:
- `category`: Filter by category
- `workType`: Filter by work type
- `location`: Filter by location
- `limit`: Number of results
- `page`: Page number
- `search`: Search query

### Get Tender Summary
```http
GET /api/files/tender-summary/:tenderAddress
```

### Get Statistics
```http
GET /api/files/statistics
```

### Check Job Status
```http
GET /api/files/job-status/:jobId
```

## Usage Examples

### 1. Upload a Tender Document

```javascript
const formData = new FormData();
formData.append('document', fileInput.files[0]);
formData.append('tenderId', 'TND001');
formData.append('tenderAddress', '0x1234...abcd');
formData.append('uploaderAddress', '0x5678...efgh');

const response = await fetch('/api/files/upload-tender-document', {
    method: 'POST',
    body: formData
});

const result = await response.json();
console.log(result.summary);
```

### 2. Search Summaries

```javascript
const response = await fetch('/api/files/public-summaries?search=road construction&workType=Roads');
const data = await response.json();
console.log(data.summaries);
```

### 3. Get Processing Statistics

```javascript
const response = await fetch('/api/files/statistics');
const stats = await response.json();
console.log(`Total summaries: ${stats.totalSummaries}`);
```

## Configuration Options

### Document Processor Settings

```javascript
// In documentProcessor.js
const config = {
    maxTextLength: 4000,          // Max text for AI processing
    confidenceThreshold: 60,       // Minimum confidence score
    maxRequirements: 10,           // Max requirements to extract
    maxWorkDescriptions: 5,        // Max work descriptions
    summaryLength: { min: 50, max: 150 }  // AI summary length
};
```

### Processing Queue Settings

```javascript
// Queue configuration
const queueOptions = {
    attempts: 3,                   // Retry failed jobs 3 times
    backoff: {
        type: 'exponential',
        delay: 5000                // 5 second delay between retries
    },
    removeOnComplete: 10,          // Keep 10 completed jobs
    removeOnFail: 50              // Keep 50 failed jobs
};
```

## Monitoring and Debugging

### 1. Check Processing Logs

```bash
# View application logs
tail -f backend/logs/app.log

# Check Redis queue status
redis-cli monitor
```

### 2. MongoDB Queries

```javascript
// Get all summaries with low confidence
db.tendersummaries.find({"summary.confidence": {$lt: 60}});

// Get statistics by category
db.tendersummaries.aggregate([
    {$group: {_id: "$category", count: {$sum: 1}}},
    {$sort: {count: -1}}
]);
```

### 3. Error Handling

Common issues and solutions:

- **File Upload Fails**: Check file size limits and supported formats
- **Processing Timeout**: Increase queue timeout or use background processing
- **Low Confidence Scores**: Review document quality and NLP patterns
- **Missing Summaries**: Check MongoDB connection and model validation

## Performance Considerations

### 1. Scaling

- Use background processing for large documents
- Implement document caching for repeated access
- Consider clustering for high-traffic scenarios

### 2. Optimization

- Pre-process documents to remove unnecessary content
- Use text chunking for very large documents
- Implement result caching for frequently accessed summaries

### 3. Resource Management

- Monitor memory usage during PDF processing
- Set appropriate queue concurrency limits
- Implement cleanup for temporary files

## Security Considerations

1. **File Validation**: Strict file type and size checking
2. **Input Sanitization**: Clean extracted text before storage
3. **Access Control**: Verify uploader permissions
4. **Data Privacy**: Hash sensitive information where appropriate
5. **Rate Limiting**: Prevent abuse of upload endpoints

## Future Enhancements

### Planned Features

1. **Multi-language Support**: Process documents in regional languages
2. **OCR Integration**: Extract text from scanned PDF documents
3. **Collaborative Editing**: Allow manual summary corrections
4. **Automated Categorization**: ML-based project categorization
5. **Integration with Blockchain**: Store summary hashes on-chain

### Advanced AI Features

1. **Custom Model Training**: Train domain-specific models
2. **Entity Recognition**: Advanced NER for tender-specific entities
3. **Sentiment Analysis**: Analyze document tone and complexity
4. **Document Comparison**: Compare similar tenders automatically

## Contributing

When contributing to this feature:

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Consider backward compatibility
5. Test with various document formats

## License

This document processing feature is part of the TenderChain system and follows the same licensing terms as the main project.
"
