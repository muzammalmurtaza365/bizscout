import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, API_KEY, API_URL } from './api';

const fetchMock = vi.fn();

describe('api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds response list requests with query params', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null, hasMore: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await api.listResponses({ limit: 25, cursor: 'cursor-123', onlyAnomalies: true });

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/responses?limit=25&cursor=cursor-123&onlyAnomalies=true`, {
      headers: {
        'content-type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    });
  });

  it('requests stats for the requested window', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          windowHours: 24,
          since: new Date().toISOString(),
          count: 0,
          mean: 0,
          stdDev: 0,
          min: 0,
          max: 0,
          anomalyCount: 0,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await api.getStats('6h');

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/stats?window=6h`, {
      headers: {
        'content-type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    });
  });

  it('throws a helpful error message for failed requests', async () => {
    fetchMock.mockResolvedValue(new Response('bad request', { status: 400, statusText: 'Bad Request' }));

    await expect(api.getResponse('resp-1')).rejects.toThrow('API 400: bad request');
  });
});
