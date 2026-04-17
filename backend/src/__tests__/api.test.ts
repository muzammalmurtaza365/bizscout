import request from 'supertest';
import { createApp } from '../app';
import { ResponseModel } from '../models/Response';

const app = createApp();

describe('health endpoints', () => {
  it('GET /health returns ok (back-compat)', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('GET /health/live returns ok', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready returns ok when Mongo is connected', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.mongo.state).toBe('connected');
    expect(res.body.checks.mongo.ping).toBe('ok');
  });
});

describe('GET /api/responses', () => {
  it('returns empty list when no data', async () => {
    const res = await request(app).get('/api/responses');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextCursor).toBeNull();
  });

  it('respects limit and returns cursor', async () => {
    await ResponseModel.insertMany(
      Array.from({ length: 5 }, (_, i) => ({
        url: 'https://httpbin.org/anything',
        method: 'POST',
        status: 200,
        ok: true,
        responseTimeMs: 100 + i,
        responseSizeBytes: 50,
      })),
    );

    const res = await request(app).get('/api/responses?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextCursor).toBeTruthy();
  });

  it('supports onlyAnomalies filter', async () => {
    await ResponseModel.create({
      url: 'x',
      method: 'POST',
      status: 200,
      ok: true,
      responseTimeMs: 100,
      responseSizeBytes: 50,
      isAnomaly: false,
    });
    await ResponseModel.create({
      url: 'x',
      method: 'POST',
      status: 200,
      ok: true,
      responseTimeMs: 9999,
      responseSizeBytes: 50,
      isAnomaly: true,
    });

    const res = await request(app).get('/api/responses?onlyAnomalies=true');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].isAnomaly).toBe(true);
  });

  it('rejects bad cursor', async () => {
    const res = await request(app).get('/api/responses?cursor=not-an-objectid');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/responses/:id', () => {
  it('returns 404 for missing doc', async () => {
    const res = await request(app).get('/api/responses/507f1f77bcf86cd799439011');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid id', async () => {
    const res = await request(app).get('/api/responses/bogus');
    expect(res.status).toBe(400);
  });

  it('returns the document when found', async () => {
    const doc = await ResponseModel.create({
      url: 'x',
      method: 'POST',
      status: 200,
      ok: true,
      responseTimeMs: 150,
      responseSizeBytes: 50,
    });
    const res = await request(app).get(`/api/responses/${doc._id}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(doc._id.toString());
  });
});

describe('GET /api/stats', () => {
  it('returns zero-ish stats when empty', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.anomalyCount).toBe(0);
  });

  it('returns aggregated stats', async () => {
    await ResponseModel.insertMany([
      { url: 'x', method: 'POST', status: 200, ok: true, responseTimeMs: 100, responseSizeBytes: 1 },
      { url: 'x', method: 'POST', status: 200, ok: true, responseTimeMs: 200, responseSizeBytes: 1 },
      { url: 'x', method: 'POST', status: 200, ok: true, responseTimeMs: 300, responseSizeBytes: 1, isAnomaly: true },
    ]);
    const res = await request(app).get('/api/stats?window=24h');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
    expect(res.body.mean).toBe(200);
    expect(res.body.anomalyCount).toBe(1);
  });

  it('rejects invalid window', async () => {
    const res = await request(app).get('/api/stats?window=bogus');
    expect(res.status).toBe(400);
  });
});

describe('GET /metrics', () => {
  it('exposes Prometheus-format metrics', async () => {
    // Trigger at least one observed request so http_requests_total appears.
    await request(app).get('/health/live');

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('bizscout_pings_total');
    expect(res.text).toContain('process_cpu_user_seconds_total'); // default metric
  });

  it('labels routes without expanding cardinality on :id', async () => {
    await request(app).get('/api/responses/507f1f77bcf86cd799439011');
    await request(app).get('/api/responses/507f1f77bcf86cd799439012');
    const res = await request(app).get('/metrics');
    // Both requests should share the same route label `/api/responses/:id`
    const hits = res.text.match(/route="\/api\/responses\/:id"/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });
});
