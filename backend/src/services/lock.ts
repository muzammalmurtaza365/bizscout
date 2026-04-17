import { randomUUID } from 'crypto';
import { Schema, model, Model } from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Distributed lock backed by Mongo.
 *
 * A single document per lock key (`_id`) holds the current owner and an
 * `expiresAt` timestamp. Acquiring the lock is an atomic `findOneAndUpdate`
 * with two possible match conditions:
 *   1. No document exists yet (first acquirer wins via upsert).
 *   2. Document exists but is stale (`expiresAt <= now`), meaning the previous
 *      owner crashed or hung without releasing.
 *
 * A Mongo TTL index on `expiresAt` physically removes orphaned docs, keeping
 * the collection tidy even if all replicas die mid-run.
 */

interface LockDoc {
  _id: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
}

const lockSchema = new Schema<LockDoc>(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    acquiredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { versionKey: false, _id: false },
);

// Cache the model so hot-reload doesn't try to redefine it.
let LockModel: Model<LockDoc> | null = null;
function getModel(): Model<LockDoc> {
  if (!LockModel) LockModel = model<LockDoc>('SchedulerLock', lockSchema);
  return LockModel;
}

export interface AcquiredLock {
  key: string;
  owner: string;
  release: () => Promise<void>;
}

export const INSTANCE_ID = `${process.pid}-${randomUUID().slice(0, 8)}`;

/**
 * Try to acquire `key` for `ttlMs`. Returns the lock handle on success, or
 * `null` if another instance currently holds it.
 */
export async function acquireLock(
  key: string,
  ttlMs: number,
  owner: string = INSTANCE_ID,
): Promise<AcquiredLock | null> {
  const Model = getModel();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Atomic: upsert if missing, otherwise take over only if stale.
    await Model.findOneAndUpdate(
      { _id: key, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { owner, acquiredAt: now, expiresAt } },
      { upsert: true, new: true },
    );
    logger.debug({ key, owner, ttlMs }, 'lock acquired');
    return {
      key,
      owner,
      release: async () => {
        // Only release if we still own it — avoids stealing release from a
        // later owner that took over after our TTL expired.
        await Model.deleteOne({ _id: key, owner });
        logger.debug({ key, owner }, 'lock released');
      },
    };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      logger.debug({ key, owner }, 'lock held by another instance');
      return null;
    }
    throw err;
  }
}

/**
 * Convenience wrapper: acquire, run fn, release — no-op if we lost the race.
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const lock = await acquireLock(key, ttlMs);
  if (!lock) return null;
  try {
    return await fn();
  } finally {
    await lock.release().catch((err) => logger.warn({ err, key }, 'lock release failed'));
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000;
}
