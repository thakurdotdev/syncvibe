import type { BetterAuthOptions } from 'better-auth';
import { getRedis } from '@/utils/redis';

type RateLimitStorage = NonNullable<NonNullable<BetterAuthOptions['rateLimit']>['customStorage']>;

const KEY_PREFIX = 'auth:rate-limit:';

/**
 * Counts the request and starts the window on the first one, in a single step, so concurrent
 * requests on any server instance can't slip past the limit.
 * Returns the count after this request and the seconds left in the window.
 */
const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

/**
 * Keeps Better Auth's rate-limit counters in Redis, so every server instance shares them.
 * Returns undefined without REDIS_URL, and Better Auth then counts in memory.
 */
export const createRedisRateLimitStorage = (): RateLimitStorage | undefined => {
  const redis = getRedis();
  if (!redis) return undefined;

  return {
    consume: async (key, { window, max }) => {
      try {
        const [count, ttl] = (await redis.eval(
          CONSUME_SCRIPT,
          1,
          `${KEY_PREFIX}${key}`,
          window
        )) as [number, number];
        return count <= max
          ? { allowed: true, retryAfter: null }
          : { allowed: false, retryAfter: ttl };
      } catch (error) {
        // A Redis outage must not stop everyone from signing in, so requests are let through.
        console.error('Auth rate limit check failed; allowing the request:', error);
        return { allowed: true, retryAfter: null };
      }
    },
  };
};
