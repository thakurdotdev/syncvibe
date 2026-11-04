import { Song } from '@/types/song';
import { playbackHistory } from '@/utils/playbackHistory';
import { AppState, AppStateStatus } from 'react-native';
import TrackPlayer, { Event, RepeatMode } from '@rntp/player';
import { setupPlayer } from '@/utils/playerSetup';
import { setResumePoint, setTrackPlayerReady, takeResumePoint } from './trackPlayerState';
import {
  usePlayerStore,
  onAfterSongTransition,
  checkAndFetchRecommendations,
  setOnReorderPlaylist,
  setOnPlaySong,
  setOnStopSong,
  setOnPlayPause,
  setOnHandleNextSong,
  setOnHandlePrevSong,
  setOnRepeatModeChange,
  setOnAddToQueue,
  setOnRemoveFromQueue,
  type RepeatMode as StoreRepeatMode,
} from './playerStore';
import { useGroupPlaybackStore } from './groupMusic/groupPlaybackStore';

// ─── Types ───────────────────────────────────────────

interface MediaItem {
  mediaId?: string;
  url: any;
  title?: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
  duration?: number;
  isLive?: boolean;
  mimeType?: string;
  extras?: Record<string, unknown>;
}

// ─── Configuration ───────────────────────────────────

const QUEUE_LOOKAHEAD = 3;
const QUEUE_APPEND_THRESHOLD = 2;
const MAX_TRACK_CACHE_SIZE = 50;
const MAX_ERROR_RETRIES = 2;
const ERROR_COOLDOWN_MS = 8000;
const RESTORE_RETRY_MS = 250;
const RESTORE_MAX_TRIES = 20;
/** A saved spot this close to the end restarts the song instead (it would just end). */
const RESTORE_END_MARGIN_S = 3;
/** A native "ended" this soon after you changed song belongs to the song you just left. */
const ENDED_IGNORE_AFTER_CHANGE_MS = 1500;
/** Wait before trusting "ready but silent": a play command may still be on its way. */
const PAUSE_CHECK_DELAY_MS = 300;

let initialized = false;
let userId: number | undefined;
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
let pendingPlay: { song: Song; uid?: number } | null = null;

let lastSongChangeAt = 0;
let pauseCheckTimer: ReturnType<typeof setTimeout> | null = null;

let errorRetries = 0;
let lastErrorTime = 0;
let recovering = false;

// Track cache for fast song→MediaItem conversion
const trackCache = new Map<string, MediaItem>();

const store = () => usePlayerStore.getState();

const toNativeRepeatMode = (mode: StoreRepeatMode): RepeatMode => {
  if (mode === 'one') return RepeatMode.One;
  if (mode === 'all') return RepeatMode.All;
  return RepeatMode.Off;
};

const addToTrackCache = (songId: string, track: MediaItem) => {
  if (trackCache.size >= MAX_TRACK_CACHE_SIZE) {
    const oldest = trackCache.keys().next().value;
    if (oldest !== undefined) trackCache.delete(oldest);
  }
  trackCache.set(songId, track);
};

/**
 * Convert a Song to a MediaItem synchronously.
 * Uses cached streaming URLs when available.
 */
const toMediaItem = (song: Song): MediaItem | null => {
  if (!song?.id) return null;

  const cached = trackCache.get(song.id);
  if (cached) return cached;

  const downloadUrl =
    song.download_url?.find((u) => u.quality === '320kbps') ??
    song.download_url?.find((u) => u.quality === '128kbps') ??
    song.download_url?.[0];

  if (!downloadUrl?.link) return null;

  const track: MediaItem = {
    mediaId: song.id,
    url: {
      uri: downloadUrl.link,
      headers: { 'User-Agent': 'SyncVibe/1.0', Accept: 'audio/*' },
    },
    title: song.name || 'Unknown Title',
    artist: song.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist',
    albumTitle: song.album || 'Unknown Album',
    artworkUrl: song.image?.[2]?.link || song.image?.[1]?.link || song.image?.[0]?.link,
    duration: song.duration || 0,
  };

  addToTrackCache(song.id, track);
  return track;
};

/** Convert multiple songs, filtering out failures. */
const toMediaItems = (songs: Song[]): MediaItem[] =>
  songs.map(toMediaItem).filter((t): t is MediaItem => t != null && !!t.url);

