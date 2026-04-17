import { acquireLock, withLock, INSTANCE_ID } from '../services/lock';

describe('distributed lock', () => {
  it('acquires a free lock', async () => {
    const lock = await acquireLock('test:a', 5_000);
    expect(lock).not.toBeNull();
    expect(lock!.owner).toBe(INSTANCE_ID);
    await lock!.release();
  });

  it('denies a second acquirer while the first holds the lock', async () => {
    const first = await acquireLock('test:contended', 5_000, 'owner-1');
    expect(first).not.toBeNull();

    const second = await acquireLock('test:contended', 5_000, 'owner-2');
    expect(second).toBeNull();

    await first!.release();
  });

  it('allows a new acquirer after the first releases', async () => {
    const a = await acquireLock('test:release', 5_000, 'owner-a');
    expect(a).not.toBeNull();
    await a!.release();

    const b = await acquireLock('test:release', 5_000, 'owner-b');
    expect(b).not.toBeNull();
    expect(b!.owner).toBe('owner-b');
    await b!.release();
  });

  it('allows a new acquirer after the TTL expires (stale takeover)', async () => {
    const stale = await acquireLock('test:stale', 1, 'dead-owner');
    expect(stale).not.toBeNull();

    await new Promise((r) => setTimeout(r, 50));

    const fresh = await acquireLock('test:stale', 5_000, 'new-owner');
    expect(fresh).not.toBeNull();
    expect(fresh!.owner).toBe('new-owner');
    await fresh!.release();
  });

  it('release is a no-op when a later owner has taken over', async () => {
    const stale = await acquireLock('test:safe-release', 1, 'owner-1');
    expect(stale).not.toBeNull();

    await new Promise((r) => setTimeout(r, 50));

    const fresh = await acquireLock('test:safe-release', 5_000, 'owner-2');
    expect(fresh).not.toBeNull();

    // owner-1 releases — should not remove owner-2's lock.
    await stale!.release();

    // owner-2 should still hold it.
    const contender = await acquireLock('test:safe-release', 5_000, 'owner-3');
    expect(contender).toBeNull();

    await fresh!.release();
  });

  describe('withLock', () => {
    it('runs fn when lock is free and releases after', async () => {
      const result = await withLock('test:with', 5_000, async () => {
        return 42;
      });
      expect(result).toBe(42);

      // Lock should be released — next acquire succeeds.
      const next = await acquireLock('test:with', 5_000);
      expect(next).not.toBeNull();
      await next!.release();
    });

    it('returns null and does not run fn when lock is held', async () => {
      const holder = await acquireLock('test:with-held', 5_000, 'holder');
      expect(holder).not.toBeNull();

      const ran = { called: false };
      const result = await withLock('test:with-held', 5_000, async () => {
        ran.called = true;
        return 'nope';
      });

      expect(result).toBeNull();
      expect(ran.called).toBe(false);

      await holder!.release();
    });

    it('releases lock even if fn throws', async () => {
      await expect(
        withLock('test:throw', 5_000, async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      const next = await acquireLock('test:throw', 5_000);
      expect(next).not.toBeNull();
      await next!.release();
    });
  });
});
