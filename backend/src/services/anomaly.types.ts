export interface RollingStats {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export type AnomalyTrigger = 'z-score' | 'mean-threshold';

export interface AnomalyDecision {
  isAnomaly: boolean;
  zScore: number | null;
  reason: string | null;
  triggers: AnomalyTrigger[];
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
