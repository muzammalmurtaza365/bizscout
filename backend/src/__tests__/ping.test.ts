import nock from 'nock';
import { runPing, generateRandomPayload } from '../services/ping';
import { ResponseModel } from '../models/Response';
import * as socket from '../sockets/server';

const TARGET = 'https://httpbin.org';

describe('generateRandomPayload', () => {
  it('returns an object with expected keys', () => {
    const p = generateRandomPayload();
    expect(p).toHaveProperty('requestId');
    expect(p).toHaveProperty('user');
    expect(p).toHaveProperty('event');
    expect(p).toHaveProperty('metadata');
  });

  it('generates unique payloads', () => {
    const a = generateRandomPayload() as { requestId: string };
    const b = generateRandomPayload() as { requestId: string };
    expect(a.requestId).not.toBe(b.requestId);
  });
});

describe('runPing integration', () => {
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    nock.cleanAll();
    emitSpy = jest.spyOn(socket, 'emitResponse').mockImplementation(() => {});
  });

  afterEach(() => {
    emitSpy.mockRestore();
    nock.cleanAll();
  });

  it('persists a successful ping and emits response:new', async () => {
    nock(TARGET)
      .post('/anything')
      .reply(200, { echoed: true, args: {}, json: { x: 1 } });

    const result = await runPing();

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);

    const persisted = await ResponseModel.findById(result.id).lean();
    expect(persisted).not.toBeNull();
    expect(persisted!.status).toBe(200);
    expect(persisted!.ok).toBe(true);
    expect(persisted!.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(persisted!.responseSizeBytes).toBeGreaterThan(0);

    expect(emitSpy).toHaveBeenCalledWith('response:new', expect.objectContaining({ status: 200 }));
  });

  it('persists a 5xx response with ok=false but does not throw', async () => {
    nock(TARGET).post('/anything').reply(503, 'service unavailable');

    const result = await runPing();

    expect(result.success).toBe(false);
    expect(result.status).toBe(503);

    const persisted = await ResponseModel.findById(result.id).lean();
    expect(persisted!.ok).toBe(false);
  });

  it('handles network errors gracefully', async () => {
    nock(TARGET).post('/anything').replyWithError('connection refused');

    const result = await runPing();
    expect(result.status).toBe(0);

    const persisted = await ResponseModel.findById(result.id).lean();
    expect(persisted!.status).toBe(0);
    expect(persisted!.ok).toBe(false);
    expect(persisted!.error).toBeTruthy();
  });

  it('emits incident:new when an anomaly is detected', async () => {
    // Seed a stable baseline of fast responses so a slow one becomes an outlier.
    await ResponseModel.insertMany(
      Array.from({ length: 30 }, () => ({
        url: 'https://httpbin.org/anything',
        method: 'POST',
        status: 200,
        ok: true,
        responseTimeMs: 50,
        responseSizeBytes: 100,
      })),
    );

    // Delay the nock response so the new ping is much slower than baseline.
    nock(TARGET)
      .post('/anything')
      .delay(500)
      .reply(200, { ok: true });

    const result = await runPing();
    expect(result.isAnomaly).toBe(true);

    const incidentCalls = emitSpy.mock.calls.filter(([event]) => event === 'incident:new');
    expect(incidentCalls.length).toBe(1);
  });
});
