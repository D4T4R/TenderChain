const logger = require('../utils/logger');

/**
 * Client for the Python screening service.
 *
 * Screening is advisory. If the service is slow, down or returns nonsense the
 * upload proceeds and the artefact is recorded as unscreened - a transparency
 * system must never silently drop evidence because a classifier was
 * unavailable, and the on-chain anchor is the guarantee that actually matters.
 *
 * This is the opposite policy to sessions, which fail closed: there, serving a
 * request without checking would honour revoked access. Here, refusing an
 * upload would suppress a record.
 */

const BASE_URL = () =>
  process.env.SCREENING_SERVICE_URL || 'http://127.0.0.1:8000';

const TIMEOUT_MS = Number(process.env.SCREENING_TIMEOUT_MS || 15000);

/** Shape returned when screening could not run. Never throws to the caller. */
function unavailable(reason) {
  return {
    available: false,
    risk: null,
    band: 'unknown',
    analysed: false,
    signals: [
      {
        code: 'screening_unavailable',
        severity: 'info',
        summary: 'Automated screening did not run',
        detail: reason,
      },
    ],
    hashes: {},
    metadata: {},
    reason,
  };
}

async function screen(buffer, { filename, mimeType } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new FormData();
    form.append(
      'file',
      new Blob([buffer], { type: mimeType || 'application/octet-stream' }),
      filename || 'upload'
    );
    if (mimeType) form.append('declared_type', mimeType);

    const response = await fetch(`${BASE_URL()}/screen`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      logger.warn(`Screening service returned ${response.status}: ${detail}`);
      return unavailable(`Screening service responded ${response.status}`);
    }

    const result = await response.json();
    return { available: true, ...result };
  } catch (error) {
    const reason =
      error.name === 'AbortError'
        ? `Screening timed out after ${TIMEOUT_MS}ms`
        : `Screening service unreachable: ${error.message}`;
    logger.warn(reason);
    return unavailable(reason);
  } finally {
    clearTimeout(timer);
  }
}

/** Perceptual-hash distance, used to detect reuse of earlier evidence. */
async function compare(a, b) {
  try {
    const form = new FormData();
    form.append('a', a);
    form.append('b', b);

    const response = await fetch(`${BASE_URL()}/compare`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    logger.warn(`Perceptual hash comparison failed: ${error.message}`);
    return null;
  }
}

async function isAvailable() {
  try {
    const response = await fetch(`${BASE_URL()}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { screen, compare, isAvailable, TIMEOUT_MS };
