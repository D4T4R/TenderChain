const request = require('supertest');
const { ethers } = require('ethers');

const { connectDB, disconnectDB } = require('../config/database');
const { connectRedis, disconnectRedis, getRedis, key } = require('../config/redis');
const app = require('../server');
const User = require('../models/User');
const LinkedWallet = require('../models/LinkedWallet');
const RefreshToken = require('../models/RefreshToken');
const sessions = require('../services/sessionService');
const siwe = require('../services/siweService');

const { CAPABILITIES } = sessions;

const CREDS = {
  email: 'session-user@example.com',
  password: 'Correct-Horse-Battery-7',
  phoneNumber: '9876543210',
  fullName: 'Session User',
};

async function registerPasswordUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({ ...CREDS, ...overrides })
    .expect(201);
}

/** Produces a valid SIWE message + signature for a wallet. */
async function signMessage(wallet) {
  const nonceRes = await request(app)
    .post('/api/auth/nonce')
    .send({ walletAddress: wallet.address })
    .expect(200);

  const message = siwe
    .buildMessage({ address: wallet.address, nonce: nonceRes.body.nonce })
    .prepareMessage();

  return { message, signature: await wallet.signMessage(message) };
}

async function flushTestKeys() {
  const redis = getRedis();
  const keys = await redis.keys(key('*'));
  if (keys.length) await redis.del(keys);
}

