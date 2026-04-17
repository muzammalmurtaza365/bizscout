export interface ResponseRecord {
  _id: string;
  url: string;
  method: string;
  status: number;
  ok: boolean;
  responseTimeMs: number;
  responseSizeBytes: number;
  isAnomaly: boolean;
  zScore: number | null;
  predictedResponseTimeMs: number | null;
  anomalyReason: string | null;
  createdAt: string;
  requestPayload?: Record<string, unknown>;
  responseBody?: Record<string, unknown>;
  headers?: Record<string, string>;
  error?: string | null;
}

export interface ResponseListResult {
  items: ResponseRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface StatsResult {
  windowHours: number;
  since: string;
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  anomalyCount: number;
}
