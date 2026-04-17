import { ResponseModel } from '../models/Response';
import { EMPTY_STATS, type RollingStats } from './anomaly.types';

function hoursAgo(windowHours: number): Date {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000);
}

function buildSuccessfulResponseFilter(windowHours?: number) {
  const filter: { status: { $gt: number }; createdAt?: { $gte: Date } } = {
    status: { $gt: 0 },
  };

  if (windowHours !== undefined) {
    filter.createdAt = { $gte: hoursAgo(windowHours) };
  }

  return filter;
}

export async function getRollingStats(windowHours: number): Promise<RollingStats> {
  const [result] = await ResponseModel.aggregate<RollingStats>([
    { $match: buildSuccessfulResponseFilter(windowHours) },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        mean: { $avg: '$responseTimeMs' },
        stdDev: { $stdDevPop: '$responseTimeMs' },
        min: { $min: '$responseTimeMs' },
        max: { $max: '$responseTimeMs' },
      },
    },
    { $project: { _id: 0, count: 1, mean: 1, stdDev: 1, min: 1, max: 1 } },
  ]);

  return result ?? { ...EMPTY_STATS };
}

interface RecentSeriesOptions {
  limit: number;
  windowHours?: number;
}

export async function getRecentSeries({
  limit,
  windowHours,
}: RecentSeriesOptions): Promise<number[]> {
  const docs = await ResponseModel.find(buildSuccessfulResponseFilter(windowHours))
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('responseTimeMs')
    .lean();

  return docs.map((doc) => doc.responseTimeMs).reverse();
}
