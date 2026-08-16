const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis, isReady, key } = require('./redis');
const logger = require('../utils/logger');

/**
 * Rate limiters backed by Redis.
 *
 * The default in-memory store counts per process, so two instances behind a
 * load balancer silently double every limit and a restart forgets everything.
 * Sharing the counter in Redis is what makes the limit mean what it says once
 * there is more than one process.
 *
 * Falls back to the in-memory store when Redis is unavailable. Unlike session
 * lookups this fails *open* rather than closed: refusing all traffic because
 * the rate limiter cannot count is a worse outcome than counting per process
 * for a while, and the fallback is logged loudly.
 */

function rateLimiter({ name, windowMs, limit, message, ...rest }) {
  const options = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message,
    ...rest,
  };

  if (isReady()) {
    options.store = new RedisStore({
      prefix: key('ratelimit', name, ''),
      sendCommand: (...args) => getRedis().sendCommand(args),
    });
  } else {
    logger.warn(
      `Rate limiter '${name}' is using the in-memory store; limits will not ` +
        'be shared across processes until Redis is available.'
    );
  }

  return rateLimit(options);
}

module.exports = { rateLimiter };
