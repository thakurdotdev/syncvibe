import type { Server } from 'socket.io';
import {
  emitActivityMessage,
  musicGroups,
  type ControlMode,
  type GroupMember,
  type MusicGroup,
  type QueueItem,
} from './state';
import {
  addSongs,
  AUTOPLAY_MEMBER,
  clearUpcoming,
  createQueueItem,
  moveUpcoming,
  removeUpcoming,
  shuffleUpcoming,
  songIdOf,
  takeUpcoming,
  type QueueError,
} from './queue';
import { leadFor, msUntilEnd, pausedAt, playFrom, positionAt, STOPPED } from './timeline';
import { broadcastPlayback, broadcastQueue, type Actor } from './broadcast';
import { metaChanged } from './host';
import { effects } from './effects';

/*
 * Everything that changes what a room is playing goes through here. The server decides and tells
 * every device the same thing; a device never tells the others. That also means the room moves to
 * the next song by itself, whether or not anyone's app is awake to notice the last one ending.
 */

/** How many songs autoplay adds each time the queue runs low. */
const AUTO_RECOMMENDATIONS = 10;
/** Devices normally report a song ending. If none does, the room moves on this long after. */
const END_GRACE_MS = 2500;
/** A device may finish a little before the room's clock says so, or the stated length be off. */
const END_REPORT_WINDOW_MS = 10000;
/** A round trip measured longer ago than this says nothing about the connection now. */
const RTT_MAX_AGE_MS = 30000;
const RECENT_SONGS = 30;

const durationMsOf = (item: QueueItem | null): number => {
  const seconds = Number(item?.song?.duration);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
};

const songNameOf = (item: QueueItem): string => (item.song.name as string) || 'Song';

const actorOf = (member?: GroupMember): Actor | undefined =>
  member ? { userId: member.userId, userName: member.userName } : undefined;

const isLive = (group: MusicGroup) => musicGroups.get(group.id) === group;

const slowestRtt = (group: MusicGroup): number | null => {
  const now = Date.now();
  let slowest: number | null = null;
  for (const [socketId, sample] of group.rtt) {
    if (now - sample.at > RTT_MAX_AGE_MS) group.rtt.delete(socketId);
    else if (slowest === null || sample.ms > slowest) slowest = sample.ms;
  }
  return slowest;
};

export const noteRtt = (group: MusicGroup, socketId: string, ms: unknown): void => {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return;
  group.rtt.set(socketId, { ms: Math.min(ms, 2000), at: Date.now() });
};

// --- The clock ---

const scheduleEnd = (io: Server, group: MusicGroup): void => {
  if (group.endTimer) clearTimeout(group.endTimer);
  group.endTimer = undefined;

  const item = group.current;
  const remaining = msUntilEnd(group.timeline, durationMsOf(item), Date.now());
  if (!item || remaining === null) return;

  group.endTimer = setTimeout(() => {
    group.endTimer = undefined;
    if (isLive(group)) void advance(io, group, { reason: 'ended', expectedItemId: item.id });
  }, remaining + END_GRACE_MS);
  group.endTimer.unref();
};

/** The current song is done with, however that came about. */
const retireCurrent = (group: MusicGroup): void => {
  const item = group.current;
  if (!item) return;
  item.status = 'played';
  void effects.recordPlayed(group, item);
  const songId = songIdOf(item.song);
  if (songId) {
    group.recentSongIds = [...group.recentSongIds.filter((id) => id !== songId), songId].slice(
      -RECENT_SONGS
    );
  }
};

const startItem = (io: Server, group: MusicGroup, item: QueueItem, action: string): void => {
  retireCurrent(group);
  const now = Date.now();
  item.status = 'playing';
  group.current = item;
  group.trackStartedAt = now;
  group.timeline = playFrom(0, now, leadFor('track', slowestRtt(group)));
  group.revs.playback++;
  group.revs.queue++;

  broadcastPlayback(io, group, 'track');
  broadcastQueue(io, group, action);
  emitActivityMessage(io, group.id, 'song-playing', {
    songName: songNameOf(item),
    addedBy: item.addedBy?.userName,
  });
  scheduleEnd(io, group);
  // Based on the song just started, so what follows it sounds like it.
  void ensureRecommendations(io, group);
};

const stop = (io: Server, group: MusicGroup, action: string): void => {
  retireCurrent(group);
  group.current = null;
  group.timeline = { ...STOPPED, anchorAt: Date.now() };
  group.revs.playback++;
  group.revs.queue++;
  scheduleEnd(io, group);
  broadcastQueue(io, group, action);
  broadcastPlayback(io, group, 'stop');
  emitActivityMessage(io, group.id, 'queue-ended', {});
};

