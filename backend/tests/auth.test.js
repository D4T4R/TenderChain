const request = require('supertest');
const { ethers } = require('ethers');

const { connectDB, disconnectDB } = require('../config/database');
const { connectRedis, disconnectRedis, getRedis, key } = require('../config/redis');
const app = require('../server');
const User = require('../models/User');
const AuthNonce = require('../models/AuthNonce');
const RefreshToken = require('../models/RefreshToken');
const LinkedWallet = require('../models/LinkedWallet');
const siwe = require('../services/siweService');
const tokens = require('../services/tokenService');

const wallet = ethers.Wallet.createRandom();
const otherWallet = ethers.Wallet.createRandom();

const PROFILE = {
  email: 'siwe-user@example.com',
  phoneNumber: '9876543210',
  fullName: 'SIWE User',
};

/** Requests a nonce and returns a signed SIWE message for the given wallet. */
async function signIn(signer = wallet, { profile = PROFILE } = {}) {
  const nonceRes = await request(app)
    .post('/api/auth/nonce')
    .send({ walletAddress: signer.address })
    .expect(200);

  const message = siwe
    .buildMessage({ address: signer.address, nonce: nonceRes.body.nonce })
    .prepareMessage();

  const signature = await signer.signMessage(message);

  return { message, signature, nonce: nonceRes.body.nonce, profile };
}

async function authenticate(signer = wallet) {
  const { message, signature, profile } = await signIn(signer);
  const res = await request(app)
    .post('/api/auth/verify')
    .send({ message, signature, profile });
  return res;
}

