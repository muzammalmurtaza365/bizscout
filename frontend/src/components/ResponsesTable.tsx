import { formatDistanceToNow } from 'date-fns';
import type { ResponseRecord } from '../types/api';
import { StatusBadge } from './StatusBadge';

interface Props {
  items: ResponseRecord[];
  loading?: boolean;
  error?: string | null;
}

export function ResponsesTable({ items, loading, error }: Props) {
  if (loading && items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading responses…
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {error}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No responses yet. The scheduler runs every 5 minutes — one should appear shortly.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Response Time</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">Predicted</th>
            <th className="px-4 py-3">Anomaly</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((r) => (
            <tr
              key={r._id}
              data-testid="response-row"
              className={r.isAnomaly ? 'bg-red-50/60' : 'hover:bg-slate-50'}
            >
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} ok={r.ok} />
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                {r.responseTimeMs} ms
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                {formatBytes(r.responseSizeBytes)}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-500">
                {r.predictedResponseTimeMs ? `${Math.round(r.predictedResponseTimeMs)} ms` : '—'}
              </td>
              <td className="px-4 py-3">
                {r.isAnomaly ? (
                  <span
                    title={r.anomalyReason ?? ''}
                    className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200"
                  >
                    Anomaly {r.zScore !== null ? `(z=${r.zScore.toFixed(2)})` : ''}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">normal</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
