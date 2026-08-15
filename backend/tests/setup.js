/**
 * Jest setup. Points the suite at a throwaway database.
 *
 * Set MONGODB_TEST_URI to run against your own mongod; otherwise the default
 * assumes a local instance on 27017.
 */
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/tenderchain_test';

// Keep test output readable - the winston console transport is noisy here.
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() },
}));
