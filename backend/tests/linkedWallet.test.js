const mongoose = require('mongoose');
const { ethers } = require('ethers');

const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const LinkedWallet = require('../models/LinkedWallet');
const tokens = require('../services/tokenService');
const { requireAuth, requireOnChainRole } = require('../middleware/authMiddleware');

const migration = require('../migrations/20260815020000-decouple-wallet-from-user');

function makeUser(overrides = {}) {
  return User.create({
    userType: 'contractor',
    email: `u${Math.random().toString(36).slice(2)}@example.com`,
    phoneNumber: '9876543210',
    fullName: 'Test User',
    ...overrides,
  });
}

const addr = () => ethers.Wallet.createRandom().address.toLowerCase();

describe('LinkedWallet / wallet-optional identity', () => {
  beforeAll(async () => {
    await connectDB();
    // Indexes come from the migration, which is the single source of truth.
    // Calling createIndexes() here would race it and can conflict on names.
    await migration.up(mongoose.connection.db);
  }, 60000);

  afterAll(async () => {
    await Promise.all([User.deleteMany({}), LinkedWallet.deleteMany({})]);
    await disconnectDB();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), LinkedWallet.deleteMany({})]);
  });

  describe('identity without a wallet', () => {
    it('creates and resolves a user that has no wallet', async () => {
      const user = await makeUser({ userType: 'public_verifier' });
      const wallets = await LinkedWallet.findActiveForUser(user._id);
      expect(wallets).toHaveLength(0);
    });

    it('issues a token with no wallet claim for a password-only session', async () => {
      const user = await makeUser();
      const token = tokens.signAccessToken(user);
      const payload = tokens.verifyAccessToken(token);

      expect(payload.sub).toBe(user._id.toString());
      expect(payload.wallet).toBeUndefined();
    });

    it('refuses an on-chain action with a clear wallet_required reason', async () => {
      const user = await makeUser();
      const token = tokens.signAccessToken(user);

      const req = {
        headers: { authorization: `Bearer ${token}` },
        method: 'POST',
        originalUrl: '/api/x',
      };

      await new Promise((resolve) => requireAuth(req, {}, resolve));
      expect(req.auth.walletAddress).toBeNull();
      expect(req.auth.hasWallet).toBe(false);

      const next = jest.fn();
      await requireOnChainRole('ContractorRepo', 'VERIFIER_ROLE')(req, {}, next);

      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      // Distinguishable from "wallet lacks the role": the client needs to know
      // whether to prompt for a signature or tell the user to ask an admin.
      expect(err.details).toEqual({ reason: 'wallet_required' });
    });
  });

  describe('recordProof', () => {
    it('links a wallet and marks the first one primary', async () => {
      const user = await makeUser();
      const a = addr();

      const link = await LinkedWallet.recordProof(user._id, a);
      expect(link.address).toBe(a);
      expect(link.isPrimary).toBe(true);
      expect(link.provenAt).toBeInstanceOf(Date);
    });

    it('supports several wallets per user, only the first primary', async () => {
      const user = await makeUser();
      const [a, b] = [addr(), addr()];

      await LinkedWallet.recordProof(user._id, a);
      const second = await LinkedWallet.recordProof(user._id, b);

      expect(second.isPrimary).toBe(false);
      const all = await LinkedWallet.findActiveForUser(user._id);
      expect(all).toHaveLength(2);
      expect(all[0].isPrimary).toBe(true);
    });

    it('refreshes lastProvenAt on re-proof without duplicating', async () => {
      const user = await makeUser();
      const a = addr();

      const first = await LinkedWallet.recordProof(user._id, a);
      const before = first.lastProvenAt.getTime();

      await new Promise((r) => setTimeout(r, 10));
      await LinkedWallet.recordProof(user._id, a);

      const after = await LinkedWallet.findActiveByAddress(a);
      expect(after.lastProvenAt.getTime()).toBeGreaterThan(before);
      expect(await LinkedWallet.countDocuments({ address: a })).toBe(1);
    });

    it('refuses to move an active wallet to another account', async () => {
      const [userA, userB] = await Promise.all([makeUser(), makeUser()]);
      const a = addr();

      await LinkedWallet.recordProof(userA._id, a);

      // Two accounts must not both claim the same on-chain identity.
      await expect(LinkedWallet.recordProof(userB._id, a)).rejects.toMatchObject(
        { statusCode: 409 }
      );
    });

    it('normalises case, so a checksummed address cannot double-link', async () => {
      const user = await makeUser();
      const mixed = ethers.Wallet.createRandom().address; // checksummed

      await LinkedWallet.recordProof(user._id, mixed);
      await LinkedWallet.recordProof(user._id, mixed.toLowerCase());

      expect(await LinkedWallet.countDocuments({ user: user._id })).toBe(1);
    });

    it('allows re-linking an address once revoked', async () => {
      const [userA, userB] = await Promise.all([makeUser(), makeUser()]);
      const a = addr();

      const link = await LinkedWallet.recordProof(userA._id, a);
      link.revokedAt = new Date();
      await link.save();

      // The partial unique index only covers active links.
      const relinked = await LinkedWallet.recordProof(userB._id, a);
      expect(relinked.user.toString()).toBe(userB._id.toString());
    });
  });

  describe('User.findByWallet', () => {
    it('resolves through the link, not a field on the user', async () => {
      const user = await makeUser();
      const a = addr();
      await LinkedWallet.recordProof(user._id, a);

      const found = await User.findByWallet(a.toUpperCase());
      expect(found._id.toString()).toBe(user._id.toString());
    });

    it('returns null for an unknown address', async () => {
      expect(await User.findByWallet(addr())).toBeNull();
    });

    it('returns null once the link is revoked', async () => {
      const user = await makeUser();
      const a = addr();
      const link = await LinkedWallet.recordProof(user._id, a);
      link.revokedAt = new Date();
      await link.save();

      expect(await User.findByWallet(a)).toBeNull();
    });
  });

  describe('migration backfill', () => {
    it('moves a legacy User.walletAddress into a proven primary link', async () => {
      const db = mongoose.connection.db;
      await LinkedWallet.deleteMany({});

      // Simulate a pre-migration document: wallet stored on the user.
      const legacyAddress = addr();
      const created = new Date('2026-01-01T00:00:00Z');
      const { insertedId } = await db.collection('users').insertOne({
        walletAddress: legacyAddress,
        userType: 'contractor',
        email: 'legacy@example.com',
        phoneNumber: '9876543210',
        fullName: 'Legacy User',
        isActive: true,
        createdAt: created,
        updatedAt: created,
      });

      const result = await migration.up(db);
      expect(result.migrated).toBeGreaterThanOrEqual(1);

      const link = await LinkedWallet.findActiveByAddress(legacyAddress);
      expect(link).not.toBeNull();
      expect(link.user.toString()).toBe(insertedId.toString());
      expect(link.isPrimary).toBe(true);
      // These accounts could only be created by producing a valid signature,
      // so the link is treated as already proven at registration time.
      expect(link.provenAt.toISOString()).toBe(created.toISOString());

      // And the field is gone from the user document.
      const migrated = await db
        .collection('users')
        .findOne({ _id: insertedId });
      expect(migrated.walletAddress).toBeUndefined();

      // Resolvable through the new path.
      const user = await User.findByWallet(legacyAddress);
      expect(user._id.toString()).toBe(insertedId.toString());
    });
  });
});
