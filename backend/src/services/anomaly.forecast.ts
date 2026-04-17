import { resolveAnomalyPolicy } from './anomaly.policy';

export function ewmaForecast(
  series: number[],
  alpha: number = resolveAnomalyPolicy().ewmaAlpha,
): number | null {
  if (series.length === 0) return null;
  if (alpha <= 0 || alpha > 1) return null;

  let forecast = series[0];
  for (let i = 1; i < series.length; i++) {
    forecast = alpha * series[i] + (1 - alpha) * forecast;
  }

  return forecast;
}
