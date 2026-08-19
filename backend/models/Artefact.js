const mongoose = require('mongoose');

/**
 * A file pinned to IPFS: a tender document, or evidence that milestone work
 * actually happened at the work site.
 *
 * Distinct from TenderSummary, which holds the generated summary of a tender
 * document. An artefact is the source object plus its provenance; a summary is
 * an interpretation of one.
 */

const signalSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    severity: {
      type: String,
      enum: ['info', 'low', 'medium', 'high'],
      required: true,
    },
    summary: String,
    detail: String,
    data: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const artefactSchema = new mongoose.Schema(
  {
    /** Content identifier. This is the hash, so it is the identity. */
    cid: {
      type: String,
      required: true,
      unique: true,
    },
    /** SHA-256 of the bytes, for callers that do not speak CID. */
    sha256: {
      type: String,
      required: true,
      index: true,
    },
    /**
     * Perceptual hash, images only. Unlike sha256 this survives re-encoding,
     * which is what makes reuse of an earlier photograph detectable.
     */
    phash: {
      type: String,
      default: null,
      sparse: true,
    },

    kind: {
      type: String,
      enum: ['tender_document', 'milestone_evidence', 'supporting'],
      required: true,
    },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    byteSize: { type: Number, required: true, min: 0 },

    /** What this artefact is evidence for. At least one should be set. */
    tenderAddress: { type: String, lowercase: true, trim: true, default: null },
    contractAddress: { type: String, lowercase: true, trim: true, default: null },
    milestoneIndex: { type: Number, default: null },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Wallet the uploader's session was proven with, if any. */
    uploadedByWallet: { type: String, lowercase: true, trim: true, default: null },

    screening: {
      /** False when the service was unreachable; the upload still proceeded. */
      available: { type: Boolean, default: false },
      /** 0-100, or null when screening did not run. Advisory only. */
      risk: { type: Number, default: null, min: 0, max: 100 },
      band: {
        type: String,
        enum: ['low', 'medium', 'high', 'unknown'],
        default: 'unknown',
      },
      analysed: { type: Boolean, default: false },
      signals: [signalSchema],
      serviceVersion: String,
      screenedAt: Date,
    },

    /**
     * Set when an earlier artefact is perceptually near-identical. Reuse of
     * evidence is the fraud that actually occurs with milestone photographs.
     */
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artefact',
      default: null,
    },
    duplicateDistance: { type: Number, default: null },

    /**
     * Review state. Nothing is ever blocked on screening, so a flagged artefact
     * is stored and anchored like any other and simply queued for a human.
     */
    reviewState: {
      type: String,
      enum: ['not_required', 'pending', 'cleared', 'rejected'],
      default: 'not_required',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },

    /** Set once the CID has been written on chain. */
    anchoredTxHash: { type: String, default: null, sparse: true },
    anchoredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

artefactSchema.index({ tenderAddress: 1, kind: 1 });
artefactSchema.index({ contractAddress: 1, milestoneIndex: 1 });
artefactSchema.index({ uploadedBy: 1, createdAt: -1 });
// The verifier queue: anything awaiting review, oldest first.
artefactSchema.index({ reviewState: 1, createdAt: 1 });

/**
 * Finds a prior artefact whose perceptual hash is close enough to count as the
 * same image. Comparison is delegated to the screening service, which owns the
 * hash implementation.
 *
 * Only images have a phash, and only artefacts for the same contract are
 * compared - reusing a photo across unrelated projects is a different problem
 * and would produce noise here.
 */
artefactSchema.statics.findPerceptualDuplicate = async function (
  { phash, contractAddress, tenderAddress, excludeId },
  compare
) {
  if (!phash) return null;

  const scope = {
    phash: { $ne: null },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    ...(contractAddress
      ? { contractAddress }
      : tenderAddress
        ? { tenderAddress }
        : {}),
  };

  // Bounded: comparing against every artefact ever uploaded would not scale,
  // and older evidence for the same contract is where reuse shows up.
  const candidates = await this.find(scope)
    .sort({ createdAt: -1 })
    .limit(200)
    .select('_id phash createdAt');

  for (const candidate of candidates) {
    const result = await compare(phash, candidate.phash);
    if (result && result.verdict === 'near_identical') {
      return { artefact: candidate, distance: result.distance };
    }
  }

  return null;
};

module.exports = mongoose.model('Artefact', artefactSchema);
