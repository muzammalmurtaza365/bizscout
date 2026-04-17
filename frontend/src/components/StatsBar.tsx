import type { StatsResult } from '../types/api';

interface Props {
  stats?: StatsResult;
  loading?: boolean;
}

export function StatsBar({ stats, loading }: Props) {
  const items: { label: string; value: string }[] = stats
    ? [
        { label: 'Requests', value: stats.count.toLocaleString() },
        { label: 'Avg', value: `${Math.round(stats.mean)} ms` },
        { label: 'StdDev', value: `${Math.round(stats.stdDev)} ms` },
        { label: 'Min', value: `${Math.round(stats.min)} ms` },
        { label: 'Max', value: `${Math.round(stats.max)} ms` },
        { label: 'Anomalies', value: stats.anomalyCount.toLocaleString() },
      ]
    : [];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(loading ? Array.from({ length: 6 }) : items).map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {loading ? '—' : (item as { label: string }).label}
          </div>
          <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
            {loading ? '…' : (item as { value: string }).value}
          </div>
        </div>
      ))}
    </div>
  );
}
