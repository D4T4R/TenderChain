/**
 * Creates the indexes declared by the Mongoose schemas.
 *
 * These were previously built implicitly by autoIndex at boot. Declaring them
 * here means index changes are versioned, and production startup no longer
 * blocks on index builds.
 *
 * Index definitions must be kept in step with backend/models/*.js.
 */

const USER_INDEXES = [
  { key: { walletAddress: 1 }, name: 'walletAddress_unique', unique: true },
  { key: { email: 1 }, name: 'email_unique', unique: true },
  { key: { userType: 1, isActive: 1 }, name: 'userType_isActive' },
  { key: { kycStatus: 1, verificationStatus: 1 }, name: 'kyc_verification' },
  { key: { createdAt: -1 }, name: 'createdAt_desc' },
  { key: { userType: 1, createdAt: -1 }, name: 'userType_createdAt' },
];

const CONTRACTOR_INDEXES = [
  { key: { userId: 1 }, name: 'userId_unique', unique: true },
  { key: { walletAddress: 1 }, name: 'walletAddress_unique', unique: true },
  { key: { registrationNumber: 1 }, name: 'registrationNumber_unique', unique: true },
  { key: { panNumber: 1 }, name: 'panNumber_unique', unique: true },
  { key: { gstNumber: 1 }, name: 'gstNumber_unique', unique: true },
  { key: { companyName: 'text' }, name: 'companyName_text' },
  { key: { businessCategory: 1 }, name: 'businessCategory' },
  { key: { 'address.state': 1, 'address.city': 1 }, name: 'address_state_city' },
  { key: { 'performance.averageRating': -1 }, name: 'performance_rating_desc' },
  { key: { 'financialInfo.annualTurnover': -1 }, name: 'turnover_desc' },
  { key: { createdAt: -1 }, name: 'createdAt_desc' },
  {
    key: { businessCategory: 1, 'performance.averageRating': -1 },
    name: 'category_rating',
  },
];

const TENDER_SUMMARY_INDEXES = [
  { key: { tenderAddress: 1 }, name: 'tenderAddress_unique', unique: true },
  { key: { tenderId: 1 }, name: 'tenderId' },
  // These three are sparse in the schema. Note that reviewedBy/reviewedAt
  // declare `sparse: true` without `index: true` - in Mongoose that alone is
  // enough to register an index, so they must be mirrored here.
  { key: { ipfsHash: 1 }, name: 'ipfsHash_sparse', sparse: true },
  { key: { reviewedBy: 1 }, name: 'reviewedBy_sparse', sparse: true },
  { key: { reviewedAt: 1 }, name: 'reviewedAt_sparse', sparse: true },
  { key: { 'summary.workType': 1 }, name: 'summary_workType' },
  { key: { 'summary.location': 1 }, name: 'summary_location' },
  { key: { category: 1 }, name: 'category' },
  { key: { processedAt: -1 }, name: 'processedAt_desc' },
  { key: { searchKeywords: 1 }, name: 'searchKeywords' },
  {
    key: { isPublic: 1, status: 1, processedAt: -1 },
    name: 'public_status_processedAt',
  },
  { key: { isPublic: 1, status: 1, category: 1 }, name: 'public_status_category' },
  {
    key: { isPublic: 1, status: 1, 'summary.workType': 1 },
    name: 'public_status_workType',
  },
  {
    key: {
      'summary.overview': 'text',
      'summary.projectScope': 'text',
      searchKeywords: 'text',
    },
    name: 'summary_fulltext',
  },
];

const COLLECTIONS = [
  ['users', USER_INDEXES],
  ['contractors', CONTRACTOR_INDEXES],
  ['tendersummaries', TENDER_SUMMARY_INDEXES],
];

module.exports = {
  async up(db) {
    for (const [collection, indexes] of COLLECTIONS) {
      // createIndexes is idempotent for identical definitions, so re-running is safe.
      await db.collection(collection).createIndexes(indexes);
    }
  },

  async down(db) {
    for (const [collection, indexes] of COLLECTIONS) {
      for (const index of indexes) {
        try {
          await db.collection(collection).dropIndex(index.name);
        } catch (error) {
          // IndexNotFound (27) / NamespaceNotFound (26) are fine when rolling
          // back a partially applied migration.
          if (error.code !== 27 && error.code !== 26) throw error;
        }
      }
    }
  },
};
