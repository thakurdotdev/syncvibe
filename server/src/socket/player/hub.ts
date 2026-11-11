import type { Server } from 'socket.io';
import {
  add,
  changed,
  clear,
  commit,
  createSession,
  currentItem,
  deviceLost,
  ended,
  isSong,
  load,
  next,
  pause,
  play,
  playItem,
  previous,
  remove,
  reorder,
  report,
  resume,
  seek,
  setAutoplay,
  setRepeat,
  setShuffle,
  transfer,
  type Change,
  type DeviceInfo,
  type PlayerError,
  type PlayerSession,
  type Resume,
} from './session';
import { sessionStore } from './store';

/*
 * The live sessions and the devices following them. Every change goes through `runCommand`,
 * which applies it, bumps the revisions and tells all of the user's devices.
 *
 * Events, to every device of the user that said hello:
 *   player:playback  whole playback part (see `playbackOf`), with its revision
 *   player:queue     { rev, items }: the whole queue
 *   player:queue-edit { rev, edit }: one edit on top of revision rev - 1
 *   player:devices   { devices }: the devices online now
 */

/** Long enough for a phone to get its connection back, short enough that "Playing on" stays true. */
export const LOST_GRACE_MS = 20000;
/** A session nobody has a device on stays in memory this long, then lives on in storage only. */
const IDLE_EVICT_MS = 10 * 60 * 1000;

interface ConnectedDevice extends DeviceInfo {
  socketId: string;
}

const sessions = new Map<string, PlayerSession>();
const loading = new Map<string, Promise<PlayerSession>>();
const devices = new Map<string, Map<string, ConnectedDevice>>();
const lostTimers = new Map<string, NodeJS.Timeout>();
const evictTimers = new Map<string, NodeJS.Timeout>();

/** Every device of one user that follows their session. */
export const playerRoom = (userId: string) => `player:${userId}`;

export const getSession = (userId: string): Promise<PlayerSession> => {
  const live = sessions.get(userId);
  if (live) return Promise.resolve(live);
  const pending = loading.get(userId);
  if (pending) return pending;
  const loaded = sessionStore
    .load(userId)
    .then((stored) => {
      // Another load may have finished first; there must only ever be one live copy.
      const session = sessions.get(userId) ?? stored ?? createSession(userId);
      sessions.set(userId, session);
      return session;
    })
    .finally(() => loading.delete(userId));
  loading.set(userId, loaded);
  return loaded;
};

const devicesOf = (userId: string) => devices.get(userId) ?? new Map<string, ConnectedDevice>();

const isOnline = (userId: string, deviceId: string | undefined) =>
  Boolean(deviceId && devicesOf(userId).has(deviceId));

const deviceInfo = ({ deviceId, name, mobile }: DeviceInfo): DeviceInfo => ({
  deviceId,
  name,
  mobile,
});

export const playbackOf = (session: PlayerSession, now = Date.now()) => {
  const item = currentItem(session);
  return {
    rev: session.revs.playback,
    queueRev: session.revs.queue,
    itemId: item?.id ?? null,
    song: item?.song ?? null,
    timeline: session.timeline,
    jumps: session.jumps,
    shuffle: Boolean(session.unshuffled),
    repeat: session.repeat,
    autoplay: session.autoplay,
    active: session.active,
    /** Whether the active device is connected now. Commands still reach it once it's back. */
    activeOnline: isOnline(session.userId, session.active?.deviceId),
    serverTime: now,
  };
};

export const queueOf = (session: PlayerSession) => ({
  rev: session.revs.queue,
  items: session.items,
});

export const devicesListOf = (userId: string) => ({
  devices: [...devicesOf(userId).values()].map(deviceInfo),
});

export const snapshotOf = (session: PlayerSession) => ({
  playback: playbackOf(session),
  queue: queueOf(session),
  ...devicesListOf(session.userId),
});

const publish = (io: Server, session: PlayerSession, change: Change): void => {
  const room = io.to(playerRoom(session.userId));
  if (change.queue) {
    if (change.queue.type === 'whole') room.emit('player:queue', queueOf(session));
    else room.emit('player:queue-edit', { rev: session.revs.queue, edit: change.queue });
  }
  // After the queue, so a device that is told to play a new item already has it.
  if (change.playback) room.emit('player:playback', playbackOf(session));
  sessionStore.touch(
    session,
    ...(change.queue ? (['core', 'queue'] as const) : (['core'] as const))
  );
};

const apply = (io: Server, session: PlayerSession, change: Change): void => {
  if (!changed(change)) return;
  commit(session, change);
  publish(io, session, change);
};