/** Stop group playback if active (state only, don't touch native player). */
const stopGroupPlayback = () => {
  const group = useGroupPlaybackStore.getState();
  if (group.isPlaying) {
    group.stopProgressPolling();
    useGroupPlaybackStore.setState({ isPlaying: false });
  }
};

const switchToNormalMode = () => {
  const s = store();
  if (s.activePlayerMode !== 'normal') {
    s.setActivePlayerMode('normal');
  }
};

const resetErrors = () => {
  errorRetries = 0;
  recovering = false;
  lastErrorTime = 0;
};

const hasExceededRetries = (): boolean =>
  Date.now() - lastErrorTime < ERROR_COOLDOWN_MS && errorRetries >= MAX_ERROR_RETRIES;

/**
 * Save the native position for your current song. Skipped when the native player holds a
 * different item (the store moves to the next song before native does), so one song's
 * position is never written under another.
 */
const saveNativeProgress = (playing: boolean) => {
  const song = store().currentSong;
  if (!song?.id || store().activePlayerMode !== 'normal') return;
  if (TrackPlayer.getActiveMediaItem()?.mediaId !== song.id) return;
  // Until the resume seek has landed, the native position is a meaningless 0:0x.
  if (resumeGuard?.songId === song.id) return;
  const { position, duration } = TrackPlayer.getProgress();
  return playbackHistory
    .updatePlaybackProgress(song, position, duration || song.duration || 0, playing)
    .catch(console.error);
};

// ─── Resume guard ────────────────────────────────────
//
// A seek sent while the native player is still loading an item is unreliable: the
// media controller may not be connected yet (command dropped), and the session applies
// setMediaItems with a 0:00 start position after our seek. So a resume isn't a single
// seekTo(): it is re-asserted until the player has the item prepared (duration known)
// and its position actually sits at the target.

const RESUME_TICK_MS = 250;
const RESUME_MAX_TICKS = 48; // ~12s: covers a slow network load
const RESUME_TOLERANCE_S = 1.5;

let resumeGuard: { songId: string; target: number } | null = null;
let resumeToken = 0;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

const cancelResumeGuard = () => {
  resumeToken += 1;
  resumeGuard = null;
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
};

const enforceResume = (songId: string, target: number) => {
  cancelResumeGuard();
  if (!(target > 0)) return;
  const token = resumeToken;
  resumeGuard = { songId, target };
  let ticks = 0;

  const tick = () => {
    resumeTimer = null;
    if (token !== resumeToken || !initialized) return;
    try {
      if (TrackPlayer.getActiveMediaItem()?.mediaId === songId) {
        const { position, duration } = TrackPlayer.getProgress();
        if (duration > 0) {
          if (position >= target - RESUME_TOLERANCE_S) {
            resumeGuard = null; // landed (or you've already moved past it)
            return;
          }
          TrackPlayer.seekTo(target);
        }
      }
    } catch {
      // Native not ready yet: try again next tick.
    }
    if (++ticks >= RESUME_MAX_TICKS) {
      resumeGuard = null;
      return;
    }
    resumeTimer = setTimeout(tick, RESUME_TICK_MS);
  };

  tick();
};

/** Resume `songId` at its launch/room resume point, if one is waiting. */
const applyPendingResume = (songId: string) => {
  const resumeAt = takeResumePoint(songId);
  if (resumeAt > 0) enforceResume(songId, resumeAt);
};

const fillQueue = () => {
  if (!initialized) return;

  const { playlist } = store();
  if (!playlist.length) return;

  const queue = TrackPlayer.getQueue();
  const activeIdx = TrackPlayer.getActiveMediaItemIndex() ?? 0;
  const remaining = queue.length - activeIdx - 1;

  if (remaining >= QUEUE_APPEND_THRESHOLD) return;

  const lastItem = queue[queue.length - 1];
  if (!lastItem?.mediaId) return;

  const lastPlaylistIdx = playlist.findIndex((s) => s.id === lastItem.mediaId);
  if (lastPlaylistIdx < 0 || lastPlaylistIdx >= playlist.length - 1) return;

  const start = lastPlaylistIdx + 1;
  const end = Math.min(start + QUEUE_LOOKAHEAD, playlist.length);
  const existingIds = new Set(queue.map((t) => t.mediaId));
  const newSongs = playlist.slice(start, end).filter((s) => !existingIds.has(s.id));

  if (newSongs.length > 0) {
    const tracks = toMediaItems(newSongs);
    if (tracks.length > 0) TrackPlayer.addMediaItems(tracks);
  }
};

