import { v4 as uuidv4 } from 'uuid';
import { pausedAt, playFrom, positionAt, STOPPED, type Timeline } from '../group-music/timeline';

/*
 * Your own listening, shared by every device you're signed in on. Like a room, the server owns
 * what is queued and in what order; unlike a room, one device plays it (the active device) and
 * the others are remotes. The active device's player is the clock: it reports where it really is,
 * so a phone that stalls on a weak connection waits instead of being dragged forward.
 *
 * Everything here is pure: it changes a session and says which part changed. Sockets, timers and
 * storage live in `hub.ts` and `store.ts`.
 */

export type Song = Record<string, unknown>;
export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerItem {
  id: string;
  /** The whole song: the device needs its stream links, and history stores it as it is. */
  song: Song;
  /** Added by autoplay, from what was playing. */
  autoplay?: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  /** e.g. "Galaxy M06", "Chrome on Windows". */
  name: string;
  mobile: boolean;
}

export interface PlayerSession {
  userId: string;
  /** In play order (shuffled, while shuffle is on). */
  items: PlayerItem[];
  /** While shuffle is on, the item ids in the order they were added, to put back. */
  unshuffled: string[] | null;
  currentId: string | null;
  timeline: Timeline;
  repeat: RepeatMode;
  autoplay: boolean;
  /** The device that plays. Null when nothing is playing anywhere. */
  active: DeviceInfo | null;
  revs: { playback: number; queue: number };
  /**
   * Counts moves the player must make: a seek, another song, another device. The device playing
   * follows these, and not playback changes it caused itself by reporting where it is.
   */
  jumps: number;
  updatedAt: number;
}

/**
 * Queue changes after the first full copy go out as small edits, since songs are a few KB each.
 * A device applies one only if it holds the revision just before; otherwise it asks for the lot.
 */
export type QueueEdit =
  | { type: 'add'; index: number; items: PlayerItem[] }
  | { type: 'remove'; ids: string[] }
  | { type: 'order'; ids: string[] }
  | { type: 'whole' };

export interface Change {
  playback?: boolean;
  queue?: QueueEdit;
}

export type PlayerError = 'invalid' | 'not-found' | 'queue-full' | 'not-active' | 'stale';

/** Kept small enough that the whole queue fits one socket message (songs are ~5 KB). */
export const MAX_ITEMS = 200;
/** Past this far into a song, "previous" restarts it, as every player does. */
const RESTART_THRESHOLD_MS = 3000;
/** Smaller differences between a report and the projected position aren't worth telling anyone. */
const DRIFT_MS = 750;

export const createSession = (userId: string, now = Date.now()): PlayerSession => ({
  userId,
  items: [],
  unshuffled: null,
  currentId: null,
  timeline: { ...STOPPED },
  repeat: 'off',
  autoplay: true,
  active: null,
  revs: { playback: 1, queue: 1 },
  jumps: 0,
  updatedAt: now,
});

export const songIdOf = (song: unknown): string => {
  const id = (song as Song | null)?.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
};

export const isSong = (song: unknown): song is Song =>
  typeof song === 'object' && song !== null && !Array.isArray(song) && songIdOf(song) !== '';

const itemOf = (song: Song, autoplay?: boolean): PlayerItem => ({
  id: uuidv4(),
  song,
  ...(autoplay ? { autoplay: true } : {}),
});

export const currentIndex = (session: PlayerSession): number =>
  session.currentId ? session.items.findIndex((item) => item.id === session.currentId) : -1;

export const currentItem = (session: PlayerSession): PlayerItem | null =>
  session.items[currentIndex(session)] ?? null;

export const positionNow = (session: PlayerSession, now: number): number =>
  positionAt(session.timeline, now);

const durationMsOf = (item: PlayerItem | null): number => {
  const seconds = Number(item?.song?.duration);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
};

const PLAYBACK: Change = { playback: true };
const NOTHING: Change = {};

const goTo = (session: PlayerSession, itemId: string, playing: boolean, now: number): Change => {
  session.currentId = itemId;
  session.timeline = playing ? playFrom(0, now) : pausedAt(0, now);
  session.jumps += 1;
  return PLAYBACK;
};

// --- Playing ---

