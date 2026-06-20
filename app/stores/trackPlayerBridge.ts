import { Song } from '@/types/song';
import { playbackHistory } from '@/utils/playbackHistory';
import streamingManager from '@/utils/streamingManager';
import { addToHistory } from '@/utils/api/addToHistory';
import { AppState, AppStateStatus } from 'react-native';
import TrackPlayer, {
  Event,
  RepeatMode,
  State,
  Track,
} from 'react-native-track-player';
import { getPlaybackState } from 'react-native-track-player/lib/src/trackPlayer';
import { setupPlayer } from '@/utils/playerSetup';
import { usePlayerStore, setOnReorderPlaylist } from './playerStore';

const trackCache = new Map<string, Track>();
const MAX_TRACK_CACHE_SIZE = 50;

const addToTrackCache = (songId: string, track: Track) => {
  if (trackCache.size >= MAX_TRACK_CACHE_SIZE) {
    const oldestKey = trackCache.keys().next().value;
    if (oldestKey !== undefined) {
      trackCache.delete(oldestKey);
    }
  }
  trackCache.set(songId, track);
};

export const convertSongToTrack = async (song: Song): Promise<Track> => {
  if (trackCache.has(song.id)) {
    return trackCache.get(song.id)!;
  }

  try {
    const track = await streamingManager.convertSongToStreamingTrack(song);
    addToTrackCache(song.id, track);
    return track;
  } catch (error) {
    console.error(`Failed to get streaming track for ${song.name}:`, error);

    const audioUrl =
      song.download_url[3]?.link ||
      song.download_url[2]?.link ||
      song.download_url[1]?.link ||
      song.download_url[0]?.link;

    const artwork = song.image[2]?.link || song.image[1]?.link || song.image[0]?.link;

    const track: Track = {
      id: song.id,
      url: audioUrl,
      title: song.name || 'Unknown Title',
      artist: song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist',
      album: song.album || 'Unknown Album',
      artwork: artwork,
      duration: song.duration || 0,
    };

    addToTrackCache(song.id, track);
    return track;
  }
};

let trackPlayerInitialized = false;
let isSwitchingTracks = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let prevSongId: string | null = null;

const getStore = () => usePlayerStore.getState();

const getNativeRepeatMode = (mode: 'off' | 'all' | 'one') => {
  if (mode === 'one') return RepeatMode.Track;
  if (mode === 'all') return RepeatMode.Queue;
  return RepeatMode.Off;
};

export const initializeTrackPlayer = async (userId?: number): Promise<boolean> => {
  try {
    await playbackHistory.preloadHistoryData().catch(console.error);

    const isSetup = await setupPlayer();
    trackPlayerInitialized = isSetup;

    if (isSetup) {
      setupAppStateListener(userId);
      await restoreLastPlayedSong();
    }

    return isSetup;
  } catch (error) {
    console.error('Error initializing TrackPlayer:', error);
    return false;
  }
};

const restoreLastPlayedSong = async () => {
  const store = getStore();
  if (store.currentSong) {
    try {
      store.setLoading(true);
      const track = await convertSongToTrack(store.currentSong);

      if (track.url) {
        await TrackPlayer.reset();
        await TrackPlayer.add([track]);
        await TrackPlayer.setRepeatMode(getNativeRepeatMode(store.repeatMode));
        await TrackPlayer.pause();

        const lastPlayedData = await playbackHistory.getLastPlayedSong();
        if (lastPlayedData?.position && lastPlayedData.position > 0) {
          await TrackPlayer.seekTo(lastPlayedData.position);
        }
      }
    } catch (error) {
      console.error('Error restoring last played song:', error);
      store.stopSong();
    } finally {
      store.setLoading(false);
    }
    return;
  }

  try {
    store.setLoading(true);
    const lastPlayedData = await playbackHistory.getLastPlayedSong();

    if (lastPlayedData?.song) {
      const { song, position } = lastPlayedData;
      store.setCurrentSong(song);

      const track = await convertSongToTrack(song);
      if (track.url) {
        await TrackPlayer.reset();
        await TrackPlayer.add([track]);
        await TrackPlayer.setRepeatMode(getNativeRepeatMode(store.repeatMode));
        await TrackPlayer.pause();
        if (position > 0) {
          await TrackPlayer.seekTo(position);
        }
      }
    }
  } catch (error) {
    console.error('Error loading last played song:', error);
    store.stopSong();
  } finally {
    store.setLoading(false);
  }
};

