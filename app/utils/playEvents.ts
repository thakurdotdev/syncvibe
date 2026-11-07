import { API_URL } from '@/constants';
import { getAuthHeaders } from '@/lib/auth-client';
import { Song } from '@/types/song';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Crypto from 'expo-crypto';

/** Why a song stopped playing. */
export type PlayEndReason = 'completed' | 'next' | 'previous' | 'selected' | 'closed' | 'error';
type PlaySource = 'direct' | 'queue' | 'recommendation' | 'resume';

interface PlayEvent {
  eventId: string;
  songId: string;
  sessionId: string;
  source: PlaySource;
  seedSongId: string | null;
  position: number | null;
  startedAt: string;
  playedMs: number;
  durationMs: number | null;
  endReason: PlayEndReason;
  platform: 'app';
}

interface ActivePlay extends Omit<PlayEvent, 'endReason'> {
  lastPositionSeconds: number;
}

const QUEUE_KEY = '@syncvibe/play_events_queue';
const ACTIVE_KEY = '@syncvibe/active_play';
const MAX_QUEUED_EVENTS = 200;
const BATCH_SIZE = 50;
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000;
/** A longer jump between progress ticks is a seek, which isn't listening. */
const MAX_TICK_SECONDS = 15;
const END_OF_SONG_SECONDS = 15;

let enabled = false;
let active: ActivePlay | null = null;
let pendingEndReason: PlayEndReason | null = null;
let sessionId: string | null = null;
let lastActivityAt = 0;
let isFlushing = false;
let queueWrites: Promise<unknown> = Promise.resolve();
const recommendations = new Map<string, { seedSongId: string; position: number }>();

const currentSessionId = (): string => {
  const now = Date.now();
  if (!sessionId || now - lastActivityAt > NEW_SESSION_AFTER_MS) {
    sessionId = Crypto.randomUUID();
  }
  lastActivityAt = now;
  return sessionId;
};

const readQueue = async (): Promise<PlayEvent[]> => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    return stored ? (JSON.parse(stored) as PlayEvent[]) : [];
  } catch {
    return [];
  }
};

/** One change at a time, so an event saved while another write is running can't be lost. */
const updateQueue = (change: (queue: PlayEvent[]) => PlayEvent[]): Promise<void> => {
  const write = queueWrites.then(async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(change(await readQueue())));
  });
  queueWrites = write.catch(console.error);
  return write;
};

const send = async (events: PlayEvent[]): Promise<void> => {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders.Cookie) throw new Error('Not logged in');
  await axios.post(
    `${API_URL}/api/play-events`,
    { events },
    { headers: authHeaders, timeout: 10000 }
  );
};

/** Sends saved events. Anything that fails stays saved and goes with the next attempt. */
export const flushPlayEvents = async (): Promise<void> => {
  if (isFlushing) return;
  isFlushing = true;
  try {
    while (true) {
      await queueWrites;
      const batch = (await readQueue()).slice(0, BATCH_SIZE);
      if (batch.length === 0) return;
      try {
        await send(batch);
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        // The server refused this batch and will refuse it again, so don't retry it forever.
        const rejected = status === 400 || status === 413;
        if (!rejected) return;
      }
      const sent = new Set(batch.map((event) => event.eventId));
      await updateQueue((queue) => queue.filter((event) => !sent.has(event.eventId)));
    }
  } catch (error) {
    console.error('Error sending play events:', error);
  } finally {
    isFlushing = false;
  }
};

const enqueue = async (event: PlayEvent): Promise<void> => {
  // Written before sending so that closing the app can't lose it.
  await updateQueue((queue) => [...queue, event].slice(-MAX_QUEUED_EVENTS));
  await flushPlayEvents();
};

