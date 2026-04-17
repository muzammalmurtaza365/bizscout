import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import { useResponsesStore } from '../store/responsesStore';
import { ResponsesTable } from '../components/ResponsesTable';
import { StatsBar } from '../components/StatsBar';
import { ConnectionIndicator } from '../components/ConnectionIndicator';

export function Dashboard() {
  const qc = useQueryClient();
  const items = useResponsesStore((s) => s.items);
  const setItems = useResponsesStore((s) => s.setItems);
  const prependItem = useResponsesStore((s) => s.prependItem);

  const listQuery = useQuery({
    queryKey: ['responses', 'list'],
    queryFn: () => api.listResponses({ limit: 50 }),
    refetchOnWindowFocus: false,
  });

  const statsQuery = useQuery({
    queryKey: ['stats', '24h'],
    queryFn: () => api.getStats('24h'),
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listQuery.data) setItems(listQuery.data.items);
  }, [listQuery.data, setItems]);

  const { connected } = useSocket({
    onResponse: (r) => {
      prependItem(r);
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HTTP Response Monitor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Polling <code className="rounded bg-slate-100 px-1 py-0.5">httpbin.org/anything</code>{' '}
            every 5 minutes
          </p>
        </div>
        <ConnectionIndicator connected={connected} />
      </header>

      <section aria-label="Statistics (last 24h)" className="mb-6">
        <StatsBar stats={statsQuery.data} loading={statsQuery.isLoading} />
      </section>

      <section aria-label="Recent responses">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Recent responses
          </h2>
          <span className="text-xs text-slate-400">
            Showing {items.length} most recent
          </span>
        </div>
        <ResponsesTable
          items={items}
          loading={listQuery.isLoading}
          error={listQuery.error instanceof Error ? listQuery.error.message : null}
        />
      </section>
    </div>
  );
}
