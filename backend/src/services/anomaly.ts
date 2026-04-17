import { calculateZScore, classifyAnomaly } from './anomaly.classifier';
import { ewmaForecast } from './anomaly.forecast';
import { resolveAnomalyPolicy, type AnomalyPolicy } from './anomaly.policy';
import {
  getRecentSeries,
  getRollingStats as getRollingStatsFromRepository,
} from './anomaly.repository';
import {
  EMPTY_STATS,
  type AnomalyDecision,
  type AnomalyResult,
  type AnomalyTrigger,
  type RollingStats,
} from './anomaly.types';

export {
  calculateZScore,
  classifyAnomaly,
  EMPTY_STATS,
  ewmaForecast,
  resolveAnomalyPolicy,
};

export type {
  AnomalyDecision,
  AnomalyPolicy,
  AnomalyResult,
  AnomalyTrigger,
  RollingStats,
};

export async function getRollingStats(windowHours: number = resolveAnomalyPolicy().windowHours): Promise<RollingStats> {
  return getRollingStatsFromRepository(windowHours);
}
export async function evaluateAnomaly(
  responseTimeMs: number,
  overrides: Partial<AnomalyPolicy> = {},
): Promise<AnomalyResult> {
  const policy = resolveAnomalyPolicy(overrides);
  const [stats, series] = await Promise.all([
    getRollingStatsFromRepository(policy.windowHours),
    getRecentSeries({
      limit: policy.recentSeriesLimit,
      windowHours: policy.windowHours,
    }),
  ]);
  const { isAnomaly, zScore, reason } = classifyAnomaly(responseTimeMs, stats, policy);
  const predicted = ewmaForecast(series, policy.ewmaAlpha);

  return { isAnomaly, zScore, predicted, reason, stats };
}
