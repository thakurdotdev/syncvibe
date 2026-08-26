import { Song } from '@/types/song';
import { playbackHistory } from '@/utils/playbackHistory';
import { AppState, AppStateStatus } from 'react-native';
import TrackPlayer, { Event, RepeatMode } from '@rntp/player';
import { setupPlayer } from '@/utils/playerSetup';
import { setTrackPlayerReady } from './trackPlayerState';
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

let initialized = false;
let userId: number | undefined;
let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

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
 */
const loadPlaylist = (playlist: Song[], startIndex: number) => {
  if (!initialized || !playlist.length) return;

  const s = store();
  const end = Math.min(startIndex + QUEUE_LOOKAHEAD, playlist.length);
  const tracks = toMediaItems(playlist.slice(startIndex, end));

  if (tracks.length === 0) return;

  TrackPlayer.setRepeatMode(toNativeRepeatMode(s.repeatMode));
  TrackPlayer.setMediaItems(tracks, 0);
  TrackPlayer.play();

  const song = playlist[startIndex];
  if (song && song.id !== s.currentSong?.id) {
    s.setCurrentSong(song);
  }
  s.setPlaying(true);
};

let lastHistorySongId: string | null = null;
let lastHistoryTimestamp = 0;

const recordSongStart = (song: Song) => {
  if (!song?.id) return;

  playbackHistory.updatePlaybackProgress(song, 0, song.duration || 0, true).catch(console.error);

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
  if (!initialized || !song?.id) return;
  if (store().activePlayerMode === 'group') return;

  stopGroupPlayback();
  resetErrors();
  switchToNormalMode();

  const s = store();
  const playlist = s.playlist.length ? s.playlist : [song];

  // If the song is already in the native queue, just skip to it
  const queue = TrackPlayer.getQueue();
  const queueIdx = queue.findIndex((t) => t.mediaId === song.id);

  if (queueIdx >= 0) {
    const activeIdx = TrackPlayer.getActiveMediaItemIndex();

    if (queueIdx === activeIdx) {
      if (!TrackPlayer.isPlaying()) TrackPlayer.play();
    } else {
      TrackPlayer.skipToIndex(queueIdx);
      TrackPlayer.play();
    }

    if (song.id !== s.currentSong?.id) {
      s.setCurrentSong(song);
    }
    s.setPlaying(true);
    recordSongStart(song);
    fillQueue();
    return;
  }

  // Song not in queue — rebuild from playlist
  const startIdx = Math.max(
    0,
    playlist.findIndex((s) => s.id === song.id)
  );
  loadPlaylist(playlist, startIdx);
  recordSongStart(song);
  fillQueue();
};