describe('SIWE authentication', () => {
  beforeAll(async () => {
    await Promise.all([connectDB(), connectRedis()]);
  }, 60000);

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}),
      AuthNonce.deleteMany({}),
      RefreshToken.deleteMany({}),
      LinkedWallet.deleteMany({}),
    ]);
    const keys = await getRedis().keys(key('*'));
    if (keys.length) await getRedis().del(keys);
    await Promise.all([disconnectDB(), disconnectRedis()]);

    // Requiring the app pulls in fileRoutes, which opens a Bull/Redis
    // connection at import time. Without closing it the process never exits.
    const fileRoutes = require('../routes/fileRoutes');
    if (fileRoutes.documentQueue) await fileRoutes.documentQueue.close();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      AuthNonce.deleteMany({}),
      RefreshToken.deleteMany({}),
      LinkedWallet.deleteMany({}),
    ]);
  });

  describe('nonce issuance', () => {
    it('issues a nonce bound to the requested address', async () => {
      const res = await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress: wallet.address })
        .expect(200);

      expect(res.body.nonce).toEqual(expect.any(String));
      expect(res.body.domain).toBe(siwe.EXPECTED_DOMAIN);

      const stored = await AuthNonce.findOne({ nonce: res.body.nonce });
      expect(stored.walletAddress).toBe(wallet.address.toLowerCase());
      expect(stored.consumedAt).toBeNull();
    });

    it('rejects a malformed address', async () => {
      await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress: 'nope' })
        .expect(400);
    });
  });

  describe('signature verification', () => {
    it('creates a user and issues tokens on first sign-in', async () => {
      const res = await authenticate();

      expect(res.status).toBe(201);
      expect(res.body.created).toBe(true);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      // walletAddress no longer lives on the user; wallets are listed separately.
      expect(res.body.user.walletAddress).toBeUndefined();
      expect(res.body.wallets.map((w) => w.address)).toContain(
        wallet.address.toLowerCase()
      );
      expect(res.body.walletAddress).toBe(wallet.address.toLowerCase());
    });

    it('signs an existing user in without recreating them', async () => {
      await authenticate();
      const second = await authenticate();

      expect(second.status).toBe(200);
      expect(second.body.created).toBe(false);
      expect(await User.countDocuments()).toBe(1);
    });

    it('requires profile fields only on first sign-in', async () => {
      const { message, signature } = await signIn();
      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature })
        .expect(400);
    });

    // --- attack cases ---

    it('rejects a replayed signature (nonce is single-use)', async () => {
      const { message, signature, profile } = await signIn();

      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature, profile })
        .expect(201);

      // Same message and signature presented again.
      const replay = await request(app)
        .post('/api/auth/verify')
        .send({ message, signature, profile });

      expect(replay.status).toBe(401);
      expect(replay.body.error).toMatch(/nonce/i);
    });

    it('rejects a signature from a different wallet than the message claims', async () => {
      const nonceRes = await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress: wallet.address })
        .expect(200);

      // Message claims `wallet`, but `otherWallet` signs it.
      const message = siwe
        .buildMessage({ address: wallet.address, nonce: nonceRes.body.nonce })
        .prepareMessage();
      const signature = await otherWallet.signMessage(message);

      const res = await request(app)
        .post('/api/auth/verify')
        .send({ message, signature, profile: PROFILE });

      expect(res.status).toBe(401);
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejects a nonce that was never issued', async () => {
      const message = siwe
        .buildMessage({
          address: wallet.address,
          nonce: 'aaaaaaaaaaaaaaaa',
        })
        .prepareMessage();
      const signature = await wallet.signMessage(message);

      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature, profile: PROFILE })
        .expect(401);
    });

    it('rejects a nonce issued for a different address', async () => {
      // Nonce issued to otherWallet...
      const nonceRes = await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress: otherWallet.address })
        .expect(200);

      // ...but used in a message from `wallet`, correctly signed by it.
      const message = siwe
        .buildMessage({ address: wallet.address, nonce: nonceRes.body.nonce })
        .prepareMessage();
      const signature = await wallet.signMessage(message);

      await request(app)
        .post('/api/auth/verify')
        .send({ message, signature, profile: PROFILE })
        .expect(401);
    });

    it('rejects a tampered message body', async () => {
      const { message, signature, profile } = await signIn();
      const tampered = message.replace(
        'Sign in to TenderChain',
        'Transfer everything'
      );

      await request(app)
        .post('/api/auth/verify')
        .send({ message: tampered, signature, profile })
        .expect(401);
    });

    it('does not let a client assign itself the admin role... unless first sign-in', async () => {
      // Documented behaviour: userType is honoured only at creation. This test
      // pins that it is NOT changeable on a later sign-in.
      await authenticate();

      const { message, signature } = await signIn();
      await request(app)
        .post('/api/auth/verify')
        .send({
          message,
          signature,
          profile: { ...PROFILE, userType: 'admin' },
        })
        .expect(200);

      const user = await User.findByWallet(wallet.address);
      expect(user.userType).toBe('contractor');
    });
  });

  describe('token lifecycle', () => {
    it('accepts the access token on a protected route', async () => {
      const { body } = await authenticate();

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);

      expect(me.body.user._id).toBe(body.user._id);
    });

    it('rejects a protected route without a token', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });

    it('rejects a tampered access token', async () => {
      const { body } = await authenticate();
      const parts = body.accessToken.split('.');
      const forged = `${parts[0]}.${parts[1]}.${'x'.repeat(parts[2].length)}`;

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
    });

    it('rejects an unsigned (alg:none) token', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: '000000000000000000000000', role: 'admin' })
      ).toString('base64url');

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${header}.${payload}.`)
        .expect(401);
    });

    it('rotates the refresh token and invalidates the old one', async () => {
      const { body } = await authenticate();

      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      expect(refreshed.body.refreshToken).not.toBe(body.refreshToken);

      // The original token is now spent.
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const { body } = await authenticate();

      const first = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      // Attacker replays the original, already-rotated token.
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);

      // The legitimate successor is now dead too - reuse means the family is
      // compromised and everyone must sign in again.
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(401);
    });

    it('stores only a hash of the refresh token', async () => {
      const { body } = await authenticate();

      const stored = await RefreshToken.findOne({
        tokenHash: tokens.hashToken(body.refreshToken),
      });
      expect(stored).not.toBeNull();

      // The raw value must not be present anywhere in the document.
      expect(JSON.stringify(stored.toObject())).not.toContain(body.refreshToken);
    });

    it('logs out by revoking the presented refresh token', async () => {
      const { body } = await authenticate();

      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(401);
    });

    it('refuses to issue tokens with a placeholder secret', () => {
      const original = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'your_super_secret_jwt_key_here';

      expect(() =>
        tokens.signAccessToken({
          _id: '000000000000000000000000',
          walletAddress: wallet.address,
          userType: 'admin',
        })
      ).toThrow(/placeholder/i);

      process.env.JWT_SECRET = original;
    });

    it('refuses a short secret', () => {
      const original = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'tooshort';

      expect(() =>
        tokens.signAccessToken({
          _id: '000000000000000000000000',
          walletAddress: wallet.address,
          userType: 'admin',
        })
      ).toThrow(/32 characters/);

      process.env.JWT_SECRET = original;
    });
  });

  describe('role enforcement', () => {
    it('refuses summary deletion without authentication', async () => {
      // Regression: this endpoint used to accept any non-empty adminAddress in
      // the body, so anyone could delete any summary.
      await request(app)
        .delete('/api/files/summary/000000000000000000000000')
        .send({ adminAddress: '0xdeadbeef' })
        .expect(401);
    });

    it('refuses summary deletion for a non-admin', async () => {
      const { body } = await authenticate();

      await request(app)
        .delete('/api/files/summary/000000000000000000000000')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(403);
    });

    it('refuses the admin user list for a non-admin', async () => {
      const { body } = await authenticate();

      await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(403);
    });

    it('allows the admin user list for an admin', async () => {
      const { body } = await authenticate();
      const admin = await User.findByWallet(wallet.address);
      await User.updateOne({ _id: admin._id }, { $set: { userType: 'admin' } });
      // Authorisation reads the role from the session, so writing the document
      // alone is not enough - the admin route does this via
      // sessions.updateRoleForUser, and a direct DB edit has to as well.
      const sessionService = require('../services/sessionService');
      await sessionService.updateRoleForUser(admin._id, 'admin');

      // Existing token still carries the old role, so re-authenticate.
      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: body.refreshToken })
        .expect(200);

      await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
        .expect(200);
    });
  });

  describe('profile updates', () => {
    it('does not allow self-assignment of privilege fields', async () => {
      const { body } = await authenticate();

      await request(app)
        .patch('/api/user/profile')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .send({
          fullName: 'Renamed',
          userType: 'admin',
          kycStatus: 'approved',
          walletAddress: otherWallet.address,
        })
        .expect(200);

      const user = await User.findByWallet(wallet.address);
      expect(user.fullName).toBe('Renamed');
      expect(user.userType).toBe('contractor');
      expect(user.kycStatus).toBe('pending');
      // The wallet link is untouched by a profile edit.
      const link = await LinkedWallet.findActiveByAddress(wallet.address);
      expect(link.user.toString()).toBe(user._id.toString());
    });
  });
});