/**
 * Load a playlist into the native queue starting at `startIndex` and play.
 * If the song has a saved resume point (restored on launch, or interrupted by a room)
 * it continues from there. Returns true when it resumed rather than started over.
 */
const loadPlaylist = (playlist: Song[], startIndex: number): boolean => {
  if (!initialized || !playlist.length) return false;

  const s = store();
  const end = Math.min(startIndex + QUEUE_LOOKAHEAD, playlist.length);
  const tracks = toMediaItems(playlist.slice(startIndex, end));

  if (tracks.length === 0) return false;

  const song = playlist[startIndex];
  const resumeAt = song ? takeResumePoint(song.id) : 0;

  TrackPlayer.setRepeatMode(toNativeRepeatMode(s.repeatMode));
  TrackPlayer.setMediaItems(tracks, 0);
  if (resumeAt > 0 && song) enforceResume(song.id, resumeAt);
  else cancelResumeGuard();
  TrackPlayer.play();

  if (song && song.id !== s.currentSong?.id) {
    s.setCurrentSong(song);
  }
  s.setPlaying(true);
  return resumeAt > 0;
};

let lastHistorySongId: string | null = null;
/** Bumped whenever a new restore starts or you start playback, cancelling older retries. */
let restoreAttempt = 0;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;
let lastHistoryTimestamp = 0;
let restoredSongId: string | null = null;
/**
 * True from a launch restore until you play something. While set, the paused native
 * player is only holding your spot: its events must not save or advance anything.
 */
let restorePending = false;

const recordSongStart = (song: Song, resumed = false) => {
  if (!song?.id) return;

  // A resumed song keeps its saved position; only a fresh start resets it to 0.
  if (!resumed) {
    playbackHistory.resetProgress(song).catch(console.error);
  }

  const now = Date.now();
  if (lastHistorySongId === song.id && now - lastHistoryTimestamp < 3000) {
    return;
  }
  lastHistorySongId = song.id;
  lastHistoryTimestamp = now;
  onAfterSongTransition?.(song);
  checkAndFetchRecommendations(song);
};

// ─── Public Bridge Functions ─────────────────────────

export const setBridgeUserId = (id?: number) => {
  userId = id;
};

export const bridgePlaySong = (song: Song, uid?: number) => {
  if (!song?.id) return;

  // The UI can be interacted with before the deferred native player setup has
  // completed. Keep the user's first play request instead of dropping it.
  if (!initialized) {
    pendingPlay = { song, uid };
    store().setLoading(true);
    return;
  }

  if (store().activePlayerMode === 'group') return;

  stopGroupPlayback();
  resetErrors();
  switchToNormalMode();
  lastSongChangeAt = Date.now();
  // You're choosing playback now: a still-pending launch restore must not override it.
  restoreAttempt += 1;
  restorePending = false;

  const s = store();
  const playlist = s.playlist.length ? s.playlist : [song];

  // If the song is already in the native queue, just skip to it
  const queue = TrackPlayer.getQueue();
  const queueIdx = queue.findIndex((t) => t.mediaId === song.id);

  if (queueIdx >= 0) {
    const activeIdx = TrackPlayer.getActiveMediaItemIndex();

    if (queueIdx === activeIdx) {
      // Already loaded at its saved spot (e.g. restored on launch): just continue.
      applyPendingResume(song.id);
      if (!TrackPlayer.isPlaying()) TrackPlayer.play();
    } else {
      cancelResumeGuard();
      TrackPlayer.skipToIndex(queueIdx);
      TrackPlayer.play();
    }

    if (song.id !== s.currentSong?.id) {
      s.setCurrentSong(song);
    }
    s.setPlaying(true);
    recordSongStart(song, queueIdx === activeIdx);
    fillQueue();
    return;
  }

  // Song not in queue — rebuild from playlist
  const startIdx = Math.max(
    0,
    playlist.findIndex((s) => s.id === song.id)
  );
  const resumed = loadPlaylist(playlist, startIdx);
  recordSongStart(song, resumed);
  fillQueue();
};