// --- Autoplay ---

/**
 * Tops the queue up with songs like the one playing once it runs low. Returns whether any were
 * added.
 */
export const ensureRecommendations = async (
  io: Server,
  group: MusicGroup,
  seedSongId?: string
): Promise<boolean> => {
  if (!group.settings.autoPlayRecommendations || group.isFetchingRecommendations) return false;
  if (group.upcoming.length > 1) return false;

  const baseSongId =
    seedSongId ||
    songIdOf(group.current?.song) ||
    songIdOf(group.upcoming[group.upcoming.length - 1]?.song);
  if (!baseSongId) return false;

  group.isFetchingRecommendations = true;
  try {
    const queued = [group.current, ...group.upcoming]
      .map((item) => songIdOf(item?.song))
      .filter(Boolean);
    const recs = await effects.recommend({
      baseSongId,
      limit: AUTO_RECOMMENDATIONS,
      excludeSongIds: [...new Set([...queued, ...group.recentSongIds])],
    });
    if (!isLive(group) || !group.settings.autoPlayRecommendations || !recs?.length) return false;

    const { added } = addSongs(group, recs, AUTOPLAY_MEMBER, { isAutoRecommended: true });
    if (added.length === 0) return false;

    // The room ran out and stopped while these were being fetched: they pick it back up.
    const first = !group.current && !group.advancing ? group.upcoming.shift() : undefined;
    if (first) {
      startItem(io, group, first, 'auto-recs');
    } else {
      group.revs.queue++;
      broadcastQueue(io, group, 'auto-recs', { addedCount: added.length });
    }
    return true;
  } catch (err) {
    console.error(`[GroupMusic] Auto-recommendation error for group ${group.id}:`, err);
    return false;
  } finally {
    group.isFetchingRecommendations = false;
  }
};

// --- Moving through the queue ---

/**
 * Moves to the next song, or stops if there isn't one. With `expectedItemId` it only does so if
 * that song is still the one playing, which makes a second report of the same ending harmless.
 */
export const advance = async (
  io: Server,
  group: MusicGroup,
  options: { reason: 'ended' | 'skip'; expectedItemId?: string; by?: GroupMember }
): Promise<boolean> => {
  const finished = group.current;
  if (options.expectedItemId && finished?.id !== options.expectedItemId) return false;
  if (group.advancing) return false;
  if (!finished && group.upcoming.length === 0) return false;

  if (finished && group.upcoming.length === 0 && group.settings.autoPlayRecommendations) {
    group.advancing = true;
    try {
      await ensureRecommendations(io, group, songIdOf(finished.song));
    } finally {
      group.advancing = false;
    }
    if (!isLive(group) || group.current !== finished) return false;
  }

  if (options.reason === 'skip' && finished) {
    emitActivityMessage(io, group.id, 'song-skipped', { userName: options.by?.userName });
  }

  const action = options.reason === 'skip' ? 'skip' : 'song-ended';
  const next = group.upcoming.shift();
  if (next) startItem(io, group, next, action);
  else stop(io, group, action);
  return true;
};

/** A device's player reached the end of the song. Believed only if the room is about there too. */
export const reportEnded = (io: Server, group: MusicGroup, itemId: string): Promise<boolean> => {
  const item = group.current;
  if (!item || item.id !== itemId) return Promise.resolve(false);
  const durationMs = durationMsOf(item);
  if (durationMs > 0) {
    const position = positionAt(group.timeline, Date.now());
    if (!group.timeline.playing || position < durationMs - END_REPORT_WINDOW_MS) {
      return Promise.resolve(false);
    }
  }
  return advance(io, group, { reason: 'ended', expectedItemId: itemId });
};

// --- Playback ---

export const setPlaying = (
  io: Server,
  group: MusicGroup,
  playing: boolean,
  by?: GroupMember
): boolean => {
  if (!group.current || group.timeline.playing === playing) return false;
  const now = Date.now();
  const position = positionAt(group.timeline, now);
  group.timeline = playing
    ? playFrom(position, now, leadFor('resume', slowestRtt(group)))
    : pausedAt(position, now);
  group.revs.playback++;
  scheduleEnd(io, group);
  broadcastPlayback(io, group, playing ? 'play' : 'pause', actorOf(by));
  return true;
};

