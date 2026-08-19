const request = require('supertest');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/database');
const { connectRedis, disconnectRedis, getRedis, key } = require('../config/redis');
const app = require('../server');
const User = require('../models/User');
const Artefact = require('../models/Artefact');
const ipfs = require('../services/ipfs');
const screening = require('../services/screeningService');

const migration = require('../migrations/20260818000000-artefacts');
const baseIndexes = require('../migrations/20260815000000-initial-indexes');
const walletMigration = require('../migrations/20260815020000-decouple-wallet-from-user');
const passwordMigration = require('../migrations/20260815030000-password-credentials');

const CREDS = {
  email: 'artefact-user@example.com',
  password: 'Correct-Horse-Battery-7',
  phoneNumber: '9876543210',
  fullName: 'Artefact User',
};

const TENDER = '0xaaaabbbbccccddddeeeeffff0000111122223333';

/** A clean screening response, as the Python service would return it. */
function screeningResponse(overrides = {}) {
  return {
    available: true,
    risk: 8,
    band: 'low',
    kind: 'image',
    analysed: true,
    signals: [
      { code: 'gps_absent', severity: 'low', summary: 'No location recorded' },
    ],
    hashes: { sha256: 'a'.repeat(64), phash: 'f45a1932c93c1b5d' },
    metadata: { width: 640, height: 480 },
    service_version: '0.1.0',
    ...overrides,
  };
}

async function signIn() {
  const res = await request(app).post('/api/auth/register').send(CREDS);
  return res.body.accessToken;
}

function uploadRequest(token, { body = {}, file } = {}) {
  const req = request(app)
    .post('/api/artefacts')
    .set('Authorization', `Bearer ${token}`)
    .field('kind', body.kind ?? 'milestone_evidence')
    .field('tenderAddress', body.tenderAddress ?? TENDER);

  if (body.contractAddress) req.field('contractAddress', body.contractAddress);

  return req.attach(
    'file',
    file?.buffer ?? Buffer.from('pretend-jpeg-bytes'),
    { filename: file?.name ?? 'site.jpg', contentType: file?.type ?? 'image/jpeg' }
  );
}