export const bridgeStopSong = async () => {
  if (!initialized) return;
  if (store().activePlayerMode === 'group') return;
  try {
    const currentSong = store().currentSong;
    if (currentSong) {
      const { position, duration } = TrackPlayer.getProgress();
      await playbackHistory
        .updatePlaybackProgress(currentSong, position, duration || currentSong.duration || 0, false)
        .catch(console.error);
    }
    TrackPlayer.stop();
    TrackPlayer.clear();
  } catch (error) {
    console.error('Stop song error:', error);
  }
};

export const bridgePlayPause = () => {
  if (!initialized) return;
  if (store().activePlayerMode === 'group') return;

  stopGroupPlayback();
  switchToNormalMode();
  restoreAttempt += 1;
  restorePending = false;

  const s = store();
  const activeItem = TrackPlayer.getActiveMediaItem();

  // If native player doesn't match the store, re-load the song
  if (activeItem?.mediaId !== s.currentSong?.id) {
    if (s.currentSong) {
      bridgePlaySong(s.currentSong, userId);
    } else {
      s.setPlaying(false);
    }
    return;
  }

  if (TrackPlayer.isPlaying()) {
    TrackPlayer.pause();
    s.setPlaying(false);
    saveNativeProgress(false);
  } else if (s.currentSong) {
    resetErrors();
    const state = TrackPlayer.getPlaybackState();
    if (state === 'idle') {
      bridgePlaySong(s.currentSong, userId);
    } else {
      applyPendingResume(s.currentSong.id);
      TrackPlayer.play();
      s.setPlaying(true);
    }
  } else {
    s.setPlaying(false);
  }
};

export const bridgeHandleNextSong = (isAutoPlay = false, uid?: number) => {
  if (!initialized) return;
  if (store().activePlayerMode === 'group') return;

  stopGroupPlayback();
  switchToNormalMode();
  if (!isAutoPlay) {
    lastSongChangeAt = Date.now();
    restoreAttempt += 1;
    restorePending = false;
    cancelResumeGuard();
  }

  const s = store();
  const { currentSong, playlist, repeatMode } = s;
  if (!currentSong || !playlist.length) return;

  const activeItem = TrackPlayer.getActiveMediaItem();
  const nativeMatchesSong = activeItem?.mediaId === currentSong.id;

  // Repeat one: restart current track (manual skip only)
  if (repeatMode === 'one' && !isAutoPlay) {
    TrackPlayer.seekTo(0);
    TrackPlayer.play();
    s.setPlaying(true);
    return;
  }

  // Repeat one auto-play: native handles this via RepeatMode.One
  if (isAutoPlay && repeatMode === 'one') return;

  const currentIdx = playlist.findIndex((song) => song.id === currentSong.id);
  if (currentIdx === -1) {
    if (playlist.length > 0) {
      s.setCurrentSong(playlist[0]);
      bridgePlaySong(playlist[0], uid);
    }
    return;
  }

  const isLast = currentIdx === playlist.length - 1;

  // End of playlist with repeat off
  if (isAutoPlay && isLast && repeatMode === 'off') {
    s.setPlaying(false);
    return;
  }

  // Already in the native queue? Jump to that exact item: after a reorder the item after
  // the current one natively may not be the next song in your queue.
  const nextInPlaylist = playlist[currentIdx + 1];
  const nextQueueIdx =
    nativeMatchesSong && nextInPlaylist
      ? TrackPlayer.getQueue().findIndex((t) => t.mediaId === nextInPlaylist.id)
      : -1;

  if (nextQueueIdx >= 0) {
    s.setCurrentSong(nextInPlaylist);
    s.setPlaying(true);
    TrackPlayer.skipToIndex(nextQueueIdx);
    // Skipping while paused must start the new song, or the UI says playing in silence.
    TrackPlayer.play();
    fillQueue();
    return;
  }

  // Repeat all: wrap around
  if (isAutoPlay && isLast && repeatMode === 'all') {
    s.setCurrentSong(playlist[0]);
    loadPlaylist(playlist, 0);
    fillQueue();
    return;
  }

  // Default: play next song
  const nextIdx = (currentIdx + 1) % playlist.length;
  const nextSong = playlist[nextIdx];
  s.setCurrentSong(nextSong);
  s.setPlaying(true);
  bridgePlaySong(nextSong, uid);
};