export const play = (session: PlayerSession, now: number): Change => {
  if (!session.currentId) {
    const first = session.items[0];
    if (!first) return NOTHING;
    return goTo(session, first.id, true, now);
  }
  if (session.timeline.playing) return NOTHING;
  session.timeline = playFrom(session.timeline.positionMs, now);
  return PLAYBACK;
};

export const pause = (session: PlayerSession, now: number): Change => {
  if (!session.timeline.playing) return NOTHING;
  session.timeline = pausedAt(positionNow(session, now), now);
  return PLAYBACK;
};

export const seek = (session: PlayerSession, positionMs: number, now: number): Change => {
  if (!session.currentId || !Number.isFinite(positionMs)) return NOTHING;
  const duration = durationMsOf(currentItem(session));
  const target = duration > 0 ? Math.min(positionMs, duration) : positionMs;
  session.timeline = session.timeline.playing ? playFrom(target, now) : pausedAt(target, now);
  session.jumps += 1;
  return PLAYBACK;
};

/**
 * Pressing next. Naming the song it was meant for makes a double tap, or two devices pressing at
 * once, skip only one. Wraps at the end, like the players did before.
 */
export const next = (session: PlayerSession, now: number, expectedId?: string): Change => {
  if (expectedId && expectedId !== session.currentId) return NOTHING;
  const { items } = session;
  if (items.length === 0) return NOTHING;
  const index = currentIndex(session);
  const target = items[(index + 1) % items.length]!;
  return goTo(session, target.id, session.timeline.playing || !session.currentId, now);
};

export const previous = (session: PlayerSession, now: number): Change => {
  const { items } = session;
  const index = currentIndex(session);
  if (index === -1) return NOTHING;
  if (positionNow(session, now) > RESTART_THRESHOLD_MS || items.length === 1) {
    return seek(session, 0, now);
  }
  const target = items[(index - 1 + items.length) % items.length]!;
  return goTo(session, target.id, session.timeline.playing, now);
};

/** The active device's player finished a song. Anything else reporting it is ignored. */
export const ended = (session: PlayerSession, itemId: string, now: number): Change => {
  if (!itemId || itemId !== session.currentId) return NOTHING;
  if (session.repeat === 'one') {
    session.timeline = playFrom(0, now);
    session.jumps += 1;
    return PLAYBACK;
  }
  const index = currentIndex(session);
  const following = session.items[index + 1];
  if (following) return goTo(session, following.id, true, now);
  if (session.repeat === 'all' && session.items[0]) {
    return goTo(session, session.items[0].id, true, now);
  }
  // The end of the queue: stop, ready to play the last song again.
  session.timeline = pausedAt(0, now);
  session.jumps += 1;
  return PLAYBACK;
};

export const playItem = (
  session: PlayerSession,
  itemId: string,
  now: number
): Change | PlayerError => {
  if (!session.items.some((item) => item.id === itemId)) return 'not-found';
  return goTo(session, itemId, true, now);
};

// --- The queue ---

