import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Metrics registry for the whole app. We use a dedicated Registry (instead of
 * the global default) so test suites can reset cleanly and we don't pollute
 * metrics across parallel test workers.
 */
export const registry = new Registry();

registry.setDefaultLabels({ app: 'bizscout-backend' });
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled by the API, partitioned by route and status.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'End-to-end HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status'] as const,
  // Sized for a snappy API: from 5ms to 10s.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const pingsTotal = new Counter({
  name: 'bizscout_pings_total',
  help: 'Total httpbin pings executed, partitioned by outcome.',
  labelNames: ['outcome'] as const, // success | http_error | network_error
  registers: [registry],
});

export const pingDurationMs = new Histogram({
  name: 'bizscout_ping_duration_milliseconds',
  help: 'Upstream response time in milliseconds (what the anomaly detector watches).',
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10_000, 30_000],
  registers: [registry],
});

export const anomaliesTotal = new Counter({
  name: 'bizscout_anomalies_total',
  help: 'Total anomalies detected by the anomaly service.',
  registers: [registry],
});

export const socketConnectionsActive = new Gauge({
  name: 'bizscout_socket_connections_active',
  help: 'Number of currently connected Socket.IO clients.',
  registers: [registry],
});

export const schedulerTicksTotal = new Counter({
  name: 'bizscout_scheduler_ticks_total',
  help: 'Scheduler tick outcomes (executed | skipped_local | skipped_locked | failed).',
  labelNames: ['outcome'] as const,
  registers: [registry],
});

/**
 * Resolve an Express request to a stable route label. Using `req.route.path`
 * instead of `req.path` prevents high-cardinality explosions on routes with
 * URL params (e.g. `/api/responses/:id` stays a single label instead of one
 * per ObjectId).
 */
export function routeLabel(req: { route?: { path?: string }; baseUrl?: string; path: string }): string {
  const path = req.route?.path;
  if (!path) return 'unknown';
  return `${req.baseUrl ?? ''}${path}` || path;
}