export const bridgeHandlePrevSong = (uid?: number, force = false) => {
  if (!initialized) return;
  if (store().activePlayerMode === 'group') return;

  stopGroupPlayback();
  switchToNormalMode();
  lastSongChangeAt = Date.now();
  restoreAttempt += 1;
  restorePending = false;
  cancelResumeGuard();

  // If past 3 seconds, restart current track
  const position = TrackPlayer.getProgress().position;
  if (!force && position > 3) {
    TrackPlayer.seekTo(0);
    return;
  }

  const s = store();
  const { currentSong, playlist } = s;
  if (!currentSong || !playlist.length) return;

  const activeItem = TrackPlayer.getActiveMediaItem();
  const nativeMatchesSong = activeItem?.mediaId === currentSong.id;
  const queue = TrackPlayer.getQueue();
  const activeIdx = TrackPlayer.getActiveMediaItemIndex();

  // Try native skip
  if (nativeMatchesSong && activeIdx != null && activeIdx > 0) {
    const prevTrack = queue[activeIdx - 1];
    const prevSong = prevTrack?.mediaId
      ? playlist.find((s) => s.id === prevTrack.mediaId)
      : undefined;
    if (prevSong) s.setCurrentSong(prevSong);
    s.setPlaying(true);
    // skipToPrevious() restarts the song when past a few seconds; go by index when forced.
    if (force) TrackPlayer.skipToIndex(activeIdx - 1);
    else TrackPlayer.skipToPrevious();
    TrackPlayer.play();
    return;
  }

  // Fallback: play from playlist
  const currentIdx = playlist.findIndex((s) => s.id === currentSong.id);
  const prevIdx = currentIdx > 0 ? currentIdx - 1 : 0;
  const prevSong = playlist[prevIdx];
  s.setCurrentSong(prevSong);
  s.setPlaying(true);
  bridgePlaySong(prevSong, uid);
};

export const bridgeSetRepeatMode = (mode: StoreRepeatMode) => {
  if (!initialized) return;
  TrackPlayer.setRepeatMode(toNativeRepeatMode(mode));
};

export const bridgeRemoveFromQueue = (songId: string) => {
  if (!initialized) return;

  const queue = TrackPlayer.getQueue();
  const idx = queue.findIndex((t) => t.mediaId === songId);
  if (idx < 0) return;

  const activeIdx = TrackPlayer.getActiveMediaItemIndex();
  if (activeIdx !== null && idx === activeIdx) return;

  try {
    TrackPlayer.removeMediaItems(idx, idx + 1);
  } catch (error) {
    console.error('Error removing track from queue:', error);
  }
};

// ─── Playlist Reorder ────────────────────────────────

let reorderTimeout: ReturnType<typeof setTimeout> | null = null;

export const syncReorderPlaylist = (newOrder: Song[]) => {
  if (!initialized) return;

  if (reorderTimeout) clearTimeout(reorderTimeout);

  reorderTimeout = setTimeout(() => {
    try {
      const activeIdx = TrackPlayer.getActiveMediaItemIndex();
      const queue = TrackPlayer.getQueue();
      const activeTrack = activeIdx != null && activeIdx >= 0 ? queue[activeIdx] : undefined;
      if (!activeTrack?.mediaId) return;

      const newIdx = newOrder.findIndex((song) => song.id === activeTrack.mediaId);
      if (newIdx < 0) return;

      const currentQueue = TrackPlayer.getQueue();
      if (currentQueue.length > newIdx + 1) {
        TrackPlayer.removeMediaItems(newIdx + 1, currentQueue.length);
      }

      const existingIds = new Set(TrackPlayer.getQueue().map((t) => t.mediaId));
      const toAdd = newOrder
        .slice(newIdx + 1, newIdx + 1 + QUEUE_LOOKAHEAD)
        .filter((s) => !existingIds.has(s.id));

      if (toAdd.length > 0) {
        const tracks = toMediaItems(toAdd);
        if (tracks.length > 0) TrackPlayer.addMediaItems(tracks);
      }
    } catch (error) {
      console.error('Error syncing reorder:', error);
    }
  }, 500);
};

// ─── State Sync ──────────────────────────────────────

/**
 * Sync zustand store from native player state.
 * Called on app foreground to pick up changes that happened in background.
 */