const shuffled = <T>(values: T[], random: () => number): T[] => {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

/** Drops played songs from the front to make room, never the one playing or anything after. */
const makeRoom = (session: PlayerSession, needed: number): string[] => {
  const removable = Math.max(0, currentIndex(session));
  const overflow = session.items.length + needed - MAX_ITEMS;
  if (overflow <= 0) return [];
  const dropped = session.items.splice(0, Math.min(overflow, removable)).map((item) => item.id);
  if (session.unshuffled) {
    const gone = new Set(dropped);
    session.unshuffled = session.unshuffled.filter((id) => !gone.has(id));
  }
  return dropped;
};

export interface LoadOptions {
  startIndex?: number;
  positionMs?: number;
  playing?: boolean;
}

/** Plays a list (an album, a playlist, one song) in place of the queue. */
export const load = (
  session: PlayerSession,
  songs: unknown[],
  options: LoadOptions,
  now: number,
  random: () => number = Math.random
): Change | PlayerError => {
  const seen = new Set<string>();
  const valid = songs.filter((song): song is Song => {
    if (!isSong(song) || seen.has(songIdOf(song))) return false;
    seen.add(songIdOf(song));
    return true;
  });
  if (valid.length === 0) return 'invalid';

  const startIndex = Math.min(Math.max(0, Math.trunc(options.startIndex ?? 0)), valid.length - 1);
  // Keep the songs around the chosen one if the list is longer than a queue can be.
  const from = Math.max(0, Math.min(startIndex - 20, valid.length - MAX_ITEMS));
  const items = valid.slice(from, from + MAX_ITEMS).map((song) => itemOf(song));
  const start = items[startIndex - from]!;

  if (session.unshuffled) {
    session.unshuffled = items.map((item) => item.id);
    const rest = items.filter((item) => item !== start);
    session.items = [start, ...shuffled(rest, random)];
  } else {
    session.items = items;
  }
  session.currentId = start.id;
  const positionMs = Math.max(0, Number(options.positionMs) || 0);
  session.timeline =
    options.playing === false ? pausedAt(positionMs, now) : playFrom(positionMs, now);
  session.jumps += 1;
  return { playback: true, queue: { type: 'whole' } };
};

export interface AddOptions {
  /** Straight after the current song, rather than at the end. */
  next?: boolean;
  autoplay?: boolean;
}

export const add = (
  session: PlayerSession,
  songs: unknown[],
  options: AddOptions,
  now: number
): { change: Change; added: number } | PlayerError => {
  const queued = new Set(session.items.map((item) => songIdOf(item.song)));
  const fresh: Song[] = [];
  for (const song of songs) {
    if (!isSong(song) || queued.has(songIdOf(song))) continue;
    queued.add(songIdOf(song));
    fresh.push(song);
  }
  if (fresh.length === 0) return { change: NOTHING, added: 0 };

  const dropped = makeRoom(session, fresh.length);
  const room = MAX_ITEMS - session.items.length;
  if (room <= 0) return 'queue-full';
  const items = fresh.slice(0, room).map((song) => itemOf(song, options.autoplay));

  const index = options.next ? currentIndex(session) + 1 : session.items.length;
  session.items.splice(index, 0, ...items);
  session.unshuffled?.push(...items.map((item) => item.id));

  // Edits are applied one after another, so a trim plus an add becomes the whole queue.
  const queue: QueueEdit = dropped.length ? { type: 'whole' } : { type: 'add', index, items };
  // With an empty queue the first song added becomes the current one, ready to play.
  if (!session.currentId) {
    session.currentId = items[0]!.id;
    session.timeline = pausedAt(0, now);
    return { change: { playback: true, queue }, added: items.length };
  }
  return { change: { queue }, added: items.length };
};

/** Takes songs out of the queue. The one playing stays: skip it instead. */
export const remove = (session: PlayerSession, ids: unknown[]): Change => {
  const wanted = new Set(ids.filter((id): id is string => typeof id === 'string'));
  wanted.delete(session.currentId ?? '');
  const removed = session.items.filter((item) => wanted.has(item.id)).map((item) => item.id);
  if (removed.length === 0) return NOTHING;
  const gone = new Set(removed);
  session.items = session.items.filter((item) => !gone.has(item.id));
  if (session.unshuffled) session.unshuffled = session.unshuffled.filter((id) => !gone.has(id));
  return { queue: { type: 'remove', ids: removed } };
};

/** Everything but the song playing. */
export const clear = (session: PlayerSession): Change =>
  remove(
    session,
    session.items.map((item) => item.id)
  );

/** A new order for the same songs, as a drag-and-drop list produces. */
export const reorder = (session: PlayerSession, ids: unknown[]): Change | PlayerError => {
  const byId = new Map(session.items.map((item) => [item.id, item]));
  if (ids.length !== byId.size || new Set(ids).size !== ids.length) return 'invalid';
  const items: PlayerItem[] = [];
  for (const id of ids) {
    const item = typeof id === 'string' ? byId.get(id) : undefined;
    if (!item) return 'invalid';
    items.push(item);
  }
  session.items = items;
  return { queue: { type: 'order', ids: items.map((item) => item.id) } };
};

/** On: the song playing first, then the rest in random order. Off: back to the order added. */
export const setShuffle = (
  session: PlayerSession,
  enabled: boolean,
  random: () => number = Math.random
): Change => {
  if (enabled === Boolean(session.unshuffled)) return NOTHING;
  if (enabled) {
    session.unshuffled = session.items.map((item) => item.id);
    const current = currentItem(session);
    const rest = session.items.filter((item) => item !== current);
    session.items = [...(current ? [current] : []), ...shuffled(rest, random)];
  } else {
    const byId = new Map(session.items.map((item) => [item.id, item]));
    session.items = (session.unshuffled ?? [])
      .map((id) => byId.get(id))
      .filter((item): item is PlayerItem => Boolean(item));
    session.unshuffled = null;
  }
  return { playback: true, queue: { type: 'whole' } };
};

export const setRepeat = (session: PlayerSession, mode: unknown): Change | PlayerError => {
  if (mode !== 'off' && mode !== 'all' && mode !== 'one') return 'invalid';
  if (session.repeat === mode) return NOTHING;
  session.repeat = mode;
  return PLAYBACK;
};

export const setAutoplay = (session: PlayerSession, enabled: boolean): Change => {
  if (session.autoplay === enabled) return NOTHING;
  session.autoplay = enabled;
  return PLAYBACK;
};

// --- Devices ---

/**
 * Moves playback to another device, from where it is now. It keeps playing if it was, unless
 * asked to start: pressing "play here" on a paused session.
 */
export const transfer = (
  session: PlayerSession,
  device: DeviceInfo,
  now: number,
  startPlaying = false
): Change => {
  const playing = session.timeline.playing || (startPlaying && Boolean(session.currentId));
  const positionMs = positionNow(session, now);
  session.active = device;
  session.timeline = playing ? playFrom(positionMs, now) : pausedAt(positionMs, now);
  session.jumps += 1;
  return PLAYBACK;
};

/** The active device has been gone too long: pause where it was, with no device playing. */
export const deviceLost = (session: PlayerSession, deviceId: string, now: number): Change => {
  if (session.active?.deviceId !== deviceId) return NOTHING;
  session.active = null;
  session.timeline = pausedAt(positionNow(session, now), now);
  return PLAYBACK;
};

export interface Report {
  /** The playback revision the device had when it measured this. */
  rev: number;
  itemId: string;
  positionMs: number;
  playing: boolean;
}

/**
 * Where the active device's player really is: after a stall, a pause from the lock screen, or
 * just now and then. A report measured before the device heard of a newer change (someone paused
 * from another device meanwhile) would undo that change, so only one for the latest is taken.
 */
export const report = (
  session: PlayerSession,
  deviceId: string,
  heard: Report,
  now: number
): Change | PlayerError => {
  if (session.active?.deviceId !== deviceId) return 'not-active';
  if (heard.rev !== session.revs.playback) return 'stale';
  if (heard.itemId !== session.currentId || !Number.isFinite(heard.positionMs)) return 'invalid';
  const playing = Boolean(heard.playing);
  const drift = Math.abs(positionNow(session, now) - heard.positionMs);
  if (playing === session.timeline.playing && drift < DRIFT_MS) return NOTHING;
  session.timeline = playing ? playFrom(heard.positionMs, now) : pausedAt(heard.positionMs, now);
  return PLAYBACK;
};

export interface Resume {
  /** Revisions the device last held. */
  rev: number;
  /** Where its player is now, by song, since it may have moved on while offline. */
  songId: string;
  positionMs: number;
  playing: boolean;
}

/**
 * A device that was playing comes back after losing its connection. If nothing happened
 * elsewhere meanwhile, what its player did offline (kept playing, moved on a song) is the truth.
 * If something did, the session wins and the device follows it.
 */
export const resume = (
  session: PlayerSession,
  device: DeviceInfo,
  heard: Resume,
  now: number
): Change => {
  const wasActive = session.active === null || session.active.deviceId === device.deviceId;
  if (!wasActive || heard.rev !== session.revs.playback) return NOTHING;
  const item = session.items.find((entry) => songIdOf(entry.song) === heard.songId);
  if (!item || !Number.isFinite(heard.positionMs)) return NOTHING;
  // Paused while gone, with nobody else playing: nothing to take back.
  if (session.active === null && !heard.playing) return NOTHING;
  session.active = device;
  session.currentId = item.id;
  const positionMs = Math.max(0, heard.positionMs);
  session.timeline = heard.playing ? playFrom(positionMs, now) : pausedAt(positionMs, now);
  return PLAYBACK;
};

/** Bumps the revisions for what changed. Call once per change, after applying it. */
export const commit = (session: PlayerSession, change: Change, now = Date.now()): void => {
  if (change.playback) session.revs.playback += 1;
  if (change.queue) session.revs.queue += 1;
  if (change.playback || change.queue) session.updatedAt = now;
};

export const changed = (change: Change): boolean => Boolean(change.playback || change.queue);
