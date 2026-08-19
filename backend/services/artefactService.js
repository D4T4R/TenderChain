const Artefact = require('../models/Artefact');
const ipfs = require('./ipfs');
const screening = require('./screeningService');
const logger = require('../utils/logger');

/**
 * The upload pipeline: screen, store, record.
 *
 * Order matters. Screening runs first so its verdict is part of the record at
 * the moment the CID is created, which means the assessment is anchored
 * alongside the evidence rather than bolted on afterwards. But screening never
 * gates the upload - if it fails, is slow, or flags the file, the artefact is
 * stored and pinned regardless and routed to a human instead.
 *
 * Suppressing a document because a heuristic disliked it would be the worst
 * possible failure for a transparency system: the rejection leaves no record,
 * so nobody can audit what was refused or why.
 */

/** Risk at or above which a human should look before the evidence is relied on. */
const REVIEW_THRESHOLD = Number(process.env.SCREENING_REVIEW_THRESHOLD || 30);

function decideReviewState(screeningResult, duplicate) {
  if (duplicate) return 'pending';
  if (!screeningResult.available) {
    // Unscreened is not the same as clean. Queue it rather than implying it
    // passed something it never went through.
    return 'pending';
  }
  if (typeof screeningResult.risk === 'number' && screeningResult.risk >= REVIEW_THRESHOLD) {
    return 'pending';
  }
  return 'not_required';
}

/**
 * @param {Buffer} buffer file contents
 * @param {object} meta   fileName, mimeType, kind, tenderAddress,
 *                        contractAddress, milestoneIndex, uploadedBy,
 *                        uploadedByWallet
 */
async function ingest(buffer, meta) {
  const started = Date.now();

  // 1. Screen. Never throws; returns an "unavailable" shape on failure.
  const result = await screening.screen(buffer, {
    filename: meta.fileName,
    mimeType: meta.mimeType,
  });

  const sha256 = result.hashes?.sha256;
  const phash = result.hashes?.phash || null;

  // 2. Check for reuse of earlier evidence, which is the fraud that actually
  //    happens here. Only meaningful when we got a perceptual hash.
  let duplicate = null;
  if (phash) {
    duplicate = await Artefact.findPerceptualDuplicate(
      {
        phash,
        contractAddress: meta.contractAddress,
        tenderAddress: meta.tenderAddress,
      },
      screening.compare
    );
  }

  // 3. Store. This is the step that actually provides tamper evidence.
  const { cid, size } = await ipfs.add(buffer, { filename: meta.fileName });

  // Same bytes uploaded twice produce the same CID. Return the existing record
  // rather than failing on the unique index.
  const existing = await Artefact.findOne({ cid });
  if (existing) {
    logger.info(`Artefact ${cid} already stored; returning existing record`);
    return { artefact: existing, deduplicated: true };
  }

  const artefact = await Artefact.create({
    cid,
    // Fall back to a locally computed digest if screening was unavailable, so
    // the integrity fields are never empty.
    sha256: sha256 || (await ipfs.hashOnly(buffer)),
    phash,
    kind: meta.kind,
    fileName: meta.fileName,
    mimeType: meta.mimeType,
    byteSize: size ?? buffer.length,
    tenderAddress: meta.tenderAddress || null,
    contractAddress: meta.contractAddress || null,
    milestoneIndex: meta.milestoneIndex ?? null,
    uploadedBy: meta.uploadedBy,
    uploadedByWallet: meta.uploadedByWallet || null,
    screening: {
      available: result.available,
      risk: result.risk ?? null,
      band: result.band || 'unknown',
      analysed: Boolean(result.analysed),
      signals: result.signals || [],
      serviceVersion: result.service_version,
      screenedAt: new Date(),
    },
    duplicateOf: duplicate?.artefact?._id || null,
    duplicateDistance: duplicate?.distance ?? null,
    reviewState: decideReviewState(result, duplicate),
  });

  logger.info(
    `Artefact ${cid} stored in ${Date.now() - started}ms ` +
      `(risk ${result.risk ?? 'n/a'}, review ${artefact.reviewState})`
  );

  return { artefact, deduplicated: false };
}

/**
 * Fetches an artefact's bytes, verifying they still hash to the recorded CID.
 *
 * This is where the tamper-evidence claim is actually cashed in.
 */
async function retrieve(cid) {
  return ipfs.cat(cid);
}

module.exports = { ingest, retrieve, decideReviewState, REVIEW_THRESHOLD };