const tellDevices = (io: Server, userId: string, session?: PlayerSession): void => {
  io.to(playerRoom(userId)).emit('player:devices', devicesListOf(userId));
  // "Playing on X" vs "X isn't reachable" is part of playback, without being a change to it.
  if (session?.active) {
    io.to(playerRoom(userId)).emit('player:playback', playbackOf(session));
  }
};

// --- Devices coming and going ---

const cancelTimer = (timers: Map<string, NodeJS.Timeout>, key: string) => {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
};

export interface Hello {
  device: DeviceInfo;
  socketId: string;
  resume?: Resume;
}

/** A device starts following the session. Returns the whole session for it to start from. */
export const deviceHello = async (io: Server, userId: string, hello: Hello) => {
  const { device, socketId } = hello;
  let own = devices.get(userId);
  if (!own) devices.set(userId, (own = new Map()));
  own.set(device.deviceId, { ...deviceInfo(device), socketId });
  cancelTimer(evictTimers, userId);

  const session = await getSession(userId);
  if (session.active?.deviceId === device.deviceId) cancelTimer(lostTimers, userId);
  if (hello.resume)
    apply(io, session, resume(session, deviceInfo(device), hello.resume, Date.now()));

  tellDevices(io, userId, session);
  return snapshotOf(session);
};

/** A device's connection closed. Only the socket that registered it can take it away. */
export const deviceGone = (io: Server, userId: string, deviceId: string, socketId: string) => {
  const own = devices.get(userId);
  if (own?.get(deviceId)?.socketId !== socketId) return;
  own.delete(deviceId);
  if (own.size === 0) devices.delete(userId);

  const session = sessions.get(userId);
  if (!session) return;
  tellDevices(io, userId, session);

  if (session.active?.deviceId === deviceId) {
    cancelTimer(lostTimers, userId);
    const timer = setTimeout(() => {
      lostTimers.delete(userId);
      if (isOnline(userId, deviceId)) return;
      apply(io, session, deviceLost(session, deviceId, Date.now()));
      scheduleEvict(userId);
    }, LOST_GRACE_MS);
    timer.unref?.();
    lostTimers.set(userId, timer);
  } else {
    scheduleEvict(userId);
  }
};

const scheduleEvict = (userId: string) => {
  if (devices.has(userId) || lostTimers.has(userId)) return;
  cancelTimer(evictTimers, userId);
  const timer = setTimeout(() => {
    evictTimers.delete(userId);
    if (devices.has(userId) || lostTimers.has(userId)) return;
    const session = sessions.get(userId);
    // Saved first, so the next load reads what was in memory.
    if (session) sessionStore.touch(session, 'core', 'queue');
    void sessionStore.flush().then(() => {
      if (!devices.has(userId)) sessions.delete(userId);
    });
  }, IDLE_EVICT_MS);
  timer.unref?.();
  evictTimers.set(userId, timer);
};

// --- Commands ---

export interface PlayerCommand {
  type: string;
  itemId?: string;
  itemIds?: unknown[];
  songs?: unknown[];
  song?: unknown;
  startIndex?: number;
  positionMs?: number;
  playing?: boolean;
  enabled?: boolean;
  mode?: unknown;
  next?: boolean;
  autoplay?: boolean;
  /** For autoplay songs: the item they were picked for. Stale once that one isn't playing. */
  basedOn?: string;
  /** Start on the device asking rather than on the one playing now. */
  here?: boolean;
  deviceId?: string;
  rev?: number;
}

export type CommandResult =
  | { ok: true; added?: number; ignored?: boolean }
  | { ok: false; code: PlayerError | 'unknown-command' | 'offline-device'; error: string };

const ERROR_TEXT: Record<PlayerError | 'unknown-command' | 'offline-device', string> = {
  invalid: "That didn't work",
  'not-found': "That song isn't in the queue any more",
  'queue-full': 'The queue is full',
  'not-active': 'Another device is playing',
  stale: 'Out of date',
  'unknown-command': 'Unknown request',
  'offline-device': "That device isn't connected",
};

const fail = (code: keyof typeof ERROR_TEXT): CommandResult => ({
  ok: false,
  code,
  error: ERROR_TEXT[code],
});

const done = (io: Server, session: PlayerSession, result: Change | PlayerError): CommandResult => {
  if (typeof result === 'string') return fail(result);
  apply(io, session, result);
  return { ok: true };
};

/**
 * Starting something needs a device to play it on. That is the one already playing if it's
 * connected; otherwise (or when asked) the device that asked.
 */
const ensureActive = (
  session: PlayerSession,
  caller: DeviceInfo,
  here: boolean,
  now: number
): boolean => {
  const online = isOnline(session.userId, session.active?.deviceId);
  if (session.active && online && !here) return false;
  if (session.active?.deviceId === caller.deviceId) return false;
  transfer(session, deviceInfo(caller), now);
  return true;
};

