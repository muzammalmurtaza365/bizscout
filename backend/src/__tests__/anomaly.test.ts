import {
  calculateZScore,
  classifyAnomaly,
  ewmaForecast,
  evaluateAnomaly,
  getRollingStats,
  EMPTY_STATS,
  RollingStats,
  resolveAnomalyPolicy,
} from '../services/anomaly';
import { ResponseModel } from '../models/Response';

describe('calculateZScore', () => {
  it('returns 0 for exactly the mean', () => {
    expect(calculateZScore(100, 100, 10)).toBe(0);
  });

  it('returns correct z for a positive deviation', () => {
    expect(calculateZScore(120, 100, 10)).toBe(2);
  });

  it('returns correct z for a negative deviation', () => {
    expect(calculateZScore(80, 100, 10)).toBe(-2);
  });

  it('returns null when stddev is effectively zero', () => {
    expect(calculateZScore(100, 100, 0)).toBeNull();
    expect(calculateZScore(100, 100, 0.00001)).toBeNull();
  });

  it('returns null for non-finite inputs', () => {
    expect(calculateZScore(NaN, 100, 10)).toBeNull();
    expect(calculateZScore(100, NaN, 10)).toBeNull();
    expect(calculateZScore(100, 100, Infinity)).toBeNull();
  });
});

describe('classifyAnomaly', () => {
  const baseStats: RollingStats = { count: 50, mean: 200, stdDev: 30, min: 150, max: 260 };

  it('does not flag when sample count is below minSamples', () => {
    const result = classifyAnomaly(10_000, { ...baseStats, count: 5 });
    expect(result.isAnomaly).toBe(false);
    expect(result.zScore).toBeNull();
    expect(result.reason).toBeNull();
  });

  it('flags via z-score when |z| > threshold', () => {
    const result = classifyAnomaly(400, baseStats, { zThreshold: 3 });
    expect(result.isAnomaly).toBe(true);
    expect(result.zScore).toBeCloseTo((400 - 200) / 30, 3);
    expect(result.reason).toMatch(/z=/);
  });

  it('does not flag a normal value within threshold', () => {
    const result = classifyAnomaly(210, baseStats, { zThreshold: 3 });
    expect(result.isAnomaly).toBe(false);
    expect(result.zScore).toBeCloseTo((210 - 200) / 30, 3);
  });

  it('flags via threshold (>2x mean) even when z-score alone does not exceed', () => {
    const highStdStats: RollingStats = { count: 50, mean: 200, stdDev: 300, min: 0, max: 1000 };
    const result = classifyAnomaly(500, highStdStats, { zThreshold: 3 });
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toMatch(/2x mean/);
  });

  it('uses combined reason when both z and threshold fire', () => {
    const result = classifyAnomaly(1000, baseStats, { zThreshold: 3 });
    expect(result.isAnomaly).toBe(true);
    expect(result.reason).toMatch(/z=.+2x mean/);
  });

  it('respects custom minSamples', () => {
    const stats: RollingStats = { count: 20, mean: 200, stdDev: 30, min: 150, max: 260 };
    expect(classifyAnomaly(1000, stats, { minSamples: 50 }).isAnomaly).toBe(false);
    expect(classifyAnomaly(1000, stats, { minSamples: 10 }).isAnomaly).toBe(true);
  });

  it('handles zero-mean stats safely', () => {
    const zero: RollingStats = { count: 50, mean: 0, stdDev: 0, min: 0, max: 0 };
    const result = classifyAnomaly(100, zero);
    expect(result.isAnomaly).toBe(false);
  });
});

describe('ewmaForecast', () => {
  it('returns null for empty series', () => {
    expect(ewmaForecast([])).toBeNull();
  });

  it('returns first value for single-item series', () => {
    expect(ewmaForecast([150])).toBe(150);
  });

  it('computes weighted average (α=0.5)', () => {
    // s0=100; s1=0.5*200+0.5*100=150; s2=0.5*300+0.5*150=225
    expect(ewmaForecast([100, 200, 300], 0.5)).toBe(225);
  });

  it('gives more weight to recent values with higher alpha', () => {
    const series = [10, 10, 10, 100];
    const low = ewmaForecast(series, 0.1);
    const high = ewmaForecast(series, 0.9);
    expect(high!).toBeGreaterThan(low!);
  });

  it('rejects invalid alpha', () => {
    expect(ewmaForecast([1, 2, 3], 0)).toBeNull();
    expect(ewmaForecast([1, 2, 3], 1.5)).toBeNull();
    expect(ewmaForecast([1, 2, 3], -0.1)).toBeNull();
  });

  it('is stable against constant series', () => {
    expect(ewmaForecast([50, 50, 50, 50, 50], 0.3)).toBe(50);
  });
});

