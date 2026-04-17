import { RequestHandler } from 'express';
import { logger } from '../utils/logger';

export const API_KEY_HEADER = 'x-api-key';

export function apiKeyAuth(expectedKey: string | undefined): RequestHandler {
  if (!expectedKey) {
    return (_req, _res, next) => next();
  }
  return (req, res, next) => {
    const provided = req.header(API_KEY_HEADER);
    if (!provided) {
      res.status(401).json({ error: 'Missing X-API-KEY header' });
      return;
    }
    if (provided !== expectedKey) {
      logger.warn({ path: req.path, ip: req.ip }, 'rejected request: bad API key');
      res.status(403).json({ error: 'Invalid API key' });
      return;
    }
    next();
  };
}