/** A start that may have moved playback to the caller: that is a change even if the rest failed. */
const started = (
  io: Server,
  session: PlayerSession,
  moved: boolean,
  result: Change | PlayerError
): CommandResult => {
  if (moved) {
    apply(
      io,
      session,
      typeof result === 'string' ? { playback: true } : { ...result, playback: true }
    );
    return typeof result === 'string' ? fail(result) : { ok: true };
  }
  return done(io, session, result);
};

/** Carries out one request from one of the user's devices. */
export const runCommand = async (
  io: Server,
  userId: string,
  caller: DeviceInfo,
  command: PlayerCommand
): Promise<CommandResult> => {
  const session = await getSession(userId);
  const now = Date.now();
  const isActive = session.active?.deviceId === caller.deviceId;
  const here = command.here === true;

  switch (command.type) {
    case 'play': {
      const moved = ensureActive(session, caller, here, now);
      return started(io, session, moved, play(session, now));
    }

    case 'pause':
      return done(io, session, pause(session, now));

    case 'seek':
      return done(io, session, seek(session, Number(command.positionMs), now));

    case 'next':
      return done(io, session, next(session, now, command.itemId));

    case 'previous':
      return done(io, session, previous(session, now));

    case 'play-item': {
      const itemId = String(command.itemId ?? '');
      if (!session.items.some((item) => item.id === itemId)) return fail('not-found');
      const moved = ensureActive(session, caller, here, now);
      return started(io, session, moved, playItem(session, itemId, now));
    }

    case 'load': {
      const songs = Array.isArray(command.songs) ? command.songs : [command.song];
      if (!songs.some(isSong)) return fail('invalid');
      // Loading paused (a device bringing its old queue) doesn't need anyone to play it.
      const moved = command.playing !== false && ensureActive(session, caller, here, now);
      return started(
        io,
        session,
        moved,
        load(
          session,
          songs,
          {
            startIndex: command.startIndex,
            positionMs: command.positionMs,
            playing: command.playing,
          },
          now
        )
      );
    }

    case 'add': {
      const songs = Array.isArray(command.songs) ? command.songs : [command.song];
      if (command.autoplay) {
        // Only the device playing picks songs for what's playing, so two can't both add some.
        if (!isActive || !session.autoplay || command.basedOn !== session.currentId) {
          return { ok: true, ignored: true };
        }
      }
      if (!songs.some(isSong)) return fail('invalid');
      const result = add(session, songs, { next: command.next, autoplay: command.autoplay }, now);
      if (typeof result === 'string') return fail(result);
      apply(io, session, result.change);
      return { ok: true, added: result.added };
    }

    case 'remove':
      return done(io, session, remove(session, command.itemIds ?? [command.itemId]));

    case 'clear':
      return done(io, session, clear(session));

    case 'reorder':
      return done(io, session, reorder(session, command.itemIds ?? []));

    case 'shuffle':
      return done(io, session, setShuffle(session, command.enabled === true));

    case 'repeat':
      return done(io, session, setRepeat(session, command.mode));

    case 'autoplay':
      return done(io, session, setAutoplay(session, command.enabled === true));

    case 'transfer': {
      const target = command.deviceId ? devicesOf(userId).get(command.deviceId) : undefined;
      if (!target) return fail('offline-device');
      if (session.active?.deviceId === target.deviceId && !command.playing) return { ok: true };
      return done(
        io,
        session,
        transfer(session, deviceInfo(target), now, command.playing === true)
      );
    }

    // The device that was playing stops being the one (closed the player, joined a room).
    case 'release':
      if (!isActive) return { ok: true, ignored: true };
      cancelTimer(lostTimers, userId);
      return done(io, session, deviceLost(session, caller.deviceId, now));

    case 'ended':
      if (!isActive) return { ok: true, ignored: true };
      return done(io, session, ended(session, String(command.itemId ?? ''), now));

    case 'report': {
      const result = report(
        session,
        caller.deviceId,
        {
          rev: Number(command.rev),
          itemId: String(command.itemId ?? ''),
          positionMs: Number(command.positionMs),
          playing: command.playing === true,
        },
        now
      );
      // A stale or unwanted report isn't the device's fault; it will hear the newer state.
      if (result === 'stale' || result === 'not-active') return { ok: true, ignored: true };
      return done(io, session, result);
    }

    default:
      return fail('unknown-command');
  }
};

export const revsOf = async (userId: string) => {
  const session = await getSession(userId);
  return { ...session.revs };
};

/** For tests: forget everything. */
export const resetHub = (): void => {
  for (const timers of [lostTimers, evictTimers]) {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }
  sessions.clear();
  loading.clear();
  devices.clear();
};
