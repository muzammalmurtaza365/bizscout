import type { ResponseListResult, ResponseRecord, StatsResult } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listResponses: (params: {
    limit?: number;
    cursor?: string;
    onlyAnomalies?: boolean;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.onlyAnomalies) q.set('onlyAnomalies', 'true');
    return request<ResponseListResult>(`/api/responses?${q.toString()}`);
  },
  getResponse: (id: string) => request<ResponseRecord>(`/api/responses/${id}`),
  getStats: (window: '1h' | '6h' | '24h' = '24h') =>
    request<StatsResult>(`/api/stats?window=${window}`),
};

export { API_URL };
