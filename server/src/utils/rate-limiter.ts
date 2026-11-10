interface Window {
  count: number;
  resetAt: number;
}

/**
 * Counts actions per key in fixed windows, in memory. Enough for socket events, which all pass
 * through this one process; HTTP routes use express-rate-limit.
 */
export const createRateLimiter = ({ limit, windowMs }: { limit: number; windowMs: number }) => {
  const windows = new Map<string, Window>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }, windowMs * 2);
  sweep.unref();

  /** Records one action and returns whether it is allowed. */
  return (key: string | number, now = Date.now()): boolean => {
    const id = String(key);
    const window = windows.get(id);
    if (!window || window.resetAt <= now) {
      windows.set(id, { count: 1, resetAt: now + windowMs });
      return true;
    }
    window.count += 1;
    return window.count <= limit;
  };
};
