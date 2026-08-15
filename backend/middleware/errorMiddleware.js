const logger = require('../utils/logger');

/**
 * Error carrying an explicit HTTP status, for use by route handlers.
 */
class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    if (details) this.details = details;
  }
}

// 404 Not Found middleware
const notFound = (req, res, next) => {
  next(new HttpError(404, `Not Found - ${req.originalUrl}`));
};

/**
 * Maps well-known driver/ODM errors onto HTTP semantics.
 * Returns null when the error is not recognised.
 */
function translateKnownError(err) {
  // Mongoose schema validation
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      message: 'Validation failed',
      details: Object.values(err.errors || {}).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    };
  }

  // Malformed ObjectId and friends
  if (err.name === 'CastError') {
    return {
      statusCode: 400,
      message: `Invalid value for ${err.path}`,
    };
  }

  // Unique index violation. Surfaces as a 409 rather than a 500 - this is how
  // concurrent duplicate inserts (e.g. two summaries for one tender) present.
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    return {
      statusCode: 409,
      message: fields.length
        ? `A record with that ${fields.join(', ')} already exists`
        : 'Duplicate record',
    };
  }

  // Body parser rejecting malformed JSON
  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Malformed JSON body' };
  }

  return null;
}

// Error handler middleware
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
const errorHandler = (err, req, res, next) => {
  const known = translateKnownError(err);
  const statusCode = known?.statusCode || err.statusCode || 500;
  const isServerError = statusCode >= 500;

  const logContext = `${req.method} ${req.originalUrl} -> ${statusCode}`;
  if (isServerError) {
    logger.error(`${logContext}: ${err.message}`, { stack: err.stack });
  } else {
    logger.warn(`${logContext}: ${err.message}`);
  }

  // Never surface an internal failure's message to the client: it can carry
  // query fragments, paths and driver internals.
  const message = isServerError
    ? 'Internal server error'
    : known?.message || err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(known?.details && { details: known.details }),
    ...(err.details && !known?.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = {
  notFound,
  errorHandler,
  HttpError,
};
