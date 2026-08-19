/**
 * Indexes for IPFS-pinned artefacts.
 *
 * cid is unique because it is the content hash: the same bytes uploaded twice
 * are the same artefact, and the pipeline relies on that to deduplicate rather
 * than storing a second copy.
 */

const ARTEFACT_INDEXES = [
  { key: { cid: 1 }, name: 'cid_unique', unique: true },
  { key: { sha256: 1 }, name: 'sha256' },
  { key: { phash: 1 }, name: 'phash_sparse', sparse: true },
  { key: { tenderAddress: 1, kind: 1 }, name: 'tender_kind' },
  { key: { contractAddress: 1, milestoneIndex: 1 }, name: 'contract_milestone' },
  { key: { uploadedBy: 1, createdAt: -1 }, name: 'uploader_recent' },
  // The verifier queue: pending items, oldest first.
  { key: { reviewState: 1, createdAt: 1 }, name: 'review_queue' },
  { key: { anchoredTxHash: 1 }, name: 'anchored_sparse', sparse: true },
];

module.exports = {
  async up(db) {
    await db.collection('artefacts').createIndexes(ARTEFACT_INDEXES);
  },

  async down(db) {
    for (const index of ARTEFACT_INDEXES) {
      try {
        await db.collection('artefacts').dropIndex(index.name);
      } catch (error) {
        if (error.code !== 27 && error.code !== 26) throw error;
      }
    }
  },
};
