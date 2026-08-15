const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const TenderSummary = require('../models/TenderSummary');
const Contractor = require('../models/Contractor');
const LinkedWallet = require('../models/LinkedWallet');

const migration = require('../migrations/20260815000000-initial-indexes');
const walletMigration = require('../migrations/20260815020000-decouple-wallet-from-user');

const ADDR_A = '0xaaaabbbbccccddddeeeeffff0000111122223333';

function summaryFixture(overrides = {}) {
  return {
    tenderAddress: ADDR_A,
    tenderId: 'TND-1',
    fileName: 'a.pdf',
    filePath: '/uploads/a.pdf',
    fileSize: 10,
    mimeType: 'application/pdf',
    originalText: 'some text',
    cleanText: 'some text',
    textLength: 9,
    extractedInfo: {
      organizations: [],
      places: [],
      money: [],
      dates: [],
      numbers: [],
      projectTypes: [],
      workDescription: [],
      requirements: [],
    },
    uploadedBy: '0x1111111111111111111111111111111111111111',
    summary: {
      overview: 'overview',
      workType: 'Roads',
      projectScope: 'scope',
      confidence: 80,
    },
    ...overrides,
  };
}

describe('models', () => {
  beforeAll(async () => {
    await connectDB();
    // Apply the index migrations so the tests exercise the real index set.
    await migration.up(mongoose.connection.db);
    await walletMigration.up(mongoose.connection.db);
  }, 60000);

  afterAll(async () => {
    await TenderSummary.deleteMany({});
    await User.deleteMany({});
    await disconnectDB();
  });

  describe('index declarations', () => {
    // A schema field with both `unique: true` and `index: true`, or a unique
    // field that also has an explicit schema.index(), registers the same key
    // twice and makes Mongoose 7 emit a duplicate index warning.
    it.each([
      ['User', User],
      ['Contractor', Contractor],
      ['TenderSummary', TenderSummary],
      ['LinkedWallet', LinkedWallet],
    ])('%s declares no duplicate index keys', (_name, Model) => {
      // schema.indexes() is the authoritative list Mongoose will build, and it
      // already folds in field-level `unique`/`index`/`sparse` declarations.
      // A key appearing twice here is exactly what triggers the duplicate
      // index warning.
      const keys = Model.schema.indexes().map(([key]) => JSON.stringify(key));
      const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(duplicates).toEqual([]);
    });

    // MongoDB reports a text index's key as { _fts: 'text', _ftsx: 1 } rather
    // than the fields it covers, so text indexes are compared by presence
    // rather than by key shape.
    const isTextIndex = (key) => Object.values(key).includes('text');

    it('every index the schemas declare exists in the database', async () => {
      for (const [Model, collection] of [
        [User, 'users'],
        [TenderSummary, 'tendersummaries'],
        [Contractor, 'contractors'],
        [LinkedWallet, 'linkedwallets'],
      ]) {
        const declaredKeys = Model.schema.indexes().map(([key]) => key);
        const liveIndexes = await mongoose.connection.db
          .collection(collection)
          .indexes();

        const liveKeys = liveIndexes
          .filter((i) => i.name !== '_id_')
          .map((i) => JSON.stringify(i.key));
        const liveTextCount = liveIndexes.filter((i) => i.key._fts).length;

        const missing = declaredKeys
          .filter((key) =>
            isTextIndex(key)
              ? liveTextCount === 0
              : !liveKeys.includes(JSON.stringify(key))
          )
          .map((key) => JSON.stringify(key));

        expect({ collection, missing }).toEqual({ collection, missing: [] });
      }
    });
  });

  describe('TenderSummary uniqueness', () => {
    beforeEach(async () => {
      await TenderSummary.deleteMany({});
    });

    it('rejects a second summary for the same tender', async () => {
      await TenderSummary.create(summaryFixture());
      await expect(
        TenderSummary.create(summaryFixture({ tenderId: 'TND-2' }))
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('normalises address case, so casing cannot bypass the constraint', async () => {
      await TenderSummary.create(summaryFixture());
      await expect(
        TenderSummary.create(
          summaryFixture({ tenderAddress: ADDR_A.toUpperCase(), tenderId: 'TND-3' })
        )
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('allows summaries for distinct tenders', async () => {
      await TenderSummary.create(summaryFixture());
      const second = await TenderSummary.create(
        summaryFixture({
          tenderAddress: '0xdddd'.padEnd(42, '9'),
          tenderId: 'TND-4',
        })
      );
      expect(second._id).toBeDefined();
    });
  });

  describe('User serialisation', () => {
    it('hides request metadata and exposes the profileUrl virtual', () => {
      const user = new User({
        userType: 'admin',
        email: 'z@example.com',
        phoneNumber: '9876543210',
        fullName: 'Zed',
        metadata: { ipAddress: '10.0.0.1', userAgent: 'curl' },
      });

      const json = user.toJSON();
      expect(json.metadata).toBeUndefined();
      expect(json.__v).toBeUndefined();
      // The virtual existed before but was never serialised, because toJSON
      // did not enable virtuals.
      expect(typeof json.profileUrl).toBe('string');
    });

    it('rejects an invalid userType', async () => {
      await expect(
        User.create({
          userType: 'sudo',
          email: 'a@example.com',
          phoneNumber: '9876543210',
          fullName: 'AB',
        })
      ).rejects.toMatchObject({ name: 'ValidationError' });
    });

    it('creates a user with no wallet at all', async () => {
      // The whole point of P2a: identity does not require a wallet.
      const user = await User.create({
        userType: 'public_verifier',
        email: 'nowallet@example.com',
        phoneNumber: '9876543211',
        fullName: 'No Wallet',
      });
      expect(user._id).toBeDefined();
      expect(user.userType).toBe('public_verifier');
      await User.deleteOne({ _id: user._id });
    });
  });
});
