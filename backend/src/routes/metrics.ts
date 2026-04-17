import { Router, Request, Response } from 'express';
import { registry } from '../utils/metrics';

const router = Router();

/**
 * Prometheus scrape endpoint.
 *
 * NOTE: In production this should be behind an internal-network-only rule or
 * a bearer token. Prom-client output is cheap but leaks cardinality about
 * routes and infra. For a demo this is intentionally left open.
 */
router.get('/', async (_req: Request, res: Response) => {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

export default router;
