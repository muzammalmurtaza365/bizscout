import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiKeyAuth, API_KEY_HEADER } from './middleware/auth';
import responsesRouter from './routes/responses';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import { metricsMiddleware } from './middleware/metrics';
import { runOnce } from './services/scheduler';

export interface CreateAppOptions {
  apiKey?: string;
}

export function createApp(opts: CreateAppOptions = {}) {
  const apiKey = opts.apiKey ?? env.API_KEY;
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', API_KEY_HEADER],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'debug';
      },
    }),
  );
  app.use(metricsMiddleware);

  app.use('/health', healthRouter);
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  const auth = apiKeyAuth(apiKey);
  app.use('/metrics', auth, metricsRouter);
  app.use('/api', auth, responsesRouter);

  if (env.NODE_ENV !== 'production') {
    app.post('/admin/trigger', auth, async (_req: Request, res: Response) => {
      await runOnce();
      res.json({ ok: true });
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
