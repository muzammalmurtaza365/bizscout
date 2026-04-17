import { resolveAnomalyPolicy, type AnomalyPolicy } from './anomaly.policy';
import type { AnomalyDecision, AnomalyTrigger, RollingStats } from './anomaly.types';

export function calculateZScore(
  x: number,
  mean: number,
  stdDev: number,
  zeroStdDevEpsilon: number = resolveAnomalyPolicy().zeroStdDevEpsilon,
): number | null {
  if (!isFinite(x) || !isFinite(mean) || !isFinite(stdDev)) return null;
  if (stdDev <= zeroStdDevEpsilon) return null;
  return (x - mean) / stdDev;
}

function buildReason(
  triggers: AnomalyTrigger[],
  x: number,
  stats: RollingStats,
  zScore: number | null,
  policy: AnomalyPolicy,
): string | null {
  const hasZScoreTrigger = triggers.includes('z-score');
  const hasMeanThresholdTrigger = triggers.includes('mean-threshold');

  if (hasZScoreTrigger && hasMeanThresholdTrigger && zScore !== null) {
    return `z=${zScore.toFixed(2)} and >2x mean`;
  }
  if (hasZScoreTrigger && zScore !== null) {
    return `z=${zScore.toFixed(2)} exceeds ${policy.zThreshold}`;
  }
  if (hasMeanThresholdTrigger) {
    return `${x}ms > 2x mean (${stats.mean.toFixed(0)}ms)`;
  }
  return null;
}

export function classifyAnomaly(
  x: number,
  stats: RollingStats,
  overrides: Partial<Pick<AnomalyPolicy, 'zThreshold' | 'minSamples' | 'zeroStdDevEpsilon'>> = {},
): AnomalyDecision {
  const policy = resolveAnomalyPolicy(overrides);

  if (stats.count < policy.minSamples) {
    return { isAnomaly: false, zScore: null, reason: null, triggers: [] };
  }

  const zScore = calculateZScore(x, stats.mean, stats.stdDev, policy.zeroStdDevEpsilon);
  const triggers: AnomalyTrigger[] = [];

  if (zScore !== null && Math.abs(zScore) > policy.zThreshold) {
    triggers.push('z-score');
  }
  if (stats.mean > 0 && x > 2 * stats.mean) {
    triggers.push('mean-threshold');
  }

  return {
    isAnomaly: triggers.length > 0,
    zScore,
    reason: buildReason(triggers, x, stats, zScore, policy),
    triggers,
  };
}