export const seekTo = (
  io: Server,
  group: MusicGroup,
  positionMs: number,
  by?: GroupMember
): boolean => {
  if (!group.current || !Number.isFinite(positionMs)) return false;
  const durationMs = durationMsOf(group.current);
  const target = Math.max(0, durationMs > 0 ? Math.min(positionMs, durationMs) : positionMs);
  const now = Date.now();
  group.timeline = group.timeline.playing ? playFrom(target, now) : pausedAt(target, now);
  group.revs.playback++;
  scheduleEnd(io, group);
  broadcastPlayback(io, group, 'seek', actorOf(by));
  return true;
};

/** Plays a song straight away, ahead of everything queued. */
export const playNow = (
  io: Server,
  group: MusicGroup,
  song: Record<string, unknown>,
  by: GroupMember
): QueueError | null => {
  const songId = songIdOf(song);
  if (!songId) return 'invalid';
  // Already waiting in the queue: play that entry rather than leaving a second copy behind.
  const queued = group.upcoming.find((item) => songIdOf(item.song) === songId);
  const item = (queued && takeUpcoming(group, queued.id)) || createQueueItem(song, by);
  startItem(io, group, item, 'play-now');
  return null;
};

/** Jumps to a song that's coming up. The ones before it stay queued. */
export const playItem = (io: Server, group: MusicGroup, itemId: string): QueueError | null => {
  const item = takeUpcoming(group, itemId);
  if (!item) return 'not-found';
  startItem(io, group, item, 'play-item');
  return null;
};

// --- The queue ---

export const enqueue = (
  io: Server,
  group: MusicGroup,
  songs: Array<Record<string, unknown>>,
  by: GroupMember,
  options: { next?: boolean; action: string }
): { addedCount: number; error?: QueueError } => {
  const { added, error } = addSongs(group, songs, by, { next: options.next });
  if (added.length === 0) return { addedCount: 0, error };

  if (added.length === 1) {
    emitActivityMessage(io, group.id, 'song-added', {
      userName: by.userName,
      songName: songNameOf(added[0]!),
    });
  }

  // Nothing on: the first song added starts the room.
  const first = group.current ? null : takeUpcoming(group, added[0]!.id);
  if (first) {
    startItem(io, group, first, options.action);
  } else {
    group.revs.queue++;
    broadcastQueue(
      io,
      group,
      options.action,
      { addedCount: added.length, ...(added.length === 1 ? { item: added[0] } : {}) },
      actorOf(by)
    );
    void ensureRecommendations(io, group);
  }
  return { addedCount: added.length };
};

const queueChanged = (
  io: Server,
  group: MusicGroup,
  action: string,
  by?: GroupMember,
  extra: Record<string, unknown> = {}
): void => {
  group.revs.queue++;
  broadcastQueue(io, group, action, extra, actorOf(by));
};

export const removeItem = (
  io: Server,
  group: MusicGroup,
  itemId: string,
  by: GroupMember
): QueueError | null => {
  const error = removeUpcoming(group, itemId, by.userId);
  if (error) return error;
  queueChanged(io, group, 'remove', by, { removedId: itemId });
  void ensureRecommendations(io, group);
  return null;
};

export const moveItem = (
  io: Server,
  group: MusicGroup,
  itemId: string,
  toIndex: number,
  by?: GroupMember
): QueueError | null => {
  const error = moveUpcoming(group, itemId, toIndex);
  if (error) return error;
  queueChanged(io, group, 'reorder', by);
  return null;
};

export const shuffle = (io: Server, group: MusicGroup, by?: GroupMember): boolean => {
  if (group.upcoming.length < 2) return false;
  shuffleUpcoming(group);
  queueChanged(io, group, 'shuffle', by);
  return true;
};

export const clearQueue = (io: Server, group: MusicGroup, by?: GroupMember): void => {
  const clearedCount = clearUpcoming(group);
  queueChanged(io, group, 'clear', by, { clearedCount });
  void ensureRecommendations(io, group);
};

// --- Settings ---

export const setAutoplay = (io: Server, group: MusicGroup, enabled?: boolean): void => {
  group.settings.autoPlayRecommendations =
    typeof enabled === 'boolean' ? enabled : !group.settings.autoPlayRecommendations;
  metaChanged(io, group);
  void ensureRecommendations(io, group);
};

export const setControlMode = (io: Server, group: MusicGroup, mode: ControlMode): boolean => {
  if (mode !== 'everyone' && mode !== 'host') return false;
  if (group.settings.controlMode === mode) return true;
  group.settings.controlMode = mode;
  metaChanged(io, group);
  emitActivityMessage(io, group.id, 'control-mode', { hostOnly: mode === 'host' });
  return true;
};
