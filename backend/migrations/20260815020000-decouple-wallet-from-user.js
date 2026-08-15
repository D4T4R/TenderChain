/**
 * Moves User.walletAddress into the LinkedWallet collection.
 *
 * Identity is no longer keyed by a wallet: a user may have zero wallets and
 * still sign in with a password. Existing SIWE-created users each get one
 * LinkedWallet row, marked primary and already proven (they could only have
 * been created by producing a valid signature).
 *
 * The user documents keep walletAddress until `down` needs it, then it is
 * unset in a second pass - so a failure midway leaves the source data intact.
 */

const LINKED_WALLET_INDEXES = [
  {
    key: { address: 1 },
    name: 'address_active_unique',
    unique: true,
    partialFilterExpression: { revokedAt: null },
  },
  { key: { user: 1, revokedAt: 1 }, name: 'user_revoked' },
  { key: { user: 1, isPrimary: 1 }, name: 'user_primary' },
];

module.exports = {
  async up(db) {
    await db.collection('linkedwallets').createIndexes(LINKED_WALLET_INDEXES);

    const users = await db
      .collection('users')
      .find({ walletAddress: { $exists: true, $ne: null } })
      .toArray();

    if (users.length) {
      const now = new Date();
      const docs = users.map((u) => ({
        user: u._id,
        address: String(u.walletAddress).toLowerCase(),
        // These accounts were created through SIWE, so control of the address
        // was proven at registration. createdAt is the best evidence we have.
        provenAt: u.createdAt || now,
        lastProvenAt: u.updatedAt || u.createdAt || now,
        isPrimary: true,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      }));

      // ordered:false so one duplicate does not abort the whole backfill.
      await db.collection('linkedwallets').insertMany(docs, { ordered: false });
    }

    // Only once the rows exist.
    await db
      .collection('users')
      .updateMany({}, { $unset: { walletAddress: '' } });

    // The old unique index on users.walletAddress would now reject every
    // document, since they all have the field missing.
    try {
      await db.collection('users').dropIndex('walletAddress_unique');
    } catch (error) {
      if (error.code !== 27 && error.code !== 26) throw error;
    }

    return { migrated: users.length };
  },

  async down(db) {
    // Restore the primary wallet onto each user.
    const links = await db
      .collection('linkedwallets')
      .find({ isPrimary: true, revokedAt: null })
      .toArray();

    for (const link of links) {
      await db
        .collection('users')
        .updateOne(
          { _id: link.user },
          { $set: { walletAddress: link.address } }
        );
    }

    // Users that never had a wallet cannot satisfy the old required+unique
    // constraint, so they are removed rather than left in a state the previous
    // schema would reject. This is why `down` is destructive and should only be
    // run against a database that has not yet taken password-only signups.
    await db.collection('users').deleteMany({
      walletAddress: { $exists: false },
    });

    await db.collection('users').createIndexes([
      { key: { walletAddress: 1 }, name: 'walletAddress_unique', unique: true },
    ]);

    for (const index of LINKED_WALLET_INDEXES) {
      try {
        await db.collection('linkedwallets').dropIndex(index.name);
      } catch (error) {
        if (error.code !== 27 && error.code !== 26) throw error;
      }
    }
    await db.collection('linkedwallets').deleteMany({});
  },
};
