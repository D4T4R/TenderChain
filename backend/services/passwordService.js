const bcrypt = require('bcryptjs');

/**
 * Password hashing and policy.
 *
 * Passwords are optional on an account: a user created through SIWE has no
 * password, and a password user may never link a wallet. Both are valid.
 */

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 12);
const MAX_LENGTH = 200; // bcrypt truncates at 72 bytes; reject long input early

/**
 * A dummy hash of a random value, used to spend the same work on a login
 * attempt for an account that does not exist. Without this, a missing user
 * returns in microseconds while a real one takes ~100ms of bcrypt, which is a
 * reliable account-enumeration oracle.
 */
const DUMMY_HASH = bcrypt.hashSync('password-that-is-never-valid', BCRYPT_ROUNDS);

const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456789012', 'qwertyuiop12',
  'administrator', 'letmein12345', 'welcome12345', 'tenderchain',
]);

class PasswordPolicyError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = 'PasswordPolicyError';
    this.statusCode = 400;
    this.details = failures;
  }
}

/**
 * Validates a candidate password. Throws PasswordPolicyError listing every
 * failure, so the UI can show them all rather than one at a time.
 */
function assertPolicy(password, { email, fullName } = {}) {
  const failures = [];

  if (typeof password !== 'string' || password.length === 0) {
    throw new PasswordPolicyError('Password is required', [
      { field: 'password', message: 'Password is required' },
    ]);
  }

  if (password.length < MIN_LENGTH) {
    failures.push({
      field: 'password',
      message: `Must be at least ${MIN_LENGTH} characters`,
    });
  }
  if (password.length > MAX_LENGTH) {
    failures.push({
      field: 'password',
      message: `Must be at most ${MAX_LENGTH} characters`,
    });
  }

  // Length is the dominant factor, so complexity rules are kept light: require
  // some variety rather than a rigid class-count that pushes people to
  // "Password1!".
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (classes < 2) {
    failures.push({
      field: 'password',
      message: 'Must mix at least two of: lowercase, uppercase, digits, symbols',
    });
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    failures.push({ field: 'password', message: 'This password is too common' });
  }

  // Reject passwords derived from the user's own identifiers.
  const localPart = email ? String(email).split('@')[0] : '';
  for (const personal of [localPart, fullName]) {
    if (
      personal &&
      personal.length >= 4 &&
      password.toLowerCase().includes(String(personal).toLowerCase())
    ) {
      failures.push({
        field: 'password',
        message: 'Must not contain your name or email',
      });
      break;
    }
  }

  if (failures.length) {
    throw new PasswordPolicyError('Password does not meet requirements', failures);
  }
}

function hash(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compares a password against a stored hash.
 *
 * Pass a null/undefined hash for a user that does not exist or has no password:
 * the comparison still runs against a dummy hash so the timing is
 * indistinguishable.
 */
async function verify(password, storedHash) {
  const candidate = typeof password === 'string' ? password : '';
  if (!storedHash) {
    await bcrypt.compare(candidate, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(candidate, storedHash);
}

module.exports = {
  assertPolicy,
  hash,
  verify,
  PasswordPolicyError,
  MIN_LENGTH,
  BCRYPT_ROUNDS,
};