const setupAppStateListener = (userId?: number) => {
  if (appStateSubscription) return;

  appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
    const store = getStore();

    if (nextAppState === 'background') {
      if (trackCache.size > MAX_TRACK_CACHE_SIZE / 2) {
        trackCache.clear();
      }

      if (store.currentSong?.id && trackPlayerInitialized) {
        try {
          const { position, duration } = await TrackPlayer.getProgress();
          if (position > 0 && duration > 0) {
            await playbackHistory.updatePlaybackProgress(
              store.currentSong,
              position,
              duration,
              store.isPlaying
            );
          }
        } catch (error) {
          console.error('Error saving position on background:', error);
        }
      }

      if (store.isPlaying) {
        playbackHistory.pausePlayback().catch(console.error);
      }
    }

    if (nextAppState === 'active') {
      if (store.isPlaying) {
        playbackHistory.resumePlayback().catch(console.error);
      }

      if (store.currentSong && trackPlayerInitialized) {
        try {
          const { position, duration } = await TrackPlayer.getProgress();
          if (position > 0) {
            playbackHistory.updatePlaybackProgress(
              store.currentSong,
              position,
              duration,
              store.isPlaying
            );
          }
        } catch (e) {
          console.error('Error updating position on foreground:', e);
        }
      }
    }
  });
};

export const syncPlaySong = async (song: Song, userId?: number) => {
  if (!trackPlayerInitialized || !song?.id) return;

  const store = getStore();

  try {
    const queue = await TrackPlayer.getQueue();
    const activeTrackIndex = await TrackPlayer.getActiveTrackIndex();
    const trackIndex = queue.findIndex((t) => t.id === song.id);

    if (trackIndex >= 0) {
      if (trackIndex === activeTrackIndex) {
        const playerState = await TrackPlayer.getState();
        if (playerState !== State.Playing) {
          await TrackPlayer.play();
        }
      } else {
        await TrackPlayer.skip(trackIndex);
        await TrackPlayer.play();
      }
      store.setPlaying(true);
      store.setLoading(false);

      const playlist = store.playlist;
      const songIndex = playlist.findIndex((s) => s.id === song.id);
      if (songIndex >= 0 && songIndex < playlist.length - 1) {
        await TrackPlayer.removeUpcomingTracks();
        const nextSongs = playlist.slice(songIndex + 1);
        const nextTracks = await Promise.all(nextSongs.map(convertSongToTrack));
        const validNextTracks = nextTracks.filter((t) => t.url);
        if (validNextTracks.length > 0) {
          await TrackPlayer.add(validNextTracks);
        }
      }

      isSwitchingTracks = false;
      return;
    }

    isSwitchingTracks = true;
    store.setLoading(true);

    await TrackPlayer.reset();
    const track = await convertSongToTrack(song);

    if (!track.url) {
      console.error('Song has no playable URL:', song.id);
      store.setLoading(false);
      isSwitchingTracks = false;
      return;
    }

    await TrackPlayer.setRepeatMode(getNativeRepeatMode(store.repeatMode));
    await TrackPlayer.add([track]);
    await TrackPlayer.play();
    store.setPlaying(true);
    store.setLoading(false);

    if (userId && song.id) {
      playbackHistory
        .updatePlaybackProgress(song, 0, song.duration || 0, true)
        .catch(console.error);
    }

    const playlist = store.playlist;
    const songIndex = playlist.findIndex((s) => s.id === song.id);
    if (songIndex >= 0 && songIndex < playlist.length - 1) {
      const nextSongs = playlist.slice(songIndex + 1);
      const nextTracks = await Promise.all(nextSongs.map(convertSongToTrack));
      const validNextTracks = nextTracks.filter((t) => t.url);
      if (validNextTracks.length > 0) {
        await TrackPlayer.add(validNextTracks);
      }
    }
  } catch (error) {
    console.error('Error in syncPlaySong:', error);
    store.setPlaying(false);
    store.setLoading(false);
  } finally {
    isSwitchingTracks = false;
  }
};

export const syncStopSong = async () => {
  if (!trackPlayerInitialized) return;

  try {
    await playbackHistory.stopPlayback().catch(console.error);
    await TrackPlayer.stop();
    await TrackPlayer.reset();
  } catch (error) {
    console.error('Stop song error:', error);
  }
};

