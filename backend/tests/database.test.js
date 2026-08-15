const mongoose = require('mongoose');
const {
  connectDB,
  disconnectDB,
  isConnected,
  redactUri,
} = require('../config/database');

describe('database connection layer', () => {
  afterEach(async () => {
    await disconnectDB();
  });

  describe('redactUri', () => {
    it('strips credentials from a connection string', () => {
      expect(redactUri('mongodb+srv://alice:s3cret@cluster0.example.net/db')).toBe(
        'mongodb+srv://***@cluster0.example.net/db'
      );
    });

    it('leaves a credential-free URI untouched', () => {
      expect(redactUri('mongodb://127.0.0.1:27017/tenderchain')).toBe(
        'mongodb://127.0.0.1:27017/tenderchain'
      );
    });

    it('handles an unset URI', () => {
      expect(redactUri(undefined)).toBe('(unset)');
    });
  });

  it('connects and reports connection state', async () => {
    await connectDB();
    expect(isConnected()).toBe(true);
  });

  it('applies the configured pool bounds rather than the driver defaults', async () => {
    await connectDB();
    const options = mongoose.connection.getClient().options;
    expect(options.maxPoolSize).toBe(20);
    expect(options.minPoolSize).toBe(2);
  });

  it('closes cleanly and is safe to call twice', async () => {
    await connectDB();
    await disconnectDB();
    expect(isConnected()).toBe(false);
    await expect(disconnectDB()).resolves.toBeUndefined();
  });

  it('throws rather than exiting the process when the server is unreachable', async () => {
    // Port 1 is reserved and refuses immediately. Retry budget is kept small so
    // the test does not sit through the production backoff schedule.
    await expect(
      connectDB({
        uri: 'mongodb://127.0.0.1:1/nope',
        retries: 2,
        baseDelayMs: 10,
        serverSelectionTimeoutMS: 300,
      })
    ).rejects.toThrow();
    expect(isConnected()).toBe(false);
  });

  it('retries the configured number of times before giving up', async () => {
    const logger = require('../utils/logger');
    logger.warn.mockClear();

    await expect(
      connectDB({
        uri: 'mongodb://127.0.0.1:1/nope',
        retries: 3,
        baseDelayMs: 10,
        serverSelectionTimeoutMS: 300,
      })
    ).rejects.toThrow();

    // One warning per failed attempt except the last, which logs an error.
    const retryWarnings = logger.warn.mock.calls.filter(([msg]) =>
      /connection attempt/.test(msg)
    );
    expect(retryWarnings).toHaveLength(2);
  });
});