const inferEndReason = (play: ActivePlay): PlayEndReason => {
  if (pendingEndReason) return pendingEndReason;
  // The native queue moved on by itself: only the song ending does that, unless a headset
  // or other outside control pressed next without going through the bridge.
  const remaining = (play.durationMs ?? 0) / 1000 - play.lastPositionSeconds;
  return remaining <= END_OF_SONG_SECONDS ? 'completed' : 'next';
};

const finish = (play: ActivePlay, endReason: PlayEndReason) => {
  const { lastPositionSeconds: _position, ...event } = play;
  enqueue({ ...event, endReason }).catch(console.error);
};

const saveActive = () => {
  const write = active
    ? AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(active))
    : AsyncStorage.removeItem(ACTIVE_KEY);
  write.catch(console.error);
};

const begin = (song: Song, source: PlaySource, positionSeconds = 0) => {
  const recommendation = recommendations.get(song.id);
  const isRecommendation = source !== 'resume' && !!recommendation;
  active = {
    eventId: Crypto.randomUUID(),
    songId: song.id,
    sessionId: currentSessionId(),
    source: isRecommendation ? 'recommendation' : source,
    seedSongId: isRecommendation ? recommendation.seedSongId : null,
    position: isRecommendation ? recommendation.position : null,
    startedAt: new Date().toISOString(),
    playedMs: 0,
    durationMs: song.duration ? Number(song.duration) * 1000 : null,
    lastPositionSeconds: positionSeconds,
    platform: 'app',
  };
  pendingEndReason = null;
  saveActive();
};

/** Only logged-in listens are recorded. */
export const setPlayEventsEnabled = (value: boolean) => {
  enabled = value;
  if (!value) {
    active = null;
    pendingEndReason = null;
    saveActive();
  }
};

/** Says why the current song is about to change, ahead of the track change itself. */
export const setPlayEndReason = (reason: PlayEndReason, keepExisting = false) => {
  if (keepExisting && pendingEndReason) return;
  pendingEndReason = reason;
};

/** Remembers which songs came from a recommendation, to credit them if they're played. */
export const markRecommendations = (seedSongId: string, songs: Array<{ id: string }>) => {
  songs.forEach((song, position) => recommendations.set(song.id, { seedSongId, position }));
};

export const recordPlayStart = (song: Song, resumed = false) => {
  if (!enabled) return;
  if (active?.songId === song.id) {
    // Same song carrying on or loaded again, not a new listen.
    pendingEndReason = null;
    return;
  }
  const previousReason = pendingEndReason;
  if (active) finish(active, inferEndReason(active));
  const movedThroughQueue =
    !previousReason || previousReason === 'next' || previousReason === 'completed';
  begin(song, resumed ? 'resume' : movedThroughQueue ? 'queue' : 'direct');
};

export const recordPlayProgress = (
  song: Song,
  positionSeconds: number,
  durationSeconds: number
) => {
  if (!enabled) return;
  // Playing again after the player stopped, or after a restart, without a track change.
  if (!active) begin(song, 'resume', positionSeconds);
  if (!active || active.songId !== song.id) return;

  const delta = positionSeconds - active.lastPositionSeconds;
  if (delta > 0 && delta <= MAX_TICK_SECONDS) active.playedMs += Math.round(delta * 1000);
  active.lastPositionSeconds = positionSeconds;
  if (durationSeconds > 0) active.durationMs = Math.round(durationSeconds * 1000);
  lastActivityAt = Date.now();
  saveActive();
};

export const recordPlayEnd = (reason: PlayEndReason) => {
  if (active) finish(active, reason);
  active = null;
  pendingEndReason = null;
  saveActive();
};

/** On launch: a listen still open means the app was killed during it. */
export const recoverPlayEvents = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_KEY);
    if (stored && !active) {
      const play = JSON.parse(stored) as ActivePlay;
      await AsyncStorage.removeItem(ACTIVE_KEY);
      finish(play, 'closed');
      return;
    }
    await flushPlayEvents();
  } catch (error) {
    console.error('Error recovering play events:', error);
  }
};
