import type { QueueItem } from './types';

/*
 * Deciding how to get back in step with the room. Kept free of any player so the rules can be
 * read (and tested) on their own.
 *
 * The same logic lives in client/src/stores/groupMusic/roomSync.js. Change them together.
 */

/** How often a device compares itself with the room. Needs no network, so it can be often. */
export const DRIFT_CHECK_MS = 1000;
/** Further off than this is worth a seek, even though a seek can briefly buffer. */
export const SEEK_THRESHOLD_S = 1;
/** Too small to hear between two devices side by side. */
export const IN_SYNC_S = 0.04;
/** Fastest or slowest correction speed: 5% is hard to notice with the pitch kept. */
export const MAX_NUDGE = 0.05;
/** A gap closes over about this long, so the speed eases back to normal instead of snapping. */
const NUDGE_SECONDS = 2;
/** Speeds move in steps this size, so the player isn't given a new one every check. */
const NUDGE_STEP = 0.01;

/** The room's playback, as the server sends it. */
export interface RoomPlayback {
  rev: number;
  item: QueueItem | null;
  playing: boolean;
  positionMs: number;
  anchorAt: number;
}

export type SyncStatus = 'synced' | 'adjusting' | 'catching-up';

/** Where the room's song is at a moment of server time, in seconds. */
export const roomPositionS = (playback: RoomPlayback | null, atServerTime: number): number => {
  if (!playback) return 0;
  const ms = playback.playing
    ? playback.positionMs + Math.max(0, atServerTime - playback.anchorAt)
    : playback.positionMs;
  return ms / 1000;
};

/**
 * What to do about being `driftS` seconds behind the room (negative: ahead). A small gap closes
 * by playing slightly fast or slow, which nobody hears; only a large one is worth a seek.
 */
export const planCorrection = (
  driftS: number,
  { canSeek = true, canNudge = true }: { canSeek?: boolean; canNudge?: boolean } = {}
): { type: 'seek' | 'hold' | 'nudge'; rate: number } => {
  const size = Math.abs(driftS);
  if (size >= SEEK_THRESHOLD_S && canSeek) return { type: 'seek', rate: 1 };
  if (size <= IN_SYNC_S || !canNudge) return { type: 'hold', rate: 1 };
  const steps = Math.ceil(Math.min(MAX_NUDGE, size / NUDGE_SECONDS) / NUDGE_STEP);
  const nudge = Math.sign(driftS) * steps * NUDGE_STEP;
  return { type: 'nudge', rate: Math.round((1 + nudge) * 100) / 100 };
};

/** For showing people how closely this device is following: 'synced', 'adjusting' or 'catching-up'. */
export const syncStatusOf = (driftS: number): SyncStatus => {
  const size = Math.abs(driftS);
  if (size <= 0.06) return 'synced';
  return size < SEEK_THRESHOLD_S ? 'adjusting' : 'catching-up';
};
