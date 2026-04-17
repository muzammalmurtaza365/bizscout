import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * Liveness: the process is running and able to answer HTTP.
 * Never depends on external services — a failing liveness probe means
 * "kill this container and start a new one".
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness: the process is ready to serve real traffic (Mongo reachable).
 * A failing readiness probe means "don't route traffic yet" — the container
 * stays alive but is removed from the load balancer.
 *
 * mongoose.connection.readyState:
 *   0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const mongoState = mongoose.connection.readyState;
  const mongoReady = mongoState === 1;

  let mongoPing: 'ok' | 'fail' | 'skipped' = 'skipped';
  if (mongoReady && mongoose.connection.db) {
    try {
      await mongoose.connection.db.admin().ping();
      mongoPing = 'ok';
    } catch {
      mongoPing = 'fail';
    }
  }

  const ready = mongoReady && mongoPing === 'ok';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'not-ready',
    checks: {
      mongo: {
        state: stateName(mongoState),
        ping: mongoPing,
      },
    },
    timestamp: new Date().toISOString(),
  });
});

function stateName(state: number): string {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][state] ?? 'unknown';
}

export default router;
