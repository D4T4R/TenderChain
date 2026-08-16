const { createClient } = require('redis');
const logger = require('../utils/logger');

/**
 * Redis connection.
 *
 * Holds ephemeral shared state — sessions, rate-limit counters, cached chain
 * reads — so that no request depends on which process serves it. That is the
 * precondition for running more than one instance, and the seam that lets the
 * ML workload be pulled out later without rewriting the session layer.
 *
 * Durable records stay in MongoDB. Refresh tokens in particular are kept there
 * deliberately: they are an audit trail (who signed in, from where, when it was
 * rotated) and must survive a cache flush, whereas a session is expected to be
 * disposable.
 */

const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'tc';

let client;
let connecting;

function buildClient() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  return createClient({
    url,
    socket: {
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
      /**
       * Bounded exponential backoff. Returning an Error stops reconnection;
       * a number is the delay before the next attempt.
       */
      reconnectStrategy: (retries) => {
        const max = Number(process.env.REDIS_MAX_RETRIES || 10);
        if (retries > max) {
          logger.error(`Redis: giving up after ${retries} reconnection attempts`);
          return new Error('Redis reconnection attempts exhausted');
        }
        return Math.min(1000 * 2 ** retries, 30000);
      },
    },
  });
}

function redactUrl(url) {
  if (!url) return '(unset)';
  return url.replace(/\/\/[^@/]+@/, '//***@');
}

async function connectRedis() {
  if (client?.isReady) return client;
  if (connecting) return connecting;

  client = buildClient();

  client.on('error', (error) => {
    // The client retries on its own; this fires per failed attempt, so it must
    // not be treated as fatal.
    logger.error(`Redis error: ${error.message}`);
  });
  client.on('ready', () => logger.info('Redis connected'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting'));
  client.on('end', () => logger.warn('Redis connection closed'));

  connecting = client
    .connect()
    .then(() => client)
    .finally(() => {
      connecting = undefined;
    });

  try {
    return await connecting;
  } catch (error) {
    logger.error(
      `Redis connection failed (${redactUrl(process.env.REDIS_URL)}): ${error.message}`
    );
    throw error;
  }
}

/**
 * Returns the connected client.
 *
 * Throws when Redis is unavailable rather than degrading silently. Sessions
 * live here, so a request that cannot reach Redis cannot prove its session is
 * still valid — answering it anyway would mean honouring revoked sessions.
 * This is a deliberate fail-closed choice; see requireAuth.
 */
function getRedis() {
  if (!client?.isReady) {
    const error = new Error('Redis is not available');
    error.code = 'REDIS_UNAVAILABLE';
    throw error;
  }
  return client;
}

function isReady() {
  return Boolean(client?.isReady);
}

async function disconnectRedis() {
  if (!client) return;
  try {
    // quit() drains pending commands; destroy() would drop them.
    await client.quit();
  } catch {
    client.destroy?.();
  } finally {
    client = undefined;
  }
}

/** Namespaced key, so one Redis can host several environments safely. */
function key(...parts) {
  return [KEY_PREFIX, ...parts].join(':');
}

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedis,
  isReady,
  key,
  redactUrl,
  KEY_PREFIX,
};
