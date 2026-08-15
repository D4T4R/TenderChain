/**
 * Indexes for password authentication.
 *
 * No backfill is needed on users: passwordHash is optional, so existing
 * SIWE-created accounts stay valid with no password. They can set one later
 * through /api/auth/change-password, which skips the current-password check
 * when the account has none.
 */

const PASSWORD_RESET_INDEXES = [
  { key: { tokenHash: 1 }, name: 'tokenHash_unique', unique: true },
  { key: { expiresAt: 1 }, name: 'reset_ttl', expireAfterSeconds: 0 },
  { key: { user: 1, usedAt: 1 }, name: 'user_used' },
];

module.exports = {
  async up(db) {
    await db
      .collection('passwordresettokens')
      .createIndexes(PASSWORD_RESET_INDEXES);
  },

  async down(db) {
    for (const index of PASSWORD_RESET_INDEXES) {
      try {
        await db.collection('passwordresettokens').dropIndex(index.name);
      } catch (error) {
        if (error.code !== 27 && error.code !== 26) throw error;
      }
    }
    // Credential fields are removed so a rollback does not leave hashes behind.
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          passwordHash: '',
          passwordUpdatedAt: '',
          failedLoginAttempts: '',
          lockedUntil: '',
        },
      }
    );
  },
};
