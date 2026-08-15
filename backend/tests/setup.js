/**
 * Jest setup. Points the suite at a throwaway database.
 *
 * Set MONGODB_TEST_URI to run against your own mongod; otherwise the default
 * assumes a local instance on 27017.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/tenderchain_test';

// Auth config. A real secret is required: tokenService refuses the example
// placeholder and anything under 32 characters.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-only-secret-value-at-least-32-chars-long';
process.env.SIWE_DOMAIN = process.env.SIWE_DOMAIN || 'localhost:3002';
process.env.SIWE_URI = process.env.SIWE_URI || 'http://localhost:3002';
process.env.SIWE_CHAIN_ID = process.env.SIWE_CHAIN_ID || '1337';
// The auth rate limiter would otherwise trip partway through the suite.
process.env.AUTH_RATE_LIMIT_MAX = '10000';

// Keep test output readable - the winston console transport is noisy here.
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() },
}));
