import { Redis } from 'ioredis';

let redis: Redis | null = null;

export const getRedis = (): Redis | null => {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.warn('REDIS_URL not set, using in-memory fallback');
      return null;
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    redis.on('error', (err: Error) => console.error('Redis error:', err.message));
    redis.on('connect', () => console.log('Redis connected'));
  }
  return redis;
};

export const cache = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const client = getRedis();
    if (!client) return null;
    try {
      const data = await client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<boolean> {
    const client = getRedis();
    if (!client) return false;
    try {
      const data = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await client.setex(key, ttlSeconds, data);
      } else {
        await client.set(key, data);
      }
      return true;
    } catch {
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    const client = getRedis();
    if (!client) return false;
    try {
      await client.del(key);
      return true;
    } catch {
      return false;
    }
  },

  async delPattern(pattern: string): Promise<boolean> {
    const client = getRedis();
    if (!client) return false;
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      return true;
    } catch {
      return false;
    }
  },
};
