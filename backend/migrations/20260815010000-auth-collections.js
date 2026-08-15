/**
 * Indexes for the SIWE authentication collections.
 *
 * Both use a TTL index so expired nonces and refresh tokens are reaped by
 * MongoDB rather than accumulating forever.
 */

const AUTH_NONCE_INDEXES = [
  { key: { nonce: 1 }, name: 'nonce_unique', unique: true },
  { key: { expiresAt: 1 }, name: 'nonce_ttl', expireAfterSeconds: 0 },
  { key: { walletAddress: 1, consumedAt: 1 }, name: 'wallet_consumed' },
];

const REFRESH_TOKEN_INDEXES = [
  { key: { tokenHash: 1 }, name: 'tokenHash_unique', unique: true },
  { key: { expiresAt: 1 }, name: 'refresh_ttl', expireAfterSeconds: 0 },
  { key: { user: 1, revokedAt: 1 }, name: 'user_revoked' },
  { key: { family: 1 }, name: 'family' },
];

const COLLECTIONS = [
  ['authnonces', AUTH_NONCE_INDEXES],
  ['refreshtokens', REFRESH_TOKEN_INDEXES],
];

module.exports = {
  async up(db) {
    for (const [collection, indexes] of COLLECTIONS) {
      await db.collection(collection).createIndexes(indexes);
    }
  },

  async down(db) {
    for (const [collection, indexes] of COLLECTIONS) {
      for (const index of indexes) {
        try {
          await db.collection(collection).dropIndex(index.name);
        } catch (error) {
          if (error.code !== 27 && error.code !== 26) throw error;
        }
      }
    }
  },
};