let playPausePromise = Promise.resolve();

export const syncPlayPause = () => {
  if (!trackPlayerInitialized) return;

  const store = getStore();
  const targetPlaying = store.isPlaying;

  playPausePromise = playPausePromise
    .then(async () => {
      try {
        if (store.currentSong) {
          const { position, duration } = await TrackPlayer.getProgress();
          playbackHistory.updatePlaybackProgress(
            store.currentSong,
            position,
            duration,
            targetPlaying
          ).catch(console.error);
        }

        const currentState = await TrackPlayer.getState();
        const currentIsPlaying = currentState === State.Playing;

        if (targetPlaying !== currentIsPlaying) {
          if (targetPlaying) {
            if (currentState === State.None && store.currentSong) {
              await syncPlaySong(store.currentSong);
            } else {
              await TrackPlayer.play();
            }
          } else {
            await TrackPlayer.pause();
          }
        }
      } catch (error) {
        console.error('Error toggling play/pause:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    })
    .catch((error) => {
      console.error('Error in play/pause promise chain:', error);
    });
};

export const syncHandleNextSong = async (userId?: number) => {
  if (!trackPlayerInitialized) return;

  const store = getStore();
  const { currentSong, repeatMode } = store;

  if (repeatMode === 'one' && currentSong) {
    try {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.play();
      store.setPlaying(true);
    } catch (error) {
      console.error('Error repeating song:', error);
    }
    return;
  }

  if (currentSong) {
    await syncPlaySong(currentSong, userId);
  }
};

export const syncHandlePrevSong = async (userId?: number) => {
  if (!trackPlayerInitialized) return;

  try {
    const position = (await TrackPlayer.getProgress()).position;

    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }

    const store = getStore();
    if (store.currentSong) {
      await syncPlaySong(store.currentSong, userId);
    }
  } catch (error) {
    console.error('Error in syncHandlePrevSong:', error);
  }
};

let reorderTimeout: NodeJS.Timeout | null = null;

export const syncReorderPlaylist = (newOrder: Song[]) => {
  if (!trackPlayerInitialized) return;

  if (reorderTimeout) {
    clearTimeout(reorderTimeout);
  }

  reorderTimeout = setTimeout(async () => {
    try {
      const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
      const currentQueue = await TrackPlayer.getQueue();
      const currentTrack =
        currentTrackIndex != null && currentTrackIndex >= 0
          ? currentQueue[currentTrackIndex]
          : undefined;

      if (!currentTrack) return;

      const newCurrentIndex = newOrder.findIndex((song) => song.id === currentTrack.id);

      if (newCurrentIndex >= 0) {
        await TrackPlayer.removeUpcomingTracks();

        if (newCurrentIndex < newOrder.length - 1) {
          const tracksToAdd = await Promise.all(
            newOrder.slice(newCurrentIndex + 1).map(convertSongToTrack)
          );
          const validTracks = tracksToAdd.filter((track) => track.url);
          if (validTracks.length > 0) {
            await TrackPlayer.add(validTracks);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing reorder:', error);
    }
  }, 1000);
};

setOnReorderPlaylist(syncReorderPlaylist);

export const handleTrackPlayerEvents = async (event: any, userId?: number) => {
  if (!trackPlayerInitialized) return;

  const store = getStore();

  try {
    switch (event.type) {
      case Event.PlaybackState: {
        const playerState = (await getPlaybackState()).state;

        if (playerState === State.Playing) {
          if (!store.isPlaying) {
            store.setPlaying(true);
            if (store.currentSong) {
              const { position, duration } = await TrackPlayer.getProgress();
              playbackHistory.updatePlaybackProgress(
                store.currentSong,
                position,
                duration,
                true
              );
            }
          }
        } else if (
          playerState === State.Paused ||
          playerState === State.Stopped ||
          playerState === State.Error
        ) {
          if (store.isPlaying) {
            store.setPlaying(false);
            if (store.currentSong) {
              const { position, duration } = await TrackPlayer.getProgress();
              playbackHistory.updatePlaybackProgress(
                store.currentSong,
                position,
                duration,
                false
              );
            }
          }
        }
        break;
      }

      case Event.PlaybackActiveTrackChanged: {
        if (event.index !== undefined && event.track) {
          const trackId = event.track.id;
          if (trackId) {
            const playlist = store.playlist;
            const songIndex = playlist.findIndex((song) => song.id === trackId);

            if (songIndex >= 0) {
              const currentSong = playlist[songIndex];
              if (currentSong.id !== store.currentSong?.id) {
                store.setCurrentSong(currentSong);
                streamingManager
                  .preloadNextTracks(playlist, songIndex)
                  .catch(console.error);

                if (userId && currentSong.id) {
                  playbackHistory
                    .updatePlaybackProgress(currentSong, 0, currentSong.duration || 0, true)
                    .catch(console.error);
                  addToHistory(currentSong, 10).catch(console.error);
                }
              }
            }
          }
        }
        isSwitchingTracks = false;
        store.setLoading(false);
        break;
      }

      case Event.PlaybackError: {
        console.error(`Playback error: ${event.code} - ${event.message}`);

        if (store.currentSong) {
          try {
            const fallbackTrack = await convertSongToTrack(store.currentSong);
            if (fallbackTrack.url) {
              await TrackPlayer.reset();
              await TrackPlayer.add([fallbackTrack]);
              await TrackPlayer.play();
              store.setLoading(false);
              return;
            }
          } catch (fallbackError) {
            console.error('Fallback URL also failed:', fallbackError);
          }
        }
        store.setLoading(false);
        break;
      }

      case Event.PlaybackQueueEnded: {
        store.handleNextSong(true);

        const updatedStore = getStore();
        if (updatedStore.currentSong && updatedStore.isPlaying !== false) {
          await syncPlaySong(updatedStore.currentSong, userId);
        }
        break;
      }

      case Event.RemotePlay:
        await TrackPlayer.play();
        store.setPlaying(true);
        break;

      case Event.RemotePause:
        await TrackPlayer.pause();
        store.setPlaying(false);
        break;

      case Event.RemoteStop:
        store.stopSong();
        await syncStopSong();
        break;

      case Event.RemoteNext: {
        store.setLoading(true);
        store.handleNextSong();
        const nextStore = getStore();
        if (nextStore.currentSong) {
          await syncPlaySong(nextStore.currentSong, userId);
        }
        break;
      }

      case Event.RemotePrevious: {
        store.setLoading(true);
        const position = (await TrackPlayer.getProgress()).position;
        if (position > 3) {
          await TrackPlayer.seekTo(0);
          store.setLoading(false);
        } else {
          store.handlePrevSong();
          const prevStore = getStore();
          if (prevStore.currentSong) {
            await syncPlaySong(prevStore.currentSong, userId);
          }
        }
        break;
      }

      case Event.RemoteSeek:
        if (event.position !== undefined) {
          await TrackPlayer.seekTo(event.position);
        }
        break;

      case Event.RemoteJumpForward: {
        const pos = (await TrackPlayer.getProgress()).position;
        await TrackPlayer.seekTo(pos + (event.interval || 10));
        break;
      }

      case Event.RemoteJumpBackward: {
        const pos = (await TrackPlayer.getProgress()).position;
        await TrackPlayer.seekTo(Math.max(0, pos - (event.interval || 10)));
        break;
      }

      case Event.RemoteDuck:
        if (!event.paused && event.permanent === false) {
          if (store.isPlaying) {
            await TrackPlayer.play();
          }
        }
        break;

      case Event.PlaybackProgressUpdated: {
        if (
          event.position &&
          event.position > 0 &&
          store.currentSong &&
          store.isPlaying
        ) {
          if (event.position > 5 && event.duration - event.position > 5) {
            if (Math.floor(event.position) % 10 === 0) {
              playbackHistory.updatePlaybackProgress(
                store.currentSong,
                event.position,
                event.duration,
                store.isPlaying
              );
            }
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('Error handling TrackPlayer event:', error);
    isSwitchingTracks = false;
    store.setLoading(false);
  }
};

export const destroyTrackPlayer = async () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }

  playbackHistory.destroy();
  trackCache.clear();

  if (trackPlayerInitialized) {
    try {
      await TrackPlayer.reset();
    } catch (error) {
      console.error('Error resetting TrackPlayer:', error);
    }
    trackPlayerInitialized = false;
  }
};

export const isTrackPlayerReady = () => trackPlayerInitialized;