describe('Redis sessions and capabilities', () => {
  beforeAll(async () => {
    await Promise.all([connectDB(), connectRedis()]);
  }, 60000);

  afterAll(async () => {
    await flushTestKeys();
    await Promise.all([
      User.deleteMany({}),
      LinkedWallet.deleteMany({}),
      RefreshToken.deleteMany({}),
    ]);
    await Promise.all([disconnectDB(), disconnectRedis()]);

    const fileRoutes = require('../routes/fileRoutes');
    if (fileRoutes.documentQueue) await fileRoutes.documentQueue.close();
  });

  beforeEach(async () => {
    await flushTestKeys();
    await Promise.all([
      User.deleteMany({}),
      LinkedWallet.deleteMany({}),
      RefreshToken.deleteMany({}),
    ]);
  });

  describe('capabilities by sign-in method', () => {
    it('grants a password session read and off-chain write, but not on-chain', async () => {
      const { body } = await registerPasswordUser();

      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body.session.capabilities).toEqual(
        expect.arrayContaining([CAPABILITIES.READ, CAPABILITIES.WRITE_OFFCHAIN])
      );
      // The point of the tiering: a wallet is only needed to transact.
      expect(res.body.session.capabilities).not.toContain(
        CAPABILITIES.WRITE_ONCHAIN
      );
      expect(res.body.session.method).toBe('password');
      expect(res.body.session.walletAddress).toBeNull();
    });

    it('grants a wallet session all three, including on-chain', async () => {
      const wallet = ethers.Wallet.createRandom();
      const { message, signature } = await signMessage(wallet);

      const verify = await request(app)
        .post('/api/auth/verify')
        .send({
          message,
          signature,
          profile: {
            email: 'wallet-user@example.com',
            phoneNumber: '9876543211',
            fullName: 'Wallet User',
          },
        })
        .expect(201);

      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${verify.body.accessToken}`)
        .expect(200);

      expect(res.body.session.capabilities).toContain(
        CAPABILITIES.WRITE_ONCHAIN
      );
      expect(res.body.session.walletAddress).toBe(
        wallet.address.toLowerCase()
      );
    });
  });

  describe('step-up', () => {
    it('raises a password session to on-chain without changing the session', async () => {
      const { body } = await registerPasswordUser();

      const before = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      const wallet = ethers.Wallet.createRandom();
      const { message, signature } = await signMessage(wallet);

      const stepUp = await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ message, signature })
        .expect(200);

      expect(stepUp.body.capabilities).toContain(CAPABILITIES.WRITE_ONCHAIN);

      const after = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${stepUp.body.accessToken}`)
        .expect(200);

      // Same session, upgraded - not a new sign-in. This is what a stateless
      // token cannot express.
      expect(after.body.session.sid).toBe(before.body.session.sid);
      expect(after.body.session.createdAt).toBe(before.body.session.createdAt);
      expect(after.body.session.walletAddress).toBe(
        wallet.address.toLowerCase()
      );
    });

    it('links the proven wallet to the account', async () => {
      const { body } = await registerPasswordUser();
      const wallet = ethers.Wallet.createRandom();
      const { message, signature } = await signMessage(wallet);

      await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ message, signature })
        .expect(200);

      const link = await LinkedWallet.findActiveByAddress(wallet.address);
      expect(link).not.toBeNull();
      expect(link.user.toString()).toBe(body.user._id);
    });

    it('refuses a wallet already linked to another account', async () => {
      // First account claims the wallet.
      const wallet = ethers.Wallet.createRandom();
      const first = await signMessage(wallet);
      await request(app)
        .post('/api/auth/verify')
        .send({
          message: first.message,
          signature: first.signature,
          profile: {
            email: 'owner@example.com',
            phoneNumber: '9876543212',
            fullName: 'Wallet Owner',
          },
        })
        .expect(201);

      // A different account then tries to step up with it.
      const { body } = await registerPasswordUser();
      const second = await signMessage(wallet);

      await request(app)
        .post('/api/auth/step-up')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({ message: second.message, signature: second.signature })
        .expect(409);
    });

    it('rejects an unauthenticated step-up', async () => {
      const wallet = ethers.Wallet.createRandom();
      const { message, signature } = await signMessage(wallet);

      await request(app)
        .post('/api/auth/step-up')
        .send({ message, signature })
        .expect(401);
    });
  });

  describe('capability expiry', () => {
    it('drops on-chain capability once the wallet proof goes stale', async () => {
      const wallet = ethers.Wallet.createRandom();
      const { message, signature } = await signMessage(wallet);

      const verify = await request(app)
        .post('/api/auth/verify')
        .send({
          message,
          signature,
          profile: {
            email: 'stale@example.com',
            phoneNumber: '9876543213',
            fullName: 'Stale Proof',
          },
        })
        .expect(201);

      // Backdate the proof rather than waiting out the TTL.
      const redis = getRedis();
      const sid = verify.body.sid;
      const raw = JSON.parse(await redis.get(key('session', sid)));
      raw.walletProvenAt =
        Date.now() - (sessions.ONCHAIN_CAPABILITY_TTL_SECONDS + 60) * 1000;
      await redis.set(key('session', sid), JSON.stringify(raw), {
        KEEPTTL: true,
      });

      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${verify.body.accessToken}`)
        .expect(200);

      // Identity survives; the ability to move value does not.
      expect(res.body.session.capabilities).toContain(CAPABILITIES.READ);
      expect(res.body.session.capabilities).not.toContain(
        CAPABILITIES.WRITE_ONCHAIN
      );
    });
  });

  describe('revocation', () => {
    it('invalidates the access token immediately when the session is revoked', async () => {
      const { body } = await registerPasswordUser();

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      await sessions.revokeSession(body.sid);

      // The JWT is still cryptographically valid and unexpired; the session is
      // gone. That gap is exactly what a stateless token cannot close.
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(401);
    });

    it('ends every session for a user on demand', async () => {
      const { body: first } = await registerPasswordUser();
      const second = await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: CREDS.password })
        .expect(200);

      const list = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(200);
      expect(list.body.sessions.length).toBe(2);

      await sessions.revokeAllForUser(first.user._id);

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .expect(401);
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${second.body.accessToken}`)
        .expect(401);
    });

    it('rejects a token with no session id', async () => {
      // Simulates a token minted before sessions existed. Accepting it would
      // leave an unrevokable credential in circulation.
      const user = await User.create({
        userType: 'contractor',
        email: 'legacy@example.com',
        phoneNumber: '9876543214',
        fullName: 'Legacy Token',
      });
      const tokens = require('../services/tokenService');
      const legacyToken = tokens.signAccessToken(user);

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${legacyToken}`)
        .expect(401);
    });
  });

  describe('role changes propagate to live sessions', () => {
    it('applies a new role without requiring a fresh sign-in', async () => {
      const { body } = await registerPasswordUser();

      await User.updateOne(
        { _id: body.user._id },
        { $set: { userType: 'admin' } }
      );
      await sessions.updateRoleForUser(body.user._id, 'admin');

      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(res.body.session.role).toBe('admin');
    });
  });

  describe('behaviour when Redis is unavailable', () => {
    afterEach(() => jest.restoreAllMocks());

    it('fails closed with 503 rather than serving the request', async () => {
      const { body } = await registerPasswordUser();

      // Without the session we cannot distinguish a live session from a
      // revoked one, so serving the request would mean honouring sessions that
      // were signed out. Refusing is the safe direction.
      jest.spyOn(sessions, 'getSession').mockImplementation(() => {
        const error = new Error('Redis is not available');
        error.code = 'REDIS_UNAVAILABLE';
        throw error;
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`);

      expect(res.status).toBe(503);
      // Notably not 200, and not 401 either: the caller's credentials are fine,
      // the server just cannot check them right now.
      expect(res.body.error).toMatch(/unavailable/i);
    });
  });

  describe('session listing', () => {
    it('marks which session is the current one', async () => {
      const { body } = await registerPasswordUser();

      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      const current = res.body.sessions.find((s) => s.current);
      expect(current.sid).toBe(body.sid);
    });
  });
});