const syncStoreFromNative = () => {
  const s = store();
  if (s.activePlayerMode === 'group') return;
  const activeItem = TrackPlayer.getActiveMediaItem();

  if (activeItem?.mediaId) {
    const song = s.playlist.find((p) => p.id === activeItem.mediaId);
    if (song && song.id !== s.currentSong?.id) {
      s.setCurrentSong(song);
    }
  }

  // Sync playing state from native — this is the source of truth
  s.setPlaying(TrackPlayer.isPlaying());
};

// ─── Initialization ──────────────────────────────────

export const initializeTrackPlayer = async (): Promise<boolean> => {
  try {
    await playbackHistory.preloadHistoryData().catch(console.error);

    const isSetup = setupPlayer();
    initialized = isSetup;
    setTrackPlayerReady(isSetup);

    if (isSetup) {
      setupAppStateListener();
      bridgeSetRepeatMode(store().repeatMode);
      await restoreLastPlayedSong();

      if (pendingPlay) {
        const nextPlay = pendingPlay;
        pendingPlay = null;
        bridgePlaySong(nextPlay.song, nextPlay.uid);
      }
    }

    if (!isSetup) {
      pendingPlay = null;
      store().setLoading(false);
      store().setPlaying(false);
    }

    return isSetup;
  } catch (error) {
    console.error('Error initializing TrackPlayer:', error);
    pendingPlay = null;
    store().setLoading(false);
    store().setPlaying(false);
    return false;
  }
};

/** The persisted queue/current song load asynchronously; restoring before that races it. */
const waitForStoreHydration = () =>
  new Promise<void>((resolve) => {
    const persist = usePlayerStore.persist;
    if (!persist || persist.hasHydrated()) return resolve();
    const timeout = setTimeout(done, 3000);
    const unsub = persist.onFinishHydration(done);
    function done() {
      clearTimeout(timeout);
      unsub();
      resolve();
    }
  });

const restoreLastPlayedSong = async () => {
  await waitForStoreHydration();
  const s = store();
  try {
    const lastPlayed = await playbackHistory.getLastPlayedSong();
    if (!lastPlayed?.song) return;

    const song = lastPlayed.song;
    const existingPlaylist = s.playlist.filter((item) => item?.id);
    const savedSongIndex = existingPlaylist.findIndex((item) => item.id === song.id);
    const playlist = savedSongIndex >= 0 ? existingPlaylist : [song];
    const startIndex = savedSongIndex >= 0 ? savedSongIndex : 0;
    const tracks = toMediaItems(playlist.slice(startIndex, startIndex + QUEUE_LOOKAHEAD));

    if (tracks.length === 0) return;

    const duration = Number.isFinite(lastPlayed.duration)
      ? lastPlayed.duration
      : song.duration || 0;
    const savedPosition = Number.isFinite(lastPlayed.position)
      ? Math.max(lastPlayed.position, 0)
      : 0;
    // Seeking to (or past) the end makes the native player report "ended", which used to
    // auto-advance to the next song on launch. A song that was basically over restarts.
    const position =
      duration > 0 && savedPosition > duration - RESTORE_END_MARGIN_S ? 0 : savedPosition;

    // The native queue is empty after a cold start. Restore it directly rather
    // than calling bridgePlaySong(), which intentionally records a new song at
    // position 0.
    if (s.currentSong?.id !== song.id) s.setCurrentSong(song);
    // Restore where you left off, but never start audio on its own: opening the app
    // stays silent until you press play.
    s.setPlaying(false);
    s.setLoading(false);
    restoredSongId = song.id;
    restorePending = true;
    // If the native load below doesn't stick, pressing play still resumes here.
    setResumePoint(song.id, position);

    const attempt = ++restoreAttempt;
    const apply = () => {
      TrackPlayer.setRepeatMode(toNativeRepeatMode(store().repeatMode));
      TrackPlayer.setMediaItems(tracks, 0);
      TrackPlayer.pause();
    };

    // setupPlayer() connects the native media controller asynchronously, and commands
    // sent before it connects are silently dropped: that's why the song used to come
    // back at 0:00. Re-send the restore until the native queue actually holds it.
    let tries = 0;
    const settle = () => {
      restoreTimer = null;
      if (attempt !== restoreAttempt || !initialized) return;
      const st = store();
      if (st.activePlayerMode !== 'normal' || st.currentSong?.id !== song.id) return;

      if (TrackPlayer.getQueue().length > 0) {
        // Loaded: park the paused player on your saved spot (the play button re-checks it).
        if (position > 0) enforceResume(song.id, position);
        fillQueue();
        return;
      }
      if (tries++ >= RESTORE_MAX_TRIES) return;
      apply();
      restoreTimer = setTimeout(settle, RESTORE_RETRY_MS);
    };

    apply();
    restoreTimer = setTimeout(settle, RESTORE_RETRY_MS);
  } catch (error) {
    console.error('Error restoring last played song:', error);
  }
};

