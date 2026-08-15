const {
  errorHandler,
  notFound,
  HttpError,
} = require('../middleware/errorMiddleware');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const req = { method: 'GET', originalUrl: '/api/thing' };

describe('errorMiddleware', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('returns 404 for notFound', () => {
    // Regression: notFound used to call res.status(404) then pass an error with
    // no statusCode, so errorHandler fell through to 500.
    let forwarded;
    notFound(req, mockRes(), (err) => {
      forwarded = err;
    });

    const res = mockRes();
    errorHandler(forwarded, req, res, () => {});

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/Not Found/);
  });

  it('maps a duplicate key violation to 409', () => {
    const err = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000,
      keyPattern: { tenderAddress: 1 },
    });

    const res = mockRes();
    errorHandler(err, req, res, () => {});

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toMatch(/tenderAddress/);
  });

  it('maps a validation error to 400 with field details', () => {
    const err = Object.assign(new Error('validation failed'), {
      name: 'ValidationError',
      errors: {
        walletAddress: { path: 'walletAddress', message: 'Invalid address' },
      },
    });

    const res = mockRes();
    errorHandler(err, req, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body.details).toEqual([
      { field: 'walletAddress', message: 'Invalid address' },
    ]);
  });

  it('maps a cast error to 400', () => {
    const err = Object.assign(new Error('cast failed'), {
      name: 'CastError',
      path: 'id',
    });

    const res = mockRes();
    errorHandler(err, req, res, () => {});

    expect(res.statusCode).toBe(400);
  });

  it('honours an explicit HttpError status', () => {
    const res = mockRes();
    errorHandler(new HttpError(403, 'Forbidden'), req, res, () => {});

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('does not leak internal detail on a 500', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    errorHandler(
      new Error('connect mongodb://user:pass@internal-host failed'),
      req,
      res,
      () => {}
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toMatch(/internal-host/);
    expect(res.body.stack).toBeUndefined();
  });

  it('includes a stack trace in development', () => {
    process.env.NODE_ENV = 'development';
    const res = mockRes();
    errorHandler(new Error('boom'), req, res, () => {});

    expect(res.body.stack).toBeDefined();
  });
});
