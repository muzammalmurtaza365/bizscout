import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import type { ResponseRecord } from '../types/api';
import { ResponsesTable } from '../components/ResponsesTable';
import { AnomalyChart } from '../components/AnomalyChart';
import { ConnectionIndicator } from '../components/ConnectionIndicator';

export function Anomalies() {
  const qc = useQueryClient();
  const [recent, setRecent] = useState<ResponseRecord[]>([]);

  const chartQuery = useQuery({
    queryKey: ['responses', 'chart'],
    queryFn: () => api.listResponses({ limit: 100 }),
    refetchOnWindowFocus: false,
  });

  const anomaliesQuery = useQuery({
    queryKey: ['responses', 'anomalies'],
    queryFn: () => api.listResponses({ limit: 50, onlyAnomalies: true }),
    refetchOnWindowFocus: false,
  });

  const statsQuery = useQuery({
    queryKey: ['stats', '24h'],
    queryFn: () => api.getStats('24h'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (chartQuery.data) setRecent(chartQuery.data.items);
  }, [chartQuery.data]);

  const { connected } = useSocket({
    onResponse: (r) => {
      setRecent((prev) => {
        if (prev.some((p) => p._id === r._id)) return prev;
        return [r, ...prev].slice(0, 100);
      });
      qc.invalidateQueries({ queryKey: ['stats'] });
      if (r.isAnomaly) qc.invalidateQueries({ queryKey: ['responses', 'anomalies'] });
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Anomaly Detection</h1>
          <p className="mt-1 text-sm text-slate-500">
            Z-score + 2× mean threshold, with EWMA forecasting. Confidence band: μ ± 2σ over last
            24h.
          </p>
        </div>
        <ConnectionIndicator connected={connected} />
      </header>

      <section aria-label="Response time chart" className="mb-8">
        <AnomalyChart items={recent} stats={statsQuery.data} />
      </section>

      <section aria-label="Anomalies">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
          Detected anomalies
        </h2>
        <ResponsesTable
          items={anomaliesQuery.data?.items ?? []}
          loading={anomaliesQuery.isLoading}
          error={anomaliesQuery.error instanceof Error ? anomaliesQuery.error.message : null}
        />
      </section>
    </div>
  );
}
