const logger = require('../../utils/logger');

/**
 * Content-addressed storage for tender documents and milestone evidence.
 *
 * The driver is pluggable because the right backend differs by environment: a
 * local kubo node is fine for development but pins nothing once the machine is
 * off, which would leave a public demonstrator full of dead links. A pinning
 * service is the answer there, and the interface is kept narrow so adding one
 * is a new file rather than a refactor.
 *
 * Why this matters more than the screening: the CID *is* the hash of the
 * content. Once it is anchored on chain, any later alteration changes the CID
 * and is detectable with certainty. That is a stronger guarantee than any
 * classifier, and it is the reason uploads are never blocked on a screening
 * result.
 */

const DRIVERS = {
  kubo: () => require('./kuboDriver'),
  memory: () => require('./memoryDriver'),
};

let driver;

function driverName() {
  const configured = (process.env.IPFS_DRIVER || '').toLowerCase();
  if (configured) return configured;
  // Tests and offline development must not require a daemon.
  return process.env.NODE_ENV === 'test' ? 'memory' : 'kubo';
}

function getDriver() {
  if (driver) return driver;

  const name = driverName();
  const factory = DRIVERS[name];
  if (!factory) {
    throw new Error(
      `Unknown IPFS driver '${name}'. Available: ${Object.keys(DRIVERS).join(', ')}`
    );
  }

  driver = factory();
  logger.info(`IPFS driver: ${name}`);
  return driver;
}

/**
 * Stores content and returns its CID.
 *
 * @returns {Promise<{cid: string, size: number}>}
 */
async function add(content, options = {}) {
  if (!Buffer.isBuffer(content)) {
    throw new TypeError('IPFS add expects a Buffer');
  }
  return getDriver().add(content, options);
}

/**
 * Retrieves content by CID and verifies it hashes back to that CID.
 *
 * Verification is not optional: without it a compromised or misconfigured
 * gateway could serve different bytes than were anchored, and the whole
 * tamper-evidence argument collapses.
 */
async function cat(cid) {
  const content = await getDriver().cat(cid);
  const actual = await getDriver().hashOnly(content);

  if (actual !== cid) {
    const error = new Error(
      `IPFS content does not match its CID (asked for ${cid}, got ${actual})`
    );
    error.code = 'IPFS_CID_MISMATCH';
    throw error;
  }

  return content;
}

/** Computes the CID without storing, for comparing against an anchored value. */
async function hashOnly(content) {
  return getDriver().hashOnly(content);
}

async function pin(cid) {
  return getDriver().pin(cid);
}

function gatewayUrl(cid) {
  const base = (
    process.env.IPFS_GATEWAY_URL || 'https://ipfs.io'
  ).replace(/\/$/, '');
  return `${base}/ipfs/${cid}`;
}

async function isAvailable() {
  try {
    return await getDriver().isAvailable();
  } catch {
    return false;
  }
}

/** Test seam: drops the cached driver so the env var can be changed. */
function reset() {
  if (driver?.reset) driver.reset();
  driver = undefined;
}

module.exports = {
  add,
  cat,
  pin,
  hashOnly,
  gatewayUrl,
  isAvailable,
  reset,
  driverName,
};
