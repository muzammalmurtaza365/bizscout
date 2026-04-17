import { RequestHandler } from 'express';
import { httpRequestDuration, httpRequestsTotal, routeLabel } from '../utils/metrics';

/**
 * Observe per-request duration and count. Uses `res.on('finish')` so the
 * final status and matched route (if any) are known before observation.
 * We intentionally skip `/metrics` itself to avoid self-reference noise.
 */
export const metricsMiddleware: RequestHandler = (req, res, next) => {
  if (req.path === '/metrics') return next();

  const endTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });
  next();
};
