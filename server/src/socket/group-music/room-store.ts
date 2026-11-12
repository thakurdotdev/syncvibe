import { getRedis } from '@/utils/redis';
import { STOPPED } from './timeline';
import type { MusicGroup } from './state';

/*
 * Rooms in Redis, so a restart or deploy doesn't end them. The live room is always the one in
 * memory; this is a copy written shortly after each change and read once, when the server starts.
 * Without Redis, or while it's down, rooms simply aren't kept across a restart.
 *
 * A room's timeline is a position at a moment of wall-clock time, so it's still right after a
 * restart with no adjusting: the song has just moved on by however long the server was away.
 */

/** Each write renews this, so only a room nobody has touched for this long is dropped. */
const ROOM_TTL_SECONDS = 12 * 60 * 60;
/** Changes that come together (a new song changes playback and the queue) are written once. */
const SAVE_DELAY_MS = 150;
const INDEX_KEY = 'gm:rooms';
const roomKey = (groupId: string) => `gm:room:${groupId}`;

/** The queue can be large and changes less often than playback, so each is written on its own. */
export type RoomPart = 'core' | 'queue';

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

const dirty = new Map<string, { group: MusicGroup; parts: Set<RoomPart> }>();
let saveTimer: NodeJS.Timeout | null = null;

/** Everything but the queue. Connections, timers and anything else that dies with the process stay out. */
export const serializeCore = (group: MusicGroup): string =>
  JSON.stringify({
    id: group.id,
    name: group.name,
    createdBy: group.createdBy,
    coHosts: group.coHosts,
    mutedIds: group.mutedIds,
    removedIds: group.removedIds,
    formerMembers: group.formerMembers,
    invites: group.invites,
    skipVotes: group.skipVotes,
    createdAt: group.createdAt,
    members: group.members,
    current: group.current,
    timeline: group.timeline,
    revs: group.revs,
    trackStartedAt: group.trackStartedAt,
    recentSongIds: group.recentSongIds,
    settings: group.settings,
    maxMembers: group.maxMembers,
    features: group.features,
    qrCode: group.qrCode,
  });

export const serializeQueue = (group: MusicGroup): string => JSON.stringify(group.upcoming);

/** Rebuilds a room from what was stored, or null if it isn't usable. */
export const deserializeRoom = (stored: Record<string, string>): MusicGroup | null => {
  try {
    if (!stored.core) return null;
    const core = JSON.parse(stored.core);
    const upcoming = stored.queue ? JSON.parse(stored.queue) : [];
    if (typeof core?.id !== 'string' || !Array.isArray(core.members) || !Array.isArray(upcoming)) {
      return null;
    }
    return {
      id: core.id,
      name: core.name,
      createdBy: core.createdBy,
      coHosts: core.coHosts ?? [],
      mutedIds: core.mutedIds ?? [],
      removedIds: core.removedIds ?? [],
      formerMembers: core.formerMembers ?? {},
      invites: core.invites ?? {},
      skipVotes: core.skipVotes ?? null,
      createdAt: core.createdAt,
      members: core.members,
      current: core.current ?? null,
      upcoming,
      timeline: core.timeline ?? { ...STOPPED },
      revs: core.revs ?? { playback: 1, queue: 1, meta: 1 },
      trackStartedAt: core.trackStartedAt ?? 0,
      rtt: new Map(),
      recentSongIds: core.recentSongIds ?? [],
      settings: { controlMode: 'everyone', ...core.settings },
      maxMembers: core.maxMembers ?? 2,
      features: core.features ?? { realtimeChat: false, realtimeSync: false },
      qrCode: core.qrCode,
    };
  } catch {
    return null;
  }
};

const logFailure = (error: Error) => console.error('Room persistence failed:', error.message);

/** Writes every room with unsaved changes now. */
export const flushRooms = async (): Promise<void> => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  const client = redis();
  if (!client || dirty.size === 0) return;

  const multi = client.multi();
  for (const [groupId, { group, parts }] of dirty) {
    const fields: Record<string, string> = {};
    if (parts.has('core')) fields.core = serializeCore(group);
    if (parts.has('queue')) fields.queue = serializeQueue(group);
    multi.hset(roomKey(groupId), fields);
    multi.expire(roomKey(groupId), ROOM_TTL_SECONDS);
    multi.sadd(INDEX_KEY, groupId);
  }
  dirty.clear();
  await multi.exec().catch(logFailure);
};

/** Call after changing a room. Never waits on Redis and never fails the change. */
export const touchRoom = (group: MusicGroup, ...parts: RoomPart[]): void => {
  if (!redis()) return;
  const entry = dirty.get(group.id) ?? { group, parts: new Set<RoomPart>() };
  entry.group = group;
  parts.forEach((part) => entry.parts.add(part));
  dirty.set(group.id, entry);
  if (!saveTimer) {
    saveTimer = setTimeout(() => void flushRooms(), SAVE_DELAY_MS);
    saveTimer.unref();
  }
};

export const forgetRoom = (groupId: string): void => {
  dirty.delete(groupId);
  const client = redis();
  if (!client) return;
  client.multi().del(roomKey(groupId)).srem(INDEX_KEY, groupId).exec().catch(logFailure);
};

/** Every stored room, for starting up. Never throws: a problem here must not stop the server. */
export const loadRooms = async (): Promise<MusicGroup[]> => {
  const client = redis();
  if (!client) return [];
  try {
    const ids = await client.smembers(INDEX_KEY);
    const rooms: MusicGroup[] = [];
    for (const groupId of ids) {
      const room = deserializeRoom(await client.hgetall(roomKey(groupId)));
      // Expired, or written by a version this one can't read.
      if (room) rooms.push(room);
      else forgetRoom(groupId);
    }
    return rooms;
  } catch (error) {
    logFailure(error as Error);
    return [];
  }
};
