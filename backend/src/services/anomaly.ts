import { env } from '../config/env';
import { ResponseModel } from '../models/Response';

export interface RollingStats {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  zScore: number | null;
  predicted: number | null;
  reason: string | null;
  stats: RollingStats;
}

export const EMPTY_STATS: RollingStats = {
  count: 0,
  mean: 0,
  stdDev: 0,
  min: 0,
  max: 0,
};

/**
 * Compute rolling statistics over the last `windowHours` for responseTimeMs.
 * Uses Mongo aggregation (`$stdDevPop`) so heavy math stays in the DB.
 */
export async function getRollingStats(
  windowHours: number = env.ANOMALY_WINDOW_HOURS,
): Promise<RollingStats> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const [result] = await ResponseModel.aggregate<RollingStats>([
    { $match: { createdAt: { $gte: since }, status: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        mean: { $avg: '$responseTimeMs' },
        stdDev: { $stdDevPop: '$responseTimeMs' },
        min: { $min: '$responseTimeMs' },
        max: { $max: '$responseTimeMs' },
      },
    },
    { $project: { _id: 0, count: 1, mean: 1, stdDev: 1, min: 1, max: 1 } },
  ]);
  return result ?? { ...EMPTY_STATS };
}

/**
 * Pure z-score calculation. Returns `null` if stddev is effectively zero.
 * Exported for unit tests.
 */
export function calculateZScore(x: number, mean: number, stdDev: number): number | null {
  if (!isFinite(x) || !isFinite(mean) || !isFinite(stdDev)) return null;
  if (stdDev <= 0.0001) return null;
  return (x - mean) / stdDev;
}

/**
 * Classify a response time given its rolling stats. Pure function — testable.
 * Two independent signals trigger an anomaly:
 *   1. |z| > zThreshold (statistical outlier vs recent window)
 *   2. x > 2 * mean     (brief-specified threshold for incident auto-report)
 */
export function classifyAnomaly(
  x: number,
  stats: RollingStats,
  opts: { zThreshold?: number; minSamples?: number } = {},
): { isAnomaly: boolean; zScore: number | null; reason: string | null } {
  const zThreshold = opts.zThreshold ?? env.ANOMALY_Z_THRESHOLD;
  const minSamples = opts.minSamples ?? env.ANOMALY_MIN_SAMPLES;

  if (stats.count < minSamples) {
    return { isAnomaly: false, zScore: null, reason: null };
  }

  const z = calculateZScore(x, stats.mean, stats.stdDev);

  const zAnomaly = z !== null && Math.abs(z) > zThreshold;
  const thresholdAnomaly = stats.mean > 0 && x > 2 * stats.mean;

  if (zAnomaly && thresholdAnomaly) {
    return { isAnomaly: true, zScore: z, reason: `z=${z!.toFixed(2)} and >2x mean` };
  }
  if (zAnomaly) {
    return { isAnomaly: true, zScore: z, reason: `z=${z!.toFixed(2)} exceeds ${zThreshold}` };
  }
  if (thresholdAnomaly) {
    return {
      isAnomaly: true,
      zScore: z,
      reason: `${x}ms > 2x mean (${stats.mean.toFixed(0)}ms)`,
    };
  }
  return { isAnomaly: false, zScore: z, reason: null };
}

/**
 * EWMA forecaster: S_t = α*x + (1-α)*S_{t-1}.
 * We use the last N response times (chronological) to warm up the predictor
 * and emit the next expected value. Pure, deterministic, testable.
 */
export function ewmaForecast(series: number[], alpha: number = env.EWMA_ALPHA): number | null {
  if (series.length === 0) return null;
  if (alpha <= 0 || alpha > 1) return null;
  let s = series[0];
  for (let i = 1; i < series.length; i++) {
    s = alpha * series[i] + (1 - alpha) * s;
  }
  return s;
}

async function getRecentSeries(limit = 20): Promise<number[]> {
  const docs = await ResponseModel.find({ status: { $gt: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('responseTimeMs')
    .lean();
  return docs.map((d) => d.responseTimeMs).reverse();
}

/**
 * Orchestrator called by the ping service BEFORE persisting the new row.
 * Combines rolling stats + classifier + EWMA forecast.
 */
export async function evaluateAnomaly(responseTimeMs: number): Promise<AnomalyResult> {
  const [stats, series] = await Promise.all([getRollingStats(), getRecentSeries(20)]);
  const { isAnomaly, zScore, reason } = classifyAnomaly(responseTimeMs, stats);
  const predicted = ewmaForecast(series);
  return { isAnomaly, zScore, predicted, reason, stats };
}