export const bridgeStopSong = async () => {
  if (!initialized) return;
  if (store().activePlayerMode === 'group') return;
  try {
    await playbackHistory.stopPlayback().catch(console.error);
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
    if (s.currentSong) {
      const { position, duration } = TrackPlayer.getProgress();
      playbackHistory
        .updatePlaybackProgress(s.currentSong, position, duration, false)
        .catch(console.error);
    }
  } else if (s.currentSong) {
    resetErrors();
    const state = TrackPlayer.getPlaybackState();
    if (state === 'idle') {
      bridgePlaySong(s.currentSong, userId);
    } else {
      TrackPlayer.play();
      s.setPlaying(true);
      const { position, duration } = TrackPlayer.getProgress();
      playbackHistory
        .updatePlaybackProgress(s.currentSong, position, duration, true)
        .catch(console.error);
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

  // Can we use native skip?
  const queue = TrackPlayer.getQueue();
  const activeIdx = TrackPlayer.getActiveMediaItemIndex();
  const canSkipNative =
    nativeMatchesSong && activeIdx != null && activeIdx >= 0 && activeIdx < queue.length - 1;

  if (canSkipNative) {
    const nextSong = playlist[currentIdx + 1];
    if (nextSong) s.setCurrentSong(nextSong);
    s.setPlaying(true);
    TrackPlayer.skipToNext();
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

export const bridgeHandlePrevSong = (uid?: number) => {
  if (!initialized) return;
  if (store().activePlayerMode === 'group') return;

  stopGroupPlayback();
  switchToNormalMode();

  // If past 3 seconds, restart current track
  const position = TrackPlayer.getProgress().position;
  if (position > 3) {
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
    TrackPlayer.skipToPrevious();
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

export const initializeTrackPlayer = async (uid?: number): Promise<boolean> => {
  try {
    setBridgeUserId(uid);
    await playbackHistory.preloadHistoryData().catch(console.error);

    const isSetup = setupPlayer();
    initialized = isSetup;
    setTrackPlayerReady(isSetup);

    if (isSetup) {
      setupAppStateListener();
      bridgeSetRepeatMode(store().repeatMode);
      await restoreLastPlayedSong();
    }

    return isSetup;
  } catch (error) {
    console.error('Error initializing TrackPlayer:', error);
    return false;
  }
};

const restoreLastPlayedSong = async () => {
  const s = store();
  try {
    const lastPlayed = await playbackHistory.getLastPlayedSong();
    const song = s.currentSong ?? lastPlayed?.song;
    if (!song) return;

    if (!s.currentSong) s.setCurrentSong(song);
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

      // Save progress
      if (s.currentSong?.id && initialized) {
        try {
          const { position, duration } = TrackPlayer.getProgress();
          if (position > 0 && duration > 0) {
            await playbackHistory.updatePlaybackProgress(
              s.currentSong,
              position,
              duration,
              TrackPlayer.isPlaying()
            );
          }
        } catch (error) {
          console.error('Error saving position on background:', error);
        }
      }
    }

    if (state === 'active' && initialized) {
      // Re-sync store with native state on foreground
      try {
        syncStoreFromNative();

        if (s.currentSong) {
          const { position, duration } = TrackPlayer.getProgress();
          if (position > 0) {
            playbackHistory.updatePlaybackProgress(
              s.currentSong,
              position,
              duration,
              TrackPlayer.isPlaying()
            );
          }
        }
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
        if (state === 'ended') {
          bridgeHandleNextSong(true, userId);
        }
        break;
      }

      case Event.IsPlayingChanged: {
        const playing = !!event.playing;
        s.setPlaying(playing);
        if (s.currentSong) {
          const { position, duration } = TrackPlayer.getProgress();
          playbackHistory
            .updatePlaybackProgress(s.currentSong, position, duration, playing)
            .catch(console.error);
        }
        break;
      }

      // ── Track transition → update current song + history ──
      case Event.MediaItemTransition: {
        if (event.item && event.index !== undefined) {
          const trackId = (event.item as MediaItem).mediaId;
          if (trackId) {
            const playlist = s.playlist;
            const songIdx = playlist.findIndex((song) => song.id === trackId);

            if (songIdx >= 0) {
              const song = playlist[songIdx];
              if (song.id !== s.currentSong?.id) {
                s.setCurrentSong(song);
              }

              recordSongStart(song);
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
        await bridgeStopSong();
        break;
      }

      // ── Progress updates → save to playback history ──
      case Event.PlaybackProgressUpdated: {
        const position = event.position as number;
        const duration = event.duration as number;

        // Clear recovery flag once we're actually playing
        if (position > 1 && recovering) {
          resetErrors();
          s.setPlaying(TrackPlayer.isPlaying());
        }

        // Periodic history save (every ~10 seconds)
        if (position > 0 && s.currentSong && TrackPlayer.isPlaying()) {
          if (position > 5 && duration - position > 5 && Math.floor(position) % 10 === 0) {
            playbackHistory
              .updatePlaybackProgress(s.currentSong, position, duration, true)
              .catch(console.error);
          }
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
setOnHandlePrevSong(() => bridgeHandlePrevSong(userId));
setOnRepeatModeChange((mode) => bridgeSetRepeatMode(mode));
setOnAddToQueue(() => fillQueue());
setOnRemoveFromQueue((songId) => bridgeRemoveFromQueue(songId));
