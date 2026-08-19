const express = require('express');
const multer = require('multer');

const Artefact = require('../models/Artefact');
const artefacts = require('../services/artefactService');
const ipfs = require('../services/ipfs');
const screening = require('../services/screeningService');
const {
  requireAuth,
  requireCapability,
  requireRole,
  CAPABILITIES,
} = require('../middleware/authMiddleware');
const { HttpError } = require('../middleware/errorMiddleware');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Artefacts: documents and milestone evidence pinned to IPFS.
 *
 * Uploading is an off-chain write, so a password session can do it. Anchoring
 * the CID on chain is a transaction and needs a proven wallet - the split that
 * the capability tiers exist for.
 */

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]);

const upload = multer({
  // Memory, not disk: the file goes to IPFS and its bytes must be hashed, so
  // writing it to local disk first would add a copy nobody reads.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_ARTEFACT_BYTES || 25 * 1024 * 1024),
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(415, `Unsupported file type: ${file.mimetype}`));
  },
});

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const [ipfsUp, screeningUp] = await Promise.all([
      ipfs.isAvailable(),
      screening.isAvailable(),
    ]);
    res.json({
      status: 'OK',
      service: 'artefacts',
      dependencies: {
        ipfs: { driver: ipfs.driverName(), available: ipfsUp },
        // Not part of the health verdict: screening being down degrades the
        // service but does not stop uploads.
        screening: { available: screeningUp, required: false },
      },
    });
  })
);

/**
 * Upload an artefact. Screened, stored and recorded; never rejected on the
 * screening result.
 */
router.post(
  '/',
  requireAuth,
  requireCapability(CAPABILITIES.WRITE_OFFCHAIN),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'A file is required');

    const { kind, tenderAddress, contractAddress, milestoneIndex } = req.body || {};

    const VALID_KINDS = ['tender_document', 'milestone_evidence', 'supporting'];
    if (!VALID_KINDS.includes(kind)) {
      throw new HttpError(400, `kind must be one of: ${VALID_KINDS.join(', ')}`);
    }
    if (!tenderAddress && !contractAddress) {
      throw new HttpError(
        400,
        'An artefact must reference a tenderAddress or a contractAddress'
      );
    }

    const { artefact, deduplicated } = await artefacts.ingest(req.file.buffer, {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      kind,
      tenderAddress,
      contractAddress,
      milestoneIndex:
        milestoneIndex === undefined || milestoneIndex === ''
          ? null
          : Number(milestoneIndex),
      uploadedBy: req.auth.userId,
      uploadedByWallet: req.auth.walletAddress,
    });

    res.status(deduplicated ? 200 : 201).json({
      success: true,
      deduplicated,
      artefact: artefact.toJSON(),
      gatewayUrl: ipfs.gatewayUrl(artefact.cid),
      // Stated plainly at the point of use, so a caller cannot mistake the
      // score for a judgement about authenticity.
      note:
        'Screening is advisory. It indicates where to look; it does not establish ' +
        'that a document is genuine or forged.',
    });
  })
);

/** List artefacts, filtered. Open to any signed-in user. */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tenderAddress, contractAddress, kind, reviewState, limit = 50 } =
      req.query;

    const filter = {};
    if (tenderAddress) filter.tenderAddress = String(tenderAddress).toLowerCase();
    if (contractAddress) {
      filter.contractAddress = String(contractAddress).toLowerCase();
    }
    if (kind) filter.kind = kind;
    if (reviewState) filter.reviewState = reviewState;

    const results = await Artefact.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    res.json({
      success: true,
      artefacts: results.map((a) => ({
        ...a.toJSON(),
        gatewayUrl: ipfs.gatewayUrl(a.cid),
      })),
    });
  })
);

/** The verifier's queue: everything awaiting a human decision. */
router.get(
  '/review-queue',
  requireAuth,
  requireRole('verifier', 'public_verifier', 'admin'),
  asyncHandler(async (req, res) => {
    const pending = await Artefact.find({ reviewState: 'pending' })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('duplicateOf', 'cid fileName createdAt');

    res.json({
      success: true,
      artefacts: pending.map((a) => ({
        ...a.toJSON(),
        gatewayUrl: ipfs.gatewayUrl(a.cid),
      })),
    });
  })
);

router.get(
  '/:cid',
  requireAuth,
  asyncHandler(async (req, res) => {
    const artefact = await Artefact.findOne({ cid: req.params.cid });
    if (!artefact) throw new HttpError(404, 'Artefact not found');

    res.json({
      success: true,
      artefact: artefact.toJSON(),
      gatewayUrl: ipfs.gatewayUrl(artefact.cid),
    });
  })
);

/**
 * Streams the bytes back, verifying they still hash to the recorded CID.
 *
 * This is where the tamper-evidence claim is actually tested: a mismatch means
 * the content served is not the content that was anchored.
 */
router.get(
  '/:cid/content',
  requireAuth,
  asyncHandler(async (req, res) => {
    const artefact = await Artefact.findOne({ cid: req.params.cid });
    if (!artefact) throw new HttpError(404, 'Artefact not found');

    let content;
    try {
      content = await artefacts.retrieve(artefact.cid);
    } catch (error) {
      if (error.code === 'IPFS_CID_MISMATCH') {
        throw new HttpError(
          502,
          'Stored content does not match its recorded hash and cannot be trusted',
          { reason: 'cid_mismatch' }
        );
      }
      if (error.code === 'IPFS_NOT_FOUND' || error.code === 'IPFS_UNAVAILABLE') {
        throw new HttpError(503, `Content is not retrievable: ${error.message}`);
      }
      throw error;
    }

    res.setHeader('Content-Type', artefact.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${artefact.fileName.replace(/"/g, '')}"`
    );
    res.send(content);
  })
);

/** Verifier decision on a flagged artefact. */
router.post(
  '/:cid/review',
  requireAuth,
  requireRole('verifier', 'public_verifier', 'admin'),
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body || {};
    if (!['cleared', 'rejected'].includes(decision)) {
      throw new HttpError(400, "decision must be 'cleared' or 'rejected'");
    }

    const artefact = await Artefact.findOne({ cid: req.params.cid });
    if (!artefact) throw new HttpError(404, 'Artefact not found');

    artefact.reviewState = decision;
    artefact.reviewedBy = req.auth.userId;
    artefact.reviewedAt = new Date();
    artefact.reviewNote = note || null;
    await artefact.save();

    // Note the artefact itself is never deleted, even when rejected. The record
    // that something was submitted and refused is part of the audit trail.
    res.json({ success: true, artefact: artefact.toJSON() });
  })
);

module.exports = router;