describe('artefacts: IPFS storage and screening', () => {
  let token;

  beforeAll(async () => {
    await Promise.all([connectDB(), connectRedis()]);
    const db = mongoose.connection.db;
    await baseIndexes.up(db);
    await walletMigration.up(db);
    await passwordMigration.up(db);
    await migration.up(db);
  }, 60000);

  afterAll(async () => {
    await Promise.all([User.deleteMany({}), Artefact.deleteMany({})]);
    const keys = await getRedis().keys(key('*'));
    if (keys.length) await getRedis().del(keys);
    await Promise.all([disconnectDB(), disconnectRedis()]);

    const fileRoutes = require('../routes/fileRoutes');
    if (fileRoutes.documentQueue) await fileRoutes.documentQueue.close();
  });

  beforeEach(async () => {
    ipfs.reset();
    await Promise.all([User.deleteMany({}), Artefact.deleteMany({})]);
    const keys = await getRedis().keys(key('*'));
    if (keys.length) await getRedis().del(keys);
    jest.restoreAllMocks();
    jest.spyOn(screening, 'screen').mockResolvedValue(screeningResponse());
    jest.spyOn(screening, 'compare').mockResolvedValue({
      distance: 40,
      verdict: 'different',
    });
    token = await signIn();
  });

  describe('storage and content addressing', () => {
    it('stores a file and returns a real CID', async () => {
      const res = await uploadRequest(token).expect(201);

      expect(res.body.artefact.cid).toMatch(/^bafk/);
      expect(res.body.gatewayUrl).toContain(res.body.artefact.cid);
      // The advisory framing travels with the response so a caller cannot
      // mistake the score for a judgement about authenticity.
      expect(res.body.note).toMatch(/advisory/i);
    });

    it('returns identical bytes for the recorded CID', async () => {
      const content = Buffer.from('the exact bytes that were anchored');
      const upload = await uploadRequest(token, {
        file: { buffer: content },
      }).expect(201);

      const res = await request(app)
        .get(`/api/artefacts/${upload.body.artefact.cid}/content`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Buffer.from(res.body)).toEqual(content);
    });

    it('refuses content whose bytes no longer match its CID', async () => {
      const upload = await uploadRequest(token).expect(201);
      const cid = upload.body.artefact.cid;

      // Simulate a gateway serving different bytes than were anchored - the
      // exact failure the CID exists to make detectable.
      jest
        .spyOn(require('../services/ipfs/memoryDriver'), 'cat')
        .mockResolvedValue(Buffer.from('substituted content'));

      const res = await request(app)
        .get(`/api/artefacts/${cid}/content`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/does not match/i);
    });

    it('deduplicates identical bytes rather than storing twice', async () => {
      const content = Buffer.from('identical evidence');
      const first = await uploadRequest(token, { file: { buffer: content } });
      const second = await uploadRequest(token, { file: { buffer: content } });

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body.deduplicated).toBe(true);
      expect(second.body.artefact.cid).toBe(first.body.artefact.cid);
      expect(await Artefact.countDocuments()).toBe(1);
    });
  });

  describe('screening is advisory', () => {
    it('records the risk and signals against the artefact', async () => {
      const res = await uploadRequest(token).expect(201);

      expect(res.body.artefact.screening.risk).toBe(8);
      expect(res.body.artefact.screening.band).toBe('low');
      expect(res.body.artefact.screening.signals).toHaveLength(1);
      expect(res.body.artefact.reviewState).toBe('not_required');
    });

    it('still stores the file when screening flags it as high risk', async () => {
      screening.screen.mockResolvedValue(
        screeningResponse({
          risk: 85,
          band: 'high',
          signals: [
            {
              code: 'synthetic_generator',
              severity: 'high',
              summary: 'Metadata names an image generator',
            },
          ],
        })
      );

      const res = await uploadRequest(token).expect(201);

      // Never blocked: suppressing evidence leaves no auditable record of what
      // was refused or why.
      expect(res.body.artefact.cid).toBeTruthy();
      expect(res.body.artefact.reviewState).toBe('pending');
    });

    it('still stores the file when the screening service is unreachable', async () => {
      screening.screen.mockResolvedValue({
        available: false,
        risk: null,
        band: 'unknown',
        analysed: false,
        signals: [{ code: 'screening_unavailable', severity: 'info', summary: 'x' }],
        hashes: {},
        reason: 'Screening service unreachable',
      });

      const res = await uploadRequest(token).expect(201);

      expect(res.body.artefact.cid).toBeTruthy();
      expect(res.body.artefact.screening.available).toBe(false);
      // Unscreened is not the same as clean, so it is queued rather than
      // silently treated as having passed.
      expect(res.body.artefact.reviewState).toBe('pending');
      // The integrity fields are never empty, even with no screening.
      expect(res.body.artefact.sha256).toBeTruthy();
    });
  });

  describe('reuse of earlier evidence', () => {
    it('links a near-identical artefact to the original and queues review', async () => {
      const first = await uploadRequest(token, {
        file: { buffer: Buffer.from('first evidence') },
      }).expect(201);

      // The screening service reports the second image as perceptually the
      // same as the first - resubmitting an old photograph.
      screening.compare.mockResolvedValue({
        distance: 2,
        verdict: 'near_identical',
      });

      const second = await uploadRequest(token, {
        file: { buffer: Buffer.from('different bytes, same scene') },
      }).expect(201);

      expect(second.body.artefact.duplicateOf).toBe(first.body.artefact._id);
      expect(second.body.artefact.duplicateDistance).toBe(2);
      expect(second.body.artefact.reviewState).toBe('pending');
    });
  });

  describe('authorisation', () => {
    it('rejects an unauthenticated upload', async () => {
      await request(app)
        .post('/api/artefacts')
        .field('kind', 'milestone_evidence')
        .field('tenderAddress', TENDER)
        .attach('file', Buffer.from('x'), {
          filename: 'a.jpg',
          contentType: 'image/jpeg',
        })
        .expect(401);
    });

    it('allows a password session to upload', async () => {
      // Uploading is an off-chain write. Requiring a wallet would defeat the
      // point of decoupling identity from the key.
      await uploadRequest(token).expect(201);
    });

    it('rejects an unsupported file type', async () => {
      await request(app)
        .post('/api/artefacts')
        .set('Authorization', `Bearer ${token}`)
        .field('kind', 'milestone_evidence')
        .field('tenderAddress', TENDER)
        .attach('file', Buffer.from('MZ'), {
          filename: 'evil.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(415);
    });

    it('requires the artefact to reference a tender or contract', async () => {
      await request(app)
        .post('/api/artefacts')
        .set('Authorization', `Bearer ${token}`)
        .field('kind', 'milestone_evidence')
        .attach('file', Buffer.from('x'), {
          filename: 'a.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('keeps the review queue to verifiers', async () => {
      await request(app)
        .get('/api/artefacts/review-queue')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('review', () => {
    it('records a decision without deleting the artefact', async () => {
      screening.screen.mockResolvedValue(screeningResponse({ risk: 70, band: 'high' }));
      const upload = await uploadRequest(token).expect(201);

      const admin = await User.findOne({ email: CREDS.email });
      await User.updateOne({ _id: admin._id }, { $set: { userType: 'admin' } });
      const sessions = require('../services/sessionService');
      await sessions.updateRoleForUser(admin._id, 'admin');

      const res = await request(app)
        .post(`/api/artefacts/${upload.body.artefact.cid}/review`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'rejected', note: 'Photograph predates the milestone' })
        .expect(200);

      expect(res.body.artefact.reviewState).toBe('rejected');
      // Even a rejected submission stays: that it was submitted and refused is
      // itself part of the audit trail.
      expect(await Artefact.countDocuments()).toBe(1);
    });
  });
});
