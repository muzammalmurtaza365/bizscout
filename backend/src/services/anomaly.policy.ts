import { env } from '../config/env';

export interface AnomalyPolicy {
  windowHours: number;
  zThreshold: number;
  minSamples: number;
  ewmaAlpha: number;
  recentSeriesLimit: number;
  zeroStdDevEpsilon: number;
}

const DEFAULT_RECENT_SERIES_LIMIT = 20;
const DEFAULT_ZERO_STD_DEV_EPSILON = 0.0001;

export function resolveAnomalyPolicy(overrides: Partial<AnomalyPolicy> = {}): AnomalyPolicy {
  return {
    windowHours: overrides.windowHours ?? env.ANOMALY_WINDOW_HOURS,
    zThreshold: overrides.zThreshold ?? env.ANOMALY_Z_THRESHOLD,
    minSamples: overrides.minSamples ?? env.ANOMALY_MIN_SAMPLES,
    ewmaAlpha: overrides.ewmaAlpha ?? env.EWMA_ALPHA,
    recentSeriesLimit: overrides.recentSeriesLimit ?? DEFAULT_RECENT_SERIES_LIMIT,
    zeroStdDevEpsilon: overrides.zeroStdDevEpsilon ?? DEFAULT_ZERO_STD_DEV_EPSILON,
  };
}
