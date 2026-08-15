const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDB, disconnectDB, redactUri } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const contractorRoutes = require('./routes/contractorRoutes');
const officerRoutes = require('./routes/officerRoutes');
const verifierRoutes = require('./routes/verifierRoutes');
const fileRoutes = require('./routes/fileRoutes');
const tenderRoutes = require('./routes/tenderRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration.
//
// The allowed origins are configurable because the frontend port has moved
// before: this was pinned to :3000 while the Next.js app serves on :3002, so
// every browser request failed preflight.
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  if (process.env.NODE_ENV === 'production') {
    logger.error(
      'CORS_ALLOWED_ORIGINS is not set. No browser origin will be allowed.'
    );
  } else {
    allowedOrigins.push(...DEFAULT_DEV_ORIGINS);
  }
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/verifiers', verifierRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/tenders', tenderRoutes);
app.use('/api/public', publicRoutes);

// Serve uploaded files (if storing locally)
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

let server;

/**
 * Drains in-flight HTTP requests before closing the database, so a shutdown
 * cannot strand a request mid-query. Previously the database was closed
 * immediately while the HTTP server kept accepting connections.
 */
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }
    await disconnectDB();
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function start() {
  // Connect before listening so the server never accepts traffic it cannot serve.
  await connectDB();

  server = app.listen(PORT, () => {
    logger.info(`🚀 TenderChain Backend Server running on port ${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
    // Redacted: the raw URI may embed credentials.
    logger.info(`🗄️ Database: ${redactUri(process.env.MONGODB_URI)}`);
  });

  return server;
}

// Only auto-start when run directly, so tests can import the app without
// opening a socket or requiring a live database.
if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = app;
module.exports.start = start;
module.exports.shutdown = shutdown;