describe('resolveAnomalyPolicy', () => {
  it('re-exports policy resolution from the anomaly entrypoint', () => {
    const policy = resolveAnomalyPolicy({ windowHours: 6, recentSeriesLimit: 5 });
    expect(policy.windowHours).toBe(6);
    expect(policy.recentSeriesLimit).toBe(5);
    expect(policy.zThreshold).toBeGreaterThan(0);
  });
});

describe('getRollingStats (integration w/ Mongo)', () => {
  it('uses the default configured time window when omitted', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 1000, status: 200, ok: true, createdAt: oldDate });
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 100, status: 200, ok: true });

    const stats = await getRollingStats();
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(100);
  });

  it('returns empty stats when no data exists', async () => {
    const stats = await getRollingStats(24);
    expect(stats).toEqual(EMPTY_STATS);
  });

  it('ignores records with status=0 (failed requests)', async () => {
    await ResponseModel.create([
      { ...baseDoc(), responseTimeMs: 100, status: 200, ok: true },
      { ...baseDoc(), responseTimeMs: 999, status: 0, ok: false },
    ]);
    const stats = await getRollingStats(24);
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(100);
  });

  it('respects the time window', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 1000, status: 200, ok: true, createdAt: oldDate });
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 100, status: 200, ok: true });
    const stats = await getRollingStats(24);
    expect(stats.count).toBe(1);
    expect(stats.mean).toBe(100);
  });

  it('computes mean and stddev across a batch', async () => {
    await ResponseModel.create([
      { ...baseDoc(), responseTimeMs: 100, status: 200, ok: true },
      { ...baseDoc(), responseTimeMs: 200, status: 200, ok: true },
      { ...baseDoc(), responseTimeMs: 300, status: 200, ok: true },
    ]);
    const stats = await getRollingStats(24);
    expect(stats.count).toBe(3);
    expect(stats.mean).toBe(200);
    // population stddev of [100,200,300] ~= 81.65
    expect(stats.stdDev).toBeGreaterThan(80);
    expect(stats.stdDev).toBeLessThan(83);
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(300);
  });
});

describe('evaluateAnomaly', () => {
  it('respects override policy for window, series length, and EWMA alpha', async () => {
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 50, status: 200, ok: true, createdAt: oldDate });
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 200, status: 200, ok: true });
    await ResponseModel.create({ ...baseDoc(), responseTimeMs: 300, status: 200, ok: true });

    const result = await evaluateAnomaly(250, {
      windowHours: 1,
      recentSeriesLimit: 2,
      ewmaAlpha: 1,
      minSamples: 1,
      zThreshold: 99,
    });

    expect(result.stats.count).toBe(2);
    expect(result.stats.mean).toBe(250);
    expect(result.predicted).toBe(300);
    expect(result.isAnomaly).toBe(false);
  });

  it('does not flag until min samples are reached', async () => {
    for (let i = 0; i < 5; i++) {
      await ResponseModel.create({ ...baseDoc(), responseTimeMs: 100, status: 200, ok: true });
    }
    const result = await evaluateAnomaly(5000);
    expect(result.isAnomaly).toBe(false);
  });

  it('flags an obvious outlier once warmed up', async () => {
    const rows = Array.from({ length: 30 }, () => ({
      ...baseDoc(),
      responseTimeMs: 100 + Math.round(Math.random() * 20),
      status: 200,
      ok: true,
    }));
    await ResponseModel.insertMany(rows);
    const result = await evaluateAnomaly(5000);
    expect(result.isAnomaly).toBe(true);
    expect(result.zScore).not.toBeNull();
    expect(result.predicted).not.toBeNull();
  });

  it('returns a predicted value derived from recent series', async () => {
    for (const rt of [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]) {
      await ResponseModel.create({ ...baseDoc(), responseTimeMs: rt, status: 200, ok: true });
    }
    const result = await evaluateAnomaly(120);
    expect(result.predicted).not.toBeNull();
    expect(result.predicted!).toBeCloseTo(100, 0);
  });
});

function baseDoc() {
  return {
    url: 'https://httpbin.org/anything',
    method: 'POST',
    requestPayload: {},
    responseSizeBytes: 0,
    responseBody: {},
    headers: {},
  };
}