const setupAppStateListener = () => {
  if (appStateSub) return;

  appStateSub = AppState.addEventListener('change', async (state: AppStateStatus) => {
    const s = store();

    if (state === 'background') {
      // Trim cache on background
      if (trackCache.size > MAX_TRACK_CACHE_SIZE / 2) trackCache.clear();

      // Save progress (not during a room: the native position belongs to the room's song)
      if (s.currentSong?.id && initialized && !restorePending) {
        try {
          await saveNativeProgress(TrackPlayer.isPlaying());
        } catch (error) {
          console.error('Error saving position on background:', error);
        }
      }
    }

    if (state === 'active' && initialized) {
      // Re-sync store with native state on foreground
      try {
        syncStoreFromNative();
        if (!restorePending) saveNativeProgress(TrackPlayer.isPlaying());
      } catch (error) {
        console.error('Error resyncing on foreground:', error);
      }
    }
  });
};

export const dispatchTrackPlayerEvent = async (event: { type: string; [key: string]: unknown }) => {
  if (!initialized) return;

  const s = store();

  if (s.activePlayerMode === 'group') {
    if (event.type === Event.RemoteStop) {
      const group = useGroupPlaybackStore.getState();
      if (group.isPlaying) {
        TrackPlayer.pause();
        group.stopProgressPolling();
        useGroupPlaybackStore.setState({ isPlaying: false });
      }
      TrackPlayer.stop();
      TrackPlayer.clear();
    }
    return;
  }

  try {
    switch (event.type) {
      case Event.PlaybackStateChanged: {
        const state = event.state as string;
        if (state === 'ready') {
          // Buffering doesn't update the store (see IsPlayingChanged), so if a pause landed
          // during it, catch up here once a pending play command has had time to arrive.
          if (pauseCheckTimer) clearTimeout(pauseCheckTimer);
          pauseCheckTimer = setTimeout(() => {
            pauseCheckTimer = null;
            const st = store();
            if (st.activePlayerMode !== 'normal' || !st.isPlaying) return;
            if (TrackPlayer.getPlaybackState() === 'ready' && !TrackPlayer.isPlaying()) {
              st.setPlaying(false);
            }
          }, PAUSE_CHECK_DELAY_MS);
        }
        if (state === 'ended') {
          if (restorePending) {
            // The restored spot ran past the stream's real end: hold the song at the
            // start instead of skipping to the next one before you pressed play.
            cancelResumeGuard();
            TrackPlayer.seekTo(0);
            TrackPlayer.pause();
            break;
          }
          // A late "ended" from the song you just left must not skip the one you chose.
          const stale =
            Date.now() - lastSongChangeAt < ENDED_IGNORE_AFTER_CHANGE_MS ||
            TrackPlayer.getActiveMediaItem()?.mediaId !== s.currentSong?.id;
          if (stale) break;
          bridgeHandleNextSong(true, userId);
        }
        break;
      }

      case Event.IsPlayingChanged: {
        const playing = !!event.playing;
        if (playing) restorePending = false;
        // isPlaying also goes false while buffering (loading a song, seeking). That isn't a
        // pause: only believe it when the player is ready and really silent. Real stops
        // (end of queue, errors, stop) set the store themselves.
        const reallyPaused =
          !playing && TrackPlayer.getPlaybackState() === 'ready' && !TrackPlayer.isPlaying();
        if (playing || reallyPaused) s.setPlaying(playing);
        if (!restorePending) saveNativeProgress(playing);
        break;
      }

      // ── Track transition → update current song + history ──
      case Event.MediaItemTransition: {
        if (event.item && event.index !== undefined) {
          const trackId = (event.item as MediaItem).mediaId;
          // Quick skips can leave this event behind: acting on it would pull you back a song.
          if (trackId && TrackPlayer.getActiveMediaItem()?.mediaId !== trackId) break;
          if (trackId) {
            // Restoring (and any re-send of the restore) emits transitions too. They
            // must not overwrite the saved position with a fresh 0:00 start, and neither
            // may one for a song whose resume seek hasn't landed yet.
            const isRestoredTransition =
              (restorePending && restoredSongId === trackId) || resumeGuard?.songId === trackId;

            const playlist = s.playlist;
            const songIdx = playlist.findIndex((song) => song.id === trackId);

            if (songIdx >= 0) {
              const song = playlist[songIdx];
              if (song.id !== s.currentSong?.id) {
                s.setCurrentSong(song);
              }

              if (!isRestoredTransition) {
                recordSongStart(song);
              }
            }
          }
        }

        resetErrors();
        fillQueue();
        break;
      }

      // ── Playback error → retry or skip ──
      case Event.PlaybackError: {
        console.error(`Playback error: ${event.code} - ${event.message}`);
        lastErrorTime = Date.now();

        if (recovering || hasExceededRetries()) {
          recovering = false;
          s.setPlaying(false);
          TrackPlayer.pause();
          break;
        }

        // Use RNTP v5's retry() for clean error recovery
        errorRetries += 1;
        recovering = true;

        try {
          TrackPlayer.retry();
          TrackPlayer.play();
        } catch {
          // retry() failed — try rebuilding with fresh URL
          if (s.currentSong) {
            trackCache.delete(s.currentSong.id);
            const fresh = toMediaItem(s.currentSong);
            if (fresh?.url) {
              TrackPlayer.stop();
              TrackPlayer.clear();
              TrackPlayer.setMediaItems([fresh]);
              TrackPlayer.play();
              s.setPlaying(true);
              break;
            }
          }
          // Everything failed
          recovering = false;
          s.setPlaying(false);
        }
        break;
      }

      // ── Remote stop ──
      case Event.RemoteStop: {
        s.stopSong();
        break;
      }

      // ── Progress updates → save to playback history ──
      case Event.PlaybackProgressUpdated: {
        const position = event.position as number;
        const duration = event.duration as number;
        const mediaId = event.mediaId as string | undefined;

        // Clear recovery flag once we're actually playing
        if (position > 1 && recovering) {
          resetErrors();
          s.setPlaying(TrackPlayer.isPlaying());
        }

        // Native ticks every 5s while playing (progressSync in playerSetup), plus one
        // final tick on pause. Save it so a killed app comes back to this spot.
        if (restorePending || !s.currentSong || mediaId !== s.currentSong.id) break;
        if (position >= 1) {
          playbackHistory
            .updatePlaybackProgress(
              s.currentSong,
              position,
              duration > 0 ? duration : s.currentSong.duration || 0,
              TrackPlayer.isPlaying()
            )
            .catch(console.error);
        }
        break;
      }
    }
  } catch (error) {
    console.error('Error handling TrackPlayer event:', error);
  }
};

