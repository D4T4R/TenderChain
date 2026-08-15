const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * MongoDB connection management.
 *
 * Notes on the options below:
 *  - useNewUrlParser / useUnifiedTopology were removed. They have been no-ops
 *    since Mongoose 6 and only emit deprecation warnings on Mongoose 7.
 *  - autoIndex is disabled outside development. Building indexes on every boot
 *    is fine against a small local database but will stall startup and hold
 *    locks on a large one; indexes are created explicitly by the migrations in
 *    backend/migrations instead.
 */

const DEFAULT_URI = 'mongodb://localhost:27017/tenderchain';

const MAX_RETRIES = Number(process.env.MONGODB_MAX_RETRIES || 5);
const BASE_RETRY_DELAY_MS = Number(process.env.MONGODB_RETRY_DELAY_MS || 1000);

/**
 * Strips credentials from a connection string so it can be logged.
 * mongodb+srv://user:secret@host/db -> mongodb+srv://***@host/db
 */
function redactUri(uri) {
  if (!uri) return '(unset)';
  try {
    return uri.replace(/\/\/[^@/]+@/, '//***@');
  } catch {
    return '(unparseable)';
  }
}

function buildOptions() {
  return {
    // Connection pool. The defaults (maxPoolSize 100) are too permissive for a
    // single-purpose API and make it easy to exhaust the server's connections.
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 2),

    // Fail fast when the primary is unreachable rather than hanging the request.
    serverSelectionTimeoutMS: Number(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000
    ),
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS || 45000),

    // Index builds are handled by migrations outside development.
    autoIndex: process.env.NODE_ENV === 'development',
  };
}

function registerConnectionEvents() {
  const { connection } = mongoose;

  connection.on('connected', () => {
    logger.info(`MongoDB connected: ${connection.host}/${connection.name}`);
  });

  connection.on('error', (error) => {
    // Does not necessarily mean the connection is dead; the driver retries.
    logger.error('MongoDB connection error:', error);
  });

  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connects to MongoDB, retrying with exponential backoff.
 *
 * Throws if every attempt fails. The caller decides what to do about it - this
 * module deliberately does not call process.exit, which made the failure
 * untestable and skipped any other shutdown handling.
 */
async function connectDB({
  uri = process.env.MONGODB_URI || DEFAULT_URI,
  retries = MAX_RETRIES,
  baseDelayMs = BASE_RETRY_DELAY_MS,
  serverSelectionTimeoutMS,
} = {}) {
  registerConnectionEvents();

  const options = buildOptions();
  if (serverSelectionTimeoutMS !== undefined) {
    options.serverSelectionTimeoutMS = serverSelectionTimeoutMS;
  }

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, options);
      return mongoose.connection;
    } catch (error) {
      lastError = error;

      if (attempt === retries) break;

      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        `MongoDB connection attempt ${attempt}/${retries} failed ` +
          `(${error.message}). Retrying in ${delay}ms. URI: ${redactUri(uri)}`
      );
      await sleep(delay);
    }
  }

  logger.error(
    `MongoDB connection failed after ${retries} attempts. ` +
      `URI: ${redactUri(uri)}`
  );
  throw lastError;
}

async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDB, disconnectDB, isConnected, redactUri };
