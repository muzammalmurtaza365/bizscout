import request from 'supertest';
import { createApp } from '../app';
import { apiKeyAuth } from '../middleware/auth';

const TEST_KEY = 'test-secret-key-0123456789';
const app = createApp({ apiKey: TEST_KEY });

describe('apiKeyAuth middleware (unit)', () => {
  it('is a no-op when no key is configured', (done) => {
    const mw = apiKeyAuth(undefined);
    const next = jest.fn();
    mw(
      { header: () => undefined } as never,
      {
        status: () => {
          throw new Error('status should not be called');
        },
      } as never,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    done();
  });
});

describe('API auth (integration)', () => {
  it('rejects missing header with 401 on /api/*', async () => {
    const res = await request(app).get('/api/responses');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('rejects wrong key with 403', async () => {
    const res = await request(app).get('/api/responses').set('x-api-key', 'wrong');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('accepts correct key', async () => {
    const res = await request(app).get('/api/responses').set('x-api-key', TEST_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('accepts correct key regardless of header casing', async () => {
    const res = await request(app).get('/api/responses').set('X-API-KEY', TEST_KEY);
    expect(res.status).toBe(200);
  });

  it('protects /metrics with the same key', async () => {
    const bad = await request(app).get('/metrics');
    expect(bad.status).toBe(401);
    const good = await request(app).get('/metrics').set('x-api-key', TEST_KEY);
    expect(good.status).toBe(200);
    expect(good.text).toContain('http_requests_total');
  });

  it('leaves /health public (liveness/readiness probes must not need auth)', async () => {
    const res1 = await request(app).get('/health');
    expect(res1.status).toBe(200);
    const res2 = await request(app).get('/health/live');
    expect(res2.status).toBe(200);
  });

  it('timing-safe compare: different-length wrong key still returns 403 (not 500)', async () => {
    const res = await request(app).get('/api/responses').set('x-api-key', 'x');
    expect(res.status).toBe(403);
  });
});
