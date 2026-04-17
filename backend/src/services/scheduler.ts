import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { runPing } from './ping';
import { withLock, INSTANCE_ID } from './lock';
import { schedulerTicksTotal } from '../utils/metrics';

const LOCK_KEY = 'scheduler:ping';

let task: ScheduledTask | null = null;
let running = false;

/**
 * Runs a single ping iteration guarded by:
 *   - a local in-process flag (avoid overlap within one instance)
 *   - a Mongo-backed distributed lock (avoid overlap across replicas)
 *
 * The lock TTL is sized to comfortably exceed a worst-case ping duration so
 * stuck instances eventually free the slot without manual intervention.
 */
export async function runOnce(): Promise<'executed' | 'skipped-local' | 'skipped-locked' | 'failed'> {
  if (running) {
    logger.debug('ping job already running locally; skipping');
    schedulerTicksTotal.inc({ outcome: 'skipped_local' });
    return 'skipped-local';
  }
  running = true;
  try {
    const ttlMs = Math.max(env.PING_TIMEOUT_MS * 2, 30_000);
    const result = await withLock(LOCK_KEY, ttlMs, async () => {
      await runPing();
      return 'executed' as const;
    });
    if (result === null) {
      logger.debug({ instance: INSTANCE_ID }, 'another replica holds the ping lock');
      schedulerTicksTotal.inc({ outcome: 'skipped_locked' });
      return 'skipped-locked';
    }
    schedulerTicksTotal.inc({ outcome: 'executed' });
    return 'executed';
  } catch (err) {
    logger.error({ err }, 'ping job failed');
    schedulerTicksTotal.inc({ outcome: 'failed' });
    return 'failed';
  } finally {
    running = false;
  }
}

export function startScheduler(cronExpr: string = env.PING_INTERVAL_CRON): ScheduledTask {
  if (!cron.validate(cronExpr)) {
    throw new Error(`Invalid cron expression: ${cronExpr}`);
  }
  stopScheduler();
  task = cron.schedule(cronExpr, () => {
    void runOnce();
  });
  logger.info(
    { cron: cronExpr, target: env.PING_TARGET_URL, instance: INSTANCE_ID },
    'scheduler started',
  );
  return task;
}

export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
