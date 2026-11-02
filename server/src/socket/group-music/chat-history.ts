import { getRedis } from '@/utils/redis';

/**
 * Chat history for music rooms, so people who join late or rejoin see the conversation.
 *
 * Storage: Redis when available (survives restarts and can be shared across instances),
 * with an in-memory copy that is always kept up to date. Reads prefer memory and fall
 * back to Redis, so the room keeps working if Redis is missing or temporarily down.
 */

export const MAX_HISTORY_MESSAGES = 200;
const HISTORY_TTL_SECONDS = 24 * 60 * 60;

type UserId = string | number;

export interface Reactor {
  userId: UserId;
  userName?: string;
}

/** emoji → people who reacted with it */
export type MessageReactions = Record<string, Reactor[]>;

export interface StoredMessage {
  id: string;
  timestamp: number;
  [key: string]: unknown;
}

interface RoomHistory {
  messages: StoredMessage[];
  reactions: Map<string, MessageReactions>;
  /** Whether Redis has been consulted for this room since this process started. */
  hydrated: boolean;
}

const memory = new Map<string, RoomHistory>();
const inFlightLoads = new Map<string, Promise<RoomHistory>>();

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

const keys = {
  messages: (groupId: string) => `gm:chat:${groupId}:messages`,
  reactions: (groupId: string) => `gm:chat:${groupId}:reactions`,
};

const getMemoryRoom = (groupId: string): RoomHistory => {
  let room = memory.get(groupId);
  if (!room) {
    room = { messages: [], reactions: new Map(), hydrated: !redis() };
    memory.set(groupId, room);
  }
  return room;
};

/** Fire-and-forget Redis write; failures only cost persistence, never the live room. */
const persist = (
  operation: (client: NonNullable<ReturnType<typeof getRedis>>) => Promise<unknown>
) => {
  const client = redis();
  if (!client) return;
  operation(client).catch((error: Error) =>
    console.error('Group chat history persistence failed:', error.message)
  );
};

const loadFromRedis = async (groupId: string): Promise<Omit<RoomHistory, 'hydrated'> | null> => {
  const client = redis();
  if (!client) return null;
  try {
    const [rawMessages, rawReactions] = await Promise.all([
      client.lrange(keys.messages(groupId), 0, -1),
      client.hgetall(keys.reactions(groupId)),
    ]);
    if (!rawMessages.length) return null;

    const reactions = new Map<string, MessageReactions>();
    for (const [messageId, value] of Object.entries(rawReactions || {})) {
      reactions.set(messageId, JSON.parse(value) as MessageReactions);
    }
    return { messages: rawMessages.map((m) => JSON.parse(m) as StoredMessage), reactions };
  } catch (error) {
    console.error('Group chat history load failed:', (error as Error).message);
    return null;
  }
};

export const appendMessage = (groupId: string, message: StoredMessage): void => {
  const room = getMemoryRoom(groupId);
  room.messages.push(message);
  if (room.messages.length > MAX_HISTORY_MESSAGES) {
    const dropped = room.messages.splice(0, room.messages.length - MAX_HISTORY_MESSAGES);
    dropped.forEach((m) => room.reactions.delete(m.id));
  }

  persist((client) =>
    client
      .multi()
      .rpush(keys.messages(groupId), JSON.stringify(message))
      .ltrim(keys.messages(groupId), -MAX_HISTORY_MESSAGES, -1)
      .expire(keys.messages(groupId), HISTORY_TTL_SECONDS)
      .exec()
  );
};

/**
 * Toggles `reactor`'s `emoji` reaction on a message and returns the message's full
 * reaction state, or null if the message is not part of the room history.
 */
export const toggleReaction = async (
  groupId: string,
  messageId: string,
  emoji: string,
  reactor: Reactor
): Promise<{ action: 'add' | 'remove'; reactions: MessageReactions } | null> => {
  const room = await ensureLoaded(groupId);
  if (!room.messages.some((m) => m.id === messageId)) return null;

  const reactions: MessageReactions = { ...room.reactions.get(messageId) };
  const current = reactions[emoji] || [];
  const alreadyReacted = current.some((r) => String(r.userId) === String(reactor.userId));

  const next = alreadyReacted
    ? current.filter((r) => String(r.userId) !== String(reactor.userId))
    : [...current, reactor];

  if (next.length) reactions[emoji] = next;
  else delete reactions[emoji];

  if (Object.keys(reactions).length) room.reactions.set(messageId, reactions);
  else room.reactions.delete(messageId);

  persist((client) => {
    const multi = client.multi();
    if (Object.keys(reactions).length) {
      multi.hset(keys.reactions(groupId), messageId, JSON.stringify(reactions));
    } else {
      multi.hdel(keys.reactions(groupId), messageId);
    }
    return multi.expire(keys.reactions(groupId), HISTORY_TTL_SECONDS).exec();
  });

  return { action: alreadyReacted ? 'remove' : 'add', reactions };
};

/**
 * Returns the room's history, hydrating from Redis once per process (e.g. after a
 * restart or when another instance wrote it). Concurrent callers share one load.
 */
const ensureLoaded = async (groupId: string): Promise<RoomHistory> => {
  const room = getMemoryRoom(groupId);
  if (room.hydrated) return room;

  let load = inFlightLoads.get(groupId);
  if (!load) {
    load = (async () => {
      const stored = await loadFromRedis(groupId);
      const current = getMemoryRoom(groupId);
      if (stored) {
        // Redis already contains anything appended locally (writes go to both),
        // so merge by id and keep chronological order.
        const byId = new Map(stored.messages.map((m) => [m.id, m]));
        current.messages.forEach((m) => byId.set(m.id, m));
        current.messages = [...byId.values()]
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-MAX_HISTORY_MESSAGES);
        stored.reactions.forEach((value, key) => {
          if (!current.reactions.has(key)) current.reactions.set(key, value);
        });
      }
      current.hydrated = true;
      return current;
    })().finally(() => inFlightLoads.delete(groupId));
    inFlightLoads.set(groupId, load);
  }
  return load;
};

/** Messages with their reactions attached, oldest first. */
export const getHistory = async (groupId: string): Promise<StoredMessage[]> => {
  const room = await ensureLoaded(groupId);
  return room.messages.map((message) => {
    const reactions = room.reactions.get(message.id);
    return reactions ? { ...message, reactions } : message;
  });
};

export const clearHistory = (groupId: string): void => {
  memory.delete(groupId);
  persist((client) => client.del(keys.messages(groupId), keys.reactions(groupId)));
};
