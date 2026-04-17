import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import type { ResponseRecord, StatsResult } from '../types/api';

interface Props {
  items: ResponseRecord[];
  stats?: StatsResult;
}

export function AnomalyChart({ items, stats }: Props) {
  const ordered = [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const data = ordered.map((r) => ({
    ts: new Date(r.createdAt).getTime(),
    actual: r.responseTimeMs,
    predicted: r.predictedResponseTimeMs ?? null,
    anomaly: r.isAnomaly ? r.responseTimeMs : null,
  }));

  const bandUpper = stats ? stats.mean + 2 * stats.stdDev : null;
  const bandLower = stats ? Math.max(0, stats.mean - 2 * stats.stdDev) : null;

  if (data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
        No data to plot yet.
      </div>
    );
  }

  return (
    <div className="h-80 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(t) => format(new Date(t), 'HH:mm')}
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${v}ms`} />
          <Tooltip
            labelFormatter={(t) => format(new Date(Number(t)), 'MMM d, HH:mm:ss')}
            formatter={(v, name) => {
              const num = typeof v === 'number' ? v : Number(v);
              return [Number.isFinite(num) ? `${Math.round(num)} ms` : '—', String(name)];
            }}
          />
          <Legend />
          {bandUpper !== null && bandLower !== null && (
            <ReferenceArea
              y1={bandLower}
              y2={bandUpper}
              fill="#dbeafe"
              fillOpacity={0.35}
              ifOverflow="extendDomain"
              label={{ value: 'μ ± 2σ', position: 'insideTopRight', fill: '#1e40af', fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Predicted (EWMA)"
            stroke="#94a3b8"
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            dataKey="anomaly"
            name="Anomaly"
            fill="#dc2626"
            shape="circle"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
