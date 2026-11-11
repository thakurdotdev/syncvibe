import { getRedis } from '@/utils/redis';
import { STOPPED } from '../group-music/timeline';
import type { PlayerItem, PlayerSession } from './session';

/*
 * Where sessions are kept between connections. The live session is the one in memory (`hub.ts`);
 * Redis gets a copy shortly after each change, so a deploy loses nothing, and Postgres a copy
 * every little while, so a session outlasts Redis being flushed or a few weeks away.
 *
 * The timeline is a position at a moment of wall-clock time, so a stored session needs no
 * adjusting when it's read back.
 */

/** The queue is large and changes less often than playback, so each is written on its own. */
export type SessionPart = 'core' | 'queue';

const REDIS_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Changes that come together (a new song changes playback and the queue) are written once. */
const REDIS_DELAY_MS = 300;
/** Postgres is the long-term copy; a minute of changes at most is worth risking for fewer writes. */
const DB_DELAY_MS = 15000;
const redisKey = (userId: string) => `player:${userId}`;

export const serializeCore = (session: PlayerSession): string =>
  JSON.stringify({
    userId: session.userId,
    unshuffled: session.unshuffled,
    currentId: session.currentId,
    timeline: session.timeline,
    repeat: session.repeat,
    autoplay: session.autoplay,
    active: session.active,
    revs: session.revs,
    jumps: session.jumps,
    updatedAt: session.updatedAt,
  });

/** Rebuilds a session from what was stored, or null if it isn't usable. */
export const deserializeSession = (
  userId: string,
  core: unknown,
  queue: unknown
): PlayerSession | null => {
  if (typeof core !== 'object' || core === null || !Array.isArray(queue)) return null;
  const stored = core as Partial<PlayerSession>;
  const items = queue.filter(
    (item): item is PlayerItem =>
      typeof item?.id === 'string' && typeof item?.song === 'object' && item.song !== null
  );
  const ids = new Set(items.map((item) => item.id));
  const currentId = stored.currentId && ids.has(stored.currentId) ? stored.currentId : null;
  return {
    userId,
    items,
    unshuffled: Array.isArray(stored.unshuffled)
      ? stored.unshuffled.filter((id) => ids.has(id))
      : null,
    currentId,
    timeline: currentId && stored.timeline ? stored.timeline : { ...STOPPED },
    repeat: stored.repeat === 'all' || stored.repeat === 'one' ? stored.repeat : 'off',
    autoplay: stored.autoplay !== false,
    active: stored.active ?? null,
    revs: {
      playback: Number(stored.revs?.playback) || 1,
      queue: Number(stored.revs?.queue) || 1,
    },
    jumps: Number(stored.jumps) || 0,
    updatedAt: Number(stored.updatedAt) || 0,
  };
};

const parse = (text: string | undefined): unknown => {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

// getRedis() warns on every call when REDIS_URL is unset, so resolve it once.
let redisResolved = false;
let redisClient: ReturnType<typeof getRedis> = null;
const redis = () => {
  if (!redisResolved) {
    redisClient = getRedis();
    redisResolved = true;
  }
  return redisClient;
};

const logFailure = (where: string) => (error: Error) =>
  console.error(`Player session ${where} failed:`, error.message);

// The model pulls in the database connection, which the tests of everything else don't need.
const model = async () => (await import('@/models/music/player-session.model')).default;

const redisDirty = new Map<string, { session: PlayerSession; parts: Set<SessionPart> }>();
const dbDirty = new Map<string, PlayerSession>();
let redisTimer: NodeJS.Timeout | null = null;
let dbTimer: NodeJS.Timeout | null = null;

const flushRedis = async (): Promise<void> => {
  if (redisTimer) clearTimeout(redisTimer);
  redisTimer = null;
  const client = redis();
  if (!client || redisDirty.size === 0) return;
  const multi = client.multi();
  for (const [userId, { session, parts }] of redisDirty) {
    const fields: Record<string, string> = {};
    if (parts.has('core')) fields.core = serializeCore(session);
    if (parts.has('queue')) fields.queue = JSON.stringify(session.items);
    multi.hset(redisKey(userId), fields);
    multi.expire(redisKey(userId), REDIS_TTL_SECONDS);
  }
  redisDirty.clear();
  await multi.exec().catch(logFailure('Redis write'));
};

const flushDb = async (): Promise<void> => {
  if (dbTimer) clearTimeout(dbTimer);
  dbTimer = null;
  if (dbDirty.size === 0) return;
  const sessions = [...dbDirty.values()];
  dbDirty.clear();
  try {
    const PlayerSessionRow = await model();
    for (const session of sessions) {
      const userId = Number(session.userId);
      if (!Number.isSafeInteger(userId)) continue;
      await PlayerSessionRow.upsert({
        userId,
        core: JSON.parse(serializeCore(session)),
        queue: session.items,
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    logFailure('database write')(error as Error);
  }
};

/**
 * Storage, as the hub sees it. An object so the tests can swap it for one that keeps nothing.
 */
export const sessionStore = {
  /** Call after changing a session. Never waits on storage and never fails the change. */
  touch(session: PlayerSession, ...parts: SessionPart[]): void {
    if (redis()) {
      const entry = redisDirty.get(session.userId) ?? { session, parts: new Set<SessionPart>() };
      entry.session = session;
      parts.forEach((part) => entry.parts.add(part));
      redisDirty.set(session.userId, entry);
      if (!redisTimer) {
        redisTimer = setTimeout(() => void flushRedis(), REDIS_DELAY_MS);
        redisTimer.unref();
      }
    }
    dbDirty.set(session.userId, session);
    if (!dbTimer) {
      dbTimer = setTimeout(() => void flushDb(), DB_DELAY_MS);
      dbTimer.unref();
    }
  },

  /** The stored session: Redis first, then Postgres. Null if there is none or it can't be read. */
  async load(userId: string): Promise<PlayerSession | null> {
    const client = redis();
    if (client) {
      try {
        const stored = await client.hgetall(redisKey(userId));
        const session = stored.core
          ? deserializeSession(userId, parse(stored.core), parse(stored.queue) ?? [])
          : null;
        if (session) return session;
      } catch (error) {
        logFailure('Redis read')(error as Error);
      }
    }
    try {
      const PlayerSessionRow = await model();
      const row = await PlayerSessionRow.findByPk(Number(userId));
      return row ? deserializeSession(userId, row.core, row.queue) : null;
    } catch (error) {
      logFailure('database read')(error as Error);
      return null;
    }
  },

  /** Writes everything unsaved now, for shutting down. */
  async flush(): Promise<void> {
    await Promise.all([flushRedis(), flushDb()]);
  },
};
