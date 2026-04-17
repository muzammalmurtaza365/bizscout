import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { useResponsesStore } from '../store/responsesStore';
import type { ResponseListResult, ResponseRecord, StatsResult } from '../types/api';

const { listResponsesMock, getStatsMock, socketState } = vi.hoisted(() => ({
  listResponsesMock: vi.fn(),
  getStatsMock: vi.fn(),
  socketState: {
    connected: true,
    handlers: {} as {
      onResponse?: (record: ResponseRecord) => void;
    },
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    listResponses: listResponsesMock,
    getStats: getStatsMock,
  },
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: (handlers: { onResponse?: (record: ResponseRecord) => void }) => {
    socketState.handlers = handlers;
    return { connected: socketState.connected };
  },
}));

function makeRecord(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return {
    _id: 'resp-1',
    url: 'https://httpbin.org/anything',
    method: 'POST',
    status: 200,
    ok: true,
    responseTimeMs: 120,
    responseSizeBytes: 512,
    isAnomaly: false,
    zScore: null,
    predictedResponseTimeMs: 110,
    anomalyReason: null,
    createdAt: new Date('2026-04-17T12:00:00.000Z').toISOString(),
    ...overrides,
  };
}

function makeStats(overrides: Partial<StatsResult> = {}): StatsResult {
  return {
    windowHours: 24,
    since: new Date('2026-04-16T12:00:00.000Z').toISOString(),
    count: 12,
    mean: 145,
    stdDev: 25,
    min: 100,
    max: 220,
    anomalyCount: 2,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>,
    );
  });

  return queryClient;
}

describe('Dashboard', () => {
  beforeEach(() => {
    listResponsesMock.mockReset();
    getStatsMock.mockReset();
    socketState.connected = true;
    socketState.handlers = {};
    useResponsesStore.setState({ items: [], maxItems: 200 });
  });

  afterEach(() => {
    useResponsesStore.setState({ items: [], maxItems: 200 });
  });

  it('renders fetched responses and stats', async () => {
    const responseList: ResponseListResult = {
      items: [makeRecord({ _id: 'resp-1', responseTimeMs: 125 })],
      nextCursor: null,
      hasMore: false,
    };
    const listDeferred = deferred<ResponseListResult>();
    const statsDeferred = deferred<StatsResult>();

    listResponsesMock.mockReturnValue(listDeferred.promise);
    getStatsMock.mockReturnValue(statsDeferred.promise);

    await renderDashboard();

    await act(async () => {
      listDeferred.resolve(responseList);
      statsDeferred.resolve(makeStats({ count: 1, mean: 125, min: 125, max: 125 }));
      await Promise.all([listDeferred.promise, statsDeferred.promise]);
    });

    await waitFor(() => {
      expect(screen.getByText('Showing 1 most recent')).toBeInTheDocument();
    });

    expect(screen.getByText('HTTP Response Monitor')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getAllByText('125 ms').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('response-row')).toHaveLength(1);
    expect(listResponsesMock).toHaveBeenCalledWith({ limit: 50 });
    expect(getStatsMock).toHaveBeenCalledWith('24h');
  });

  it('prepends new socket responses and invalidates stats', async () => {
    const listDeferred = deferred<ResponseListResult>();
    const statsDeferred = deferred<StatsResult>();

    listResponsesMock.mockReturnValue(listDeferred.promise);
    getStatsMock.mockReturnValue(statsDeferred.promise);

    const initialList: ResponseListResult = {
      items: [makeRecord({ _id: 'resp-1', responseTimeMs: 100 })],
      nextCursor: null,
      hasMore: false,
    };

    const queryClient = await renderDashboard();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      listDeferred.resolve(initialList);
      statsDeferred.resolve(makeStats());
      await Promise.all([listDeferred.promise, statsDeferred.promise]);
    });

    await waitFor(() => {
      expect(screen.getByText('Showing 1 most recent')).toBeInTheDocument();
    });

    act(() => {
      socketState.handlers.onResponse?.(makeRecord({ _id: 'resp-2', responseTimeMs: 222 }));
    });

    await waitFor(() => {
      expect(screen.getByText('Showing 2 most recent')).toBeInTheDocument();
    });

    expect(screen.getByText('222 ms')).toBeInTheDocument();
    expect(screen.getAllByTestId('response-row')).toHaveLength(2);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['stats'] });
  });
});