export const handleTrackPlayerEvents = dispatchTrackPlayerEvent;

// ─── Cleanup ─────────────────────────────────────────

export const destroyTrackPlayer = async () => {
  pendingPlay = null;
  if (pauseCheckTimer) {
    clearTimeout(pauseCheckTimer);
    pauseCheckTimer = null;
  }
  restoredSongId = null;
  restorePending = false;
  cancelResumeGuard();
  restoreAttempt += 1;
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (reorderTimeout) {
    clearTimeout(reorderTimeout);
    reorderTimeout = null;
  }

  lastHistorySongId = null;
  lastHistoryTimestamp = 0;

  playbackHistory.destroy();
  trackCache.clear();
  resetErrors();

  if (initialized) {
    try {
      TrackPlayer.stop();
      TrackPlayer.clear();
    } catch (error) {
      console.error('Error resetting TrackPlayer:', error);
    }
    initialized = false;
  }
};

export const isTrackPlayerReady = () => initialized;

setOnReorderPlaylist(syncReorderPlaylist);
setOnPlaySong((song) => bridgePlaySong(song, userId));
setOnStopSong(() => bridgeStopSong());
setOnPlayPause(() => bridgePlayPause());
setOnHandleNextSong((isAutoPlay) => bridgeHandleNextSong(isAutoPlay, userId));
setOnHandlePrevSong((force) => bridgeHandlePrevSong(userId, force));
setOnRepeatModeChange((mode) => bridgeSetRepeatMode(mode));
setOnAddToQueue(() => fillQueue());
setOnRemoveFromQueue((songId) => bridgeRemoveFromQueue(songId));
