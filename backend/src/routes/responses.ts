import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ResponseModel } from '../models/Response';
import { getRollingStats } from '../services/anomaly';

const router = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  onlyAnomalies: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === 'true'),
  since: z.coerce.date().optional(),
});

router.get('/responses', async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }
  const { limit, cursor, onlyAnomalies, since } = parsed.data;

  const filter: Record<string, unknown> = {};
  if (onlyAnomalies) filter.isAnomaly = true;
  if (since) filter.createdAt = { $gte: since };
  if (cursor) {
    if (!mongoose.isValidObjectId(cursor)) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const items = await ResponseModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? String(page[page.length - 1]._id) : null;

  return res.json({ items: page, nextCursor, hasMore });
});

router.get('/responses/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const doc = await ResponseModel.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json(doc);
});

const statsQuerySchema = z.object({
  window: z
    .enum(['1h', '6h', '24h'])
    .default('24h')
    .transform((w) => ({ '1h': 1, '6h': 6, '24h': 24 })[w]),
});

router.get('/stats', async (req: Request, res: Response) => {
  const parsed = statsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query' });
  }
  const windowHours = parsed.data.window;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [stats, anomalyCount] = await Promise.all([
    getRollingStats(windowHours),
    ResponseModel.countDocuments({ createdAt: { $gte: since }, isAnomaly: true }),
  ]);

  return res.json({
    windowHours,
    since,
    ...stats,
    anomalyCount,
  });
});

export default router;
