const request = require('supertest');
const mongoose = require('mongoose');

const { connectDB, disconnectDB } = require('../config/database');
const { connectRedis, disconnectRedis, getRedis, key } = require('../config/redis');
const app = require('../server');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const LinkedWallet = require('../models/LinkedWallet');
const passwords = require('../services/passwordService');
const mail = require('../services/mailService');

// The duplicate-email check relies on the unique index from the initial
// migration, so this suite has to apply it rather than assuming a database
// somebody else already migrated.
const baseIndexes = require('../migrations/20260815000000-initial-indexes');
const walletMigration = require('../migrations/20260815020000-decouple-wallet-from-user');
const migration = require('../migrations/20260815030000-password-credentials');

const GOOD_PASSWORD = 'Correct-Horse-Battery-7';
const CREDS = {
  email: 'pw-user@example.com',
  password: GOOD_PASSWORD,
  phoneNumber: '9876543210',
  fullName: 'Password User',
};

function registerBody(overrides = {}) {
  return { ...CREDS, ...overrides };
}

async function registerUser(overrides = {}) {
  return request(app).post('/api/auth/register').send(registerBody(overrides));
}

describe('password authentication', () => {
  beforeAll(async () => {
    await Promise.all([connectDB(), connectRedis()]);
    await baseIndexes.up(mongoose.connection.db);
    await walletMigration.up(mongoose.connection.db);
    await migration.up(mongoose.connection.db);
  }, 60000);

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({}),
      RefreshToken.deleteMany({}),
      PasswordResetToken.deleteMany({}),
      LinkedWallet.deleteMany({}),
    ]);
    const keys = await getRedis().keys(key('*'));
    if (keys.length) await getRedis().del(keys);
    await Promise.all([disconnectDB(), disconnectRedis()]);
    const fileRoutes = require('../routes/fileRoutes');
    if (fileRoutes.documentQueue) await fileRoutes.documentQueue.close();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      RefreshToken.deleteMany({}),
      PasswordResetToken.deleteMany({}),
      LinkedWallet.deleteMany({}),
    ]);
  });

  describe('registration', () => {
    it('creates an account with no wallet and issues a session', async () => {
      const res = await registerUser();

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.wallets).toEqual([]);
      // The whole point: a usable identity with no wallet.
      expect(res.body.walletAddress).toBeNull();
    });

    it('never returns the password hash', async () => {
      const res = await registerUser();
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('$2a$');
      expect(JSON.stringify(res.body)).not.toContain('$2b$');
    });

    it('issues a session with no wallet claim', async () => {
      const { body } = await registerUser();
      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
      expect(me.body.user.email).toBe(CREDS.email);
    });

    it('refuses on-chain actions for a password-only session', async () => {
      const { body } = await registerUser();
      // Uses an admin-gated route to prove the session works but is not
      // wallet-capable; on-chain gating itself is covered in onChainRole tests.
      await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(403);
    });

    it('rejects a duplicate email', async () => {
      await registerUser();
      const second = await registerUser({ fullName: 'Someone Else' });
      expect(second.status).toBe(409);
    });

    it('refuses to self-assign a privileged role', async () => {
      for (const userType of ['admin', 'government_officer', 'verifier']) {
        const res = await registerUser({
          email: `${userType}@example.com`,
          userType,
        });
        expect(res.status).toBe(403);
      }
      expect(await User.countDocuments()).toBe(0);
    });

    it('allows self-assigning the non-privileged roles', async () => {
      const res = await registerUser({
        email: 'pv@example.com',
        userType: 'public_verifier',
      });
      expect(res.status).toBe(201);
      expect(res.body.user.userType).toBe('public_verifier');
    });
  });

  describe('password policy', () => {
    it.each([
      ['too short', 'Ab1-xyz'],
      ['single character class', 'aaaaaaaaaaaaaaaa'],
      ['a common password', 'password123'],
    ])('rejects %s', async (_label, password) => {
      const res = await registerUser({ password });
      expect(res.status).toBe(400);
      expect(res.body.details?.length).toBeGreaterThan(0);
    });

    it('rejects a password containing the email local-part', async () => {
      const res = await registerUser({
        email: 'jonathan@example.com',
        password: 'jonathan-Secret-1',
      });
      expect(res.status).toBe(400);
    });

    it('reports every failure at once rather than one at a time', () => {
      try {
        passwords.assertPolicy('short', { email: 'a@b.com' });
        throw new Error('should have thrown');
      } catch (err) {
        expect(err.name).toBe('PasswordPolicyError');
        expect(err.details.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await registerUser();
    });

    it('signs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: GOOD_PASSWORD })
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
    });

    it('is case-insensitive on the email', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'PW-USER@EXAMPLE.COM', password: GOOD_PASSWORD })
        .expect(200);
    });

    it('gives the same answer for a wrong password and an unknown account', async () => {
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: 'Wrong-Password-123' });

      const unknownAccount = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'Wrong-Password-123' });

      // Any difference here is an account-enumeration oracle.
      expect(wrongPassword.status).toBe(401);
      expect(unknownAccount.status).toBe(401);
      expect(wrongPassword.body.error).toBe(unknownAccount.body.error);
    });

    it('does not let a SIWE-only account be logged into with any password', async () => {
      const siweOnly = await User.create({
        userType: 'contractor',
        email: 'siwe-only@example.com',
        phoneNumber: '9876543211',
        fullName: 'Siwe Only',
      });
      expect(siweOnly.passwordHash).toBeNull();

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'siwe-only@example.com', password: '' })
        .expect(400);

      await request(app)
        .post('/api/auth/login')
        .send({ email: 'siwe-only@example.com', password: GOOD_PASSWORD })
        .expect(401);
    });

    it('locks the account after repeated failures, then refuses even the right password', async () => {
      const max = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);

      for (let i = 0; i < max; i += 1) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: CREDS.email, password: 'Wrong-Password-123' })
          .expect(401);
      }

      const locked = await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: GOOD_PASSWORD });

      expect(locked.status).toBe(423);
    });

    it('clears the failure count after a successful login', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: 'Wrong-Password-123' })
        .expect(401);

      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: GOOD_PASSWORD })
        .expect(200);

      const user = await User.findByEmailWithSecrets(CREDS.email);
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('refuses a deactivated account', async () => {
      await User.updateOne(
        { email: CREDS.email },
        { $set: { isActive: false } }
      );
      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: GOOD_PASSWORD })
        .expect(403);
    });
  });

  describe('change password', () => {
    let accessToken;

    beforeEach(async () => {
      const res = await registerUser();
      accessToken = res.body.accessToken;
    });

    it('requires the current password', async () => {
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'Wrong-Password-123', newPassword: 'Brand-New-Pass-9' })
        .expect(401);
    });

    it('changes the password and revokes other sessions', async () => {
      // A second session that must not survive the change.
      const other = await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: GOOD_PASSWORD })
        .expect(200);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: GOOD_PASSWORD, newPassword: 'Brand-New-Pass-9' })
        .expect(200);

      expect(res.body.revokedSessions).toBeGreaterThan(0);

      // The other session's refresh token is dead.
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: other.body.refreshToken })
        .expect(401);

      // Old password no longer works, new one does.
      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: GOOD_PASSWORD })
        .expect(401);
      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: 'Brand-New-Pass-9' })
        .expect(200);
    });

    it('enforces the policy on the new password', async () => {
      await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: GOOD_PASSWORD, newPassword: 'short' })
        .expect(400);
    });
  });

  describe('forgot / reset password', () => {
    let sent;

    beforeEach(async () => {
      await registerUser();
      sent = [];
      jest.spyOn(mail, 'sendPasswordReset').mockImplementation(async (args) => {
        sent.push(args);
        return { delivered: true };
      });
    });

    afterEach(() => jest.restoreAllMocks());

    it('answers identically for a known and an unknown address', async () => {
      const known = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email });

      const unknown = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual(unknown.body);
      // Only the real address actually got mail.
      expect(sent).toHaveLength(1);
    });

    it('does not leak account existence through response time', async () => {
      // Regression: the handler used to await the SMTP send, so a real address
      // paid the full handshake (~2100ms against a failing server) while an
      // unknown one returned in ~1ms. Identical response bodies did not matter.
      jest.restoreAllMocks();
      jest.spyOn(mail, 'sendPasswordReset').mockImplementation(async () => {
        // Stand in for a slow or unreachable mail server.
        await new Promise((r) => setTimeout(r, 600));
        return { delivered: true };
      });

      const time = async (email) => {
        const started = Date.now();
        await request(app).post('/api/auth/forgot-password').send({ email });
        return Date.now() - started;
      };

      const known = await time(CREDS.email);
      const unknown = await time('nobody@example.com');

      // The send must not be on the response path at all.
      expect(Math.abs(known - unknown)).toBeLessThan(300);
    });

    it('stores only a hash of the reset token', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email })
        .expect(202);

      const token = new URL(sent[0].resetUrl).searchParams.get('token');
      const record = await PasswordResetToken.findOne({});

      expect(record.tokenHash).not.toBe(token);
      expect(JSON.stringify(record.toObject())).not.toContain(token);
    });

    it('resets the password and invalidates the link', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email });
      const token = new URL(sent[0].resetUrl).searchParams.get('token');

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Reset-Password-42' })
        .expect(200);

      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: 'Reset-Password-42' })
        .expect(200);

      // Single use.
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Another-Password-42' })
        .expect(400);
    });

    it('invalidates an earlier link when a new one is requested', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email });
      const firstToken = new URL(sent[0].resetUrl).searchParams.get('token');

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email });

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: firstToken, newPassword: 'Reset-Password-42' })
        .expect(400);
    });

    it('rejects an expired link', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email });
      const token = new URL(sent[0].resetUrl).searchParams.get('token');

      await PasswordResetToken.updateMany(
        {},
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Reset-Password-42' })
        .expect(400);
    });

    it('rejects a forged token', async () => {
      await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'not-a-real-token', newPassword: 'Reset-Password-42' })
        .expect(400);
    });

    it('clears a lockout, since the owner proved control of the mailbox', async () => {
      const max = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
      for (let i = 0; i < max; i += 1) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: CREDS.email, password: 'Wrong-Password-123' });
      }

      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: CREDS.email });
      const token = new URL(sent[0].resetUrl).searchParams.get('token');

      await request(app)
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'Reset-Password-42' })
        .expect(200);

      await request(app)
        .post('/api/auth/login')
        .send({ email: CREDS.email, password: 'Reset-Password-42' })
        .expect(200);
    });
  });
});
