import { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({ err, path: req.path, method: req.method }, 'request error');
  const status = typeof err?.status === 'number' ? err.status : 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal Server Error'
      : err?.message ?? 'Internal Server Error';
  res.status(status).json({ error: message });
};
