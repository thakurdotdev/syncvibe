import {
  PlaybackContextValue,
  PlaybackState,
  PlayerControls,
  PlaylistContextValue,
  PlaylistState,
} from '@/types/music';
import { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { playbackHistory } from '@/utils/playbackHistory';
import { setupPlayer } from '@/utils/playerSetup';
import streamingManager from '@/utils/streamingManager';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import TrackPlayer, {
  Event,
  RepeatMode,
  State,
  Track,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { getPlaybackState } from 'react-native-track-player/lib/src/trackPlayer';
import { useUser } from './UserContext';

const trackCache = new Map<string, Track>();

const MAX_TRACK_CACHE_SIZE = 50;

// LRU cache implementation for track conversion
const addToTrackCache = (songId: string, track: Track) => {
  // Remove oldest item if cache is full
  if (trackCache.size >= MAX_TRACK_CACHE_SIZE) {
    const oldestKey = trackCache.keys().next().value;
    if (oldestKey !== undefined) {
      trackCache.delete(oldestKey);
    }
  }

  // Add new track to cache
  trackCache.set(songId, track);
};

// Clear track cache when memory is low
const clearTrackCache = () => {
  trackCache.clear();
  console.log('Track cache cleared');
};

// Context definitions remain unchanged
const PlayerControlsContext = createContext<PlayerControls | undefined>(undefined);

const PlayerStateContext = createContext<PlaybackContextValue | undefined>(undefined);
const PlaylistContext = createContext<PlaylistContextValue | undefined>(undefined);

// Reducers remain unchanged
const playbackReducer = (
  state: PlaybackState,
  action: { type: string; payload?: any }
): PlaybackState => {
  switch (action.type) {
    case 'SET_CURRENT_SONG':
      return { ...state, currentSong: action.payload };
    case 'STOP_SONG':
      return { ...state, currentSong: null, isPlaying: false };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

const playlistReducer = (
  state: PlaylistState,
  action: { type: string; payload?: any }
): PlaylistState => {
  switch (action.type) {
    case 'SET_PLAYLIST':
      return { ...state, playlist: action.payload };
    case 'SET_USER_PLAYLIST':
      return { ...state, userPlaylist: action.payload };
    case 'REMOVE_FROM_PLAYLIST':
      return {
        ...state,
        playlist: state.playlist.filter((song) => song.id !== action.payload),
      };
    case 'CLEAR_PLAYLIST':
      return { ...state, playlist: [] };
    case 'ADD_TO_PLAYLIST':
      const newSongs = Array.isArray(action.payload) ? action.payload : [action.payload];
      const uniqueSongs = newSongs.filter(
        (newSong) => !state.playlist.some((song) => song.id === newSong.id)
      );
      return {
        ...state,
        playlist: [...state.playlist, ...uniqueSongs],
      };
    case 'REORDER_PLAYLIST':
      return {
        ...state,
        playlist: action.payload,
      };
    default:
      return state;
  }
};

export const usePlayer = (): PlayerControls => {
  const context = useContext(PlayerControlsContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};

export const usePlayerState = (): PlaybackContextValue => {
  const context = useContext(PlayerStateContext);
  if (!context) throw new Error('usePlayerState must be used within a PlayerProvider');
  return context;
};

export const usePlaylist = (): PlaylistContextValue => {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error('usePlaylist must be used within a PlayerProvider');
  return context;
};

const convertSongToTrack = async (song: Song): Promise<Track> => {
  // Check if we have this track cached already
  if (trackCache.has(song.id)) {
    return trackCache.get(song.id)!;
  }

  try {
    // Use streaming manager for high-quality streaming with caching
    const track = await streamingManager.convertSongToStreamingTrack(song);

    // Use the optimized caching function
    addToTrackCache(song.id, track);

    return track;
  } catch (error) {
    console.error(`Failed to get streaming track for ${song.name}:`, error);

    // Fallback to original logic if streaming manager fails
    const audioUrl =
      song.download_url[3]?.link ||
      song.download_url[2]?.link ||
      song.download_url[1]?.link ||
      song.download_url[0]?.link;

    const artwork = song.image[2]?.link || song.image[1]?.link || song.image[0]?.link;

    const track = {
      id: song.id,
      url: audioUrl,
      title: song.name || 'Unknown Title',
      artist: song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist',
      album: song.album || 'Unknown Album',
      artwork: artwork,
      duration: song.duration || 0,
    };

    // Use the optimized caching function
    addToTrackCache(song.id, track);

    return track;
  }
};

interface PlayerProviderProps {
  children: ReactNode;
}

export function MusicProvider({ children }: PlayerProviderProps) {
  const api = useApi();
  const { user } = useUser();
  const trackPlayerInitialized = useRef(false);
  const playerSetupComplete = useRef(false);
  const playbackStateRef = useRef<PlaybackState>({
    currentSong: null,
    isPlaying: false,
    isLoading: false,
  });
  const playerSetupPromise = useRef<Promise<boolean> | null>(null);
  const queueUpdateInProgress = useRef(false);
  const pendingPlayAction = useRef<(() => Promise<void>) | null>(null);
  const isSwitchingTracks = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const appStartTime = useRef(Date.now());

  const [playbackState, playbackDispatch] = useReducer(playbackReducer, {
    currentSong: null,
    isPlaying: false,
    isLoading: false,
  });

  const [playlistState, playlistDispatch] = useReducer(playlistReducer, {
    playlist: [] as Song[],
    userPlaylist: [] as Song[],
  });

  useEffect(() => {
    if (!playerSetupPromise.current) {
      playbackHistory
        .preloadHistoryData()
        .catch((err) => console.error('Error preloading history data:', err));

      AppState.addEventListener('change', (nextAppState) => {
        const previousAppState = appStateRef.current;
        appStateRef.current = nextAppState;

        if (nextAppState === 'background') {
          if (trackCache.size > MAX_TRACK_CACHE_SIZE / 2) {
            clearTrackCache();
          }

          // If app goes to background, let playbackHistory know
          if (playbackStateRef.current.isPlaying) {
            // We're still playing, but app is in background
            playbackHistory.pausePlayback().catch((err) => {
              console.error('Error pausing playback history:', err);
            });
          }
        }

        if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
          // App came to foreground
          if (playbackStateRef.current.isPlaying) {
            // If still playing, resume playback tracking
            playbackHistory.resumePlayback().catch((err) => {
              console.error('Error resuming playback history:', err);
            });
          }
          const updateCurrentPosition = async () => {
            try {
              if (playbackStateRef.current.currentSong && trackPlayerInitialized.current) {
                const position = await TrackPlayer.getProgress().then(
                  (progress) => progress.position
                );
                const duration = await TrackPlayer.getProgress().then(
                  (progress) => progress.duration
                );

                if (position > 0 && playbackStateRef.current.currentSong) {
                  // Always update current position when app comes to foreground
                  playbackHistory.updatePlaybackProgress(
                    playbackStateRef.current.currentSong,
                    position,
                    duration,
                    playbackStateRef.current.isPlaying
                  );
                }
              }
            } catch (e) {
              console.error('Error updating position on app foreground:', e);
            }
          };

          updateCurrentPosition();
        }
      });

      playerSetupPromise.current = setupPlayer()
        .then(async (isSetup) => {
          trackPlayerInitialized.current = isSetup;
          playerSetupComplete.current = isSetup;

          if (pendingPlayAction.current) {
            pendingPlayAction.current();
            pendingPlayAction.current = null;
          }

          if (isSetup && !playbackStateRef.current.currentSong) {
            try {
              // Set loading state to true to show visual feedback to user
              playbackDispatch({ type: 'SET_LOADING', payload: true });

              const lastPlayedData = await playbackHistory.getLastPlayedSong();

              if (lastPlayedData && lastPlayedData.song) {
                const { song: lastPlayedSong, position } = lastPlayedData;
                console.log(
                  `Restoring last played song: ${
                    lastPlayedSong.name
                  } at position ${position.toFixed(2)}s`
                );

                const trackPromise = convertSongToTrack(lastPlayedSong);

                playbackDispatch({
                  type: 'SET_CURRENT_SONG',
                  payload: lastPlayedSong,
                });

                await TrackPlayer.reset();

                const track = await trackPromise;

                if (track.url) {
                  try {
                    await TrackPlayer.add([track]);

                    // Set repeat mode to Off to prevent auto-advancing to next track
                    await TrackPlayer.setRepeatMode(RepeatMode.Off);

                    // Don't auto-play the restored track which can cause unwanted track changes
                    await TrackPlayer.pause();

                    if (position > 0) {
                      await TrackPlayer.seekTo(position);
                      console.log(`Restored playback position to ${position.toFixed(2)} seconds`);
                    }

                    playbackDispatch({ type: 'SET_LOADING', payload: false });
                  } catch (queueError) {
                    console.error('Failed to add track to queue:', queueError);
                    try {
                      await TrackPlayer.reset();
                      await TrackPlayer.add([track]);
                      if (position > 0) {
                        await TrackPlayer.seekTo(position);
                      }
                      playbackDispatch({ type: 'SET_LOADING', payload: false });
                    } catch (retryError) {
                      console.error('Error during recovery attempt:', retryError);
                      playbackDispatch({ type: 'SET_LOADING', payload: false });
                    }
                  }
                } else {
                  console.error('Failed to restore last song: Missing URL');
                  playbackDispatch({ type: 'STOP_SONG' });
                  playbackDispatch({ type: 'SET_LOADING', payload: false });
                }
              }
            } catch (error) {
              console.error('Error loading last played song:', error);
              playbackDispatch({ type: 'SET_LOADING', payload: false });

              try {
                await TrackPlayer.reset();
              } catch (e) {
                console.error('Error resetting player after failure:', e);
              }
            }
          }

          return isSetup;
        })
        .catch((error) => {
          console.error('Error initializing TrackPlayer:', error);
          playerSetupPromise.current = null;
          return false;
        });
    }

    return () => {
      const cleanup = async () => {
        try {
          if (trackPlayerInitialized.current) {
            await TrackPlayer.reset();
          }
        } catch (error) {
          console.error('Error cleaning up TrackPlayer:', error);
        }
      };

      cleanup();
    };
  }, []);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Ensure we cleanup the playbackHistory manager
      playbackHistory.destroy();

      // Clean up track player if initialized
      if (trackPlayerInitialized.current) {
        // Use the correct TrackPlayer teardown method
        TrackPlayer.reset().catch((err: Error) => {
          console.error('Error resetting TrackPlayer:', err);
        });
      }
    };
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        try {
          if (playbackStateRef.current.currentSong?.id && trackPlayerInitialized.current) {
            const { position, duration } = await TrackPlayer.getProgress();
            if (position > 0 && duration > 0) {
              // Always update when app goes to background
              await playbackHistory.updatePlaybackProgress(
                playbackStateRef.current.currentSong,
                position,
                duration,
                playbackStateRef.current.isPlaying
              );
              console.log(`Saved position ${position}s before app went to background`);
            }
          }
        } catch (error) {
          console.error('Error saving playback position on app state change:', error);
        }
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  useTrackPlayerEvents(
    [
      Event.PlaybackState,
      Event.PlaybackError,
      Event.PlaybackActiveTrackChanged,
      Event.PlaybackQueueEnded,
      Event.RemoteDuck,
      Event.RemotePlay,
      Event.RemotePause,
      Event.RemoteStop,
      Event.RemoteNext,
      Event.RemotePrevious,
      Event.RemoteSeek,
      Event.RemoteJumpForward,
      Event.RemoteJumpBackward,
      Event.PlaybackProgressUpdated,
    ],
    async (event) => {
      try {
        // Skip event processing if player isn't ready
        if (!trackPlayerInitialized.current) return;

        switch (event.type) {
          case Event.PlaybackState:
            const playerState = (await getPlaybackState()).state;
            const isNowPlaying = playerState === State.Playing;

            // Only update UI if state actually changed
            if (isNowPlaying !== playbackStateRef.current.isPlaying) {
              playbackDispatch({
                type: 'SET_PLAYING',
                payload: isNowPlaying,
              });

              // Update the playback history with the new playing state
              if (playbackStateRef.current.currentSong) {
                const { position, duration } = await TrackPlayer.getProgress();
                playbackHistory.updatePlaybackProgress(
                  playbackStateRef.current.currentSong,
                  position,
                  duration,
                  isNowPlaying
                );
              }
            }
            break;

          case Event.PlaybackActiveTrackChanged:
            if (event.index !== undefined && event.track) {
              const trackId = event.track.id;

              if (trackId) {
                const songIndex = playlistState.playlist.findIndex((song) => song.id === trackId);

                if (songIndex >= 0) {
                  const currentSong = playlistState.playlist[songIndex];

                  // Only update if the song actually changed
                  if (currentSong.id !== playbackStateRef.current.currentSong?.id) {
                    // Update current song in React state
                    playbackDispatch({
                      type: 'SET_CURRENT_SONG',
                      payload: currentSong,
                    });

                    // Log when track changes
                    console.log(
                      `Now playing: ${currentSong.name} by ${
                        currentSong?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist'
                      }`
                    );

                    // Preload next tracks for seamless playback
                    streamingManager
                      .preloadNextTracks(playlistState.playlist, songIndex)
                      .catch((err) => {
                        console.error('Error preloading next tracks:', err);
                      });

                    // Update playback history if user is logged in
                    if (user?.userid && currentSong.id) {
                      const duration = currentSong.duration || 0;

                      // Only update history if the track change wasn't triggered during app startup
                      if (playerSetupComplete.current && Date.now() - appStartTime.current > 3000) {
                        playbackHistory
                          .updatePlaybackProgress(currentSong, 0, duration, true)
                          .catch((err) => {
                            console.error('Error updating playback history:', err);
                          });
                      }
                    }
                  }
                }
              }
            }

            // Reset track switching flag
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
            break;

          case Event.PlaybackError:
            console.error(`Playback error: ${event.code} - ${event.message}`);

            // Handle streaming errors with fallback logic
            if (playbackStateRef.current.currentSong) {
              const currentSong = playbackStateRef.current.currentSong;
              console.log(`Attempting to recover from playback error for: ${currentSong.name}`);

              // Try to get a fallback URL from streaming manager
              try {
                const fallbackTrack = await convertSongToTrack(currentSong);
                if (fallbackTrack.url) {
                  console.log(`Found fallback URL, retrying playback`);
                  await TrackPlayer.reset();
                  await TrackPlayer.add([fallbackTrack]);
                  await TrackPlayer.play();
                  playbackDispatch({ type: 'SET_LOADING', payload: false });
                  return;
                }
              } catch (fallbackError) {
                console.error('Fallback URL also failed:', fallbackError);
              }
            }

            playbackDispatch({ type: 'SET_LOADING', payload: false });
            break;

          case Event.PlaybackQueueEnded:
            // Handle queue end by playing the next song from playlist state
            if (playbackStateRef.current.currentSong && playlistState.playlist.length > 0) {
              console.log('TrackPlayer queue ended, playing next song from playlist state');
              controls.handleNextSong();
            } else if (playbackStateRef.current.currentSong) {
              // Just restart current song if it's the only one
              controls.handlePlayPauseSong();
              playbackDispatch({ type: 'SET_LOADING', payload: false });
            }
            break;

          case Event.RemoteDuck:
            if (!event.paused && event.permanent === false) {
              // Audio focus regained, we can resume if we were playing before
              const wasPlaying = playbackStateRef.current.isPlaying;
              if (wasPlaying) {
                await TrackPlayer.play();
              }
            }
            break;

          // Remote control events - optimized for immediate response
          case Event.RemotePlay:
            await TrackPlayer.play();
            playbackDispatch({ type: 'SET_PLAYING', payload: true });
            break;

          case Event.RemotePause:
            await TrackPlayer.pause();
            playbackDispatch({ type: 'SET_PLAYING', payload: false });
            break;

          case Event.RemoteStop:
            controls.stopSong();
            break;

          case Event.RemoteNext:
            // Handle remote next using our local playlist state
            console.log('Remote next button pressed, using local playlist');
            isSwitchingTracks.current = true;
            playbackDispatch({ type: 'SET_LOADING', payload: true });
            controls.handleNextSong();
            break;

          case Event.RemotePrevious:
            // Handle remote previous using our local playlist state
            console.log('Remote previous button pressed, using local playlist');
            isSwitchingTracks.current = true;
            playbackDispatch({ type: 'SET_LOADING', payload: true });
            controls.handlePrevSong();
            break;

          case Event.RemoteSeek:
            if (event.position !== undefined) {
              await TrackPlayer.seekTo(event.position);
            }
            break;

          case Event.RemoteJumpForward:
            const currentPositionForward = await TrackPlayer.getProgress().then(
              (progress) => progress.position
            );

            await TrackPlayer.seekTo(currentPositionForward + (event.interval || 10));
            break;

          case Event.RemoteJumpBackward:
            const currentPositionBackward = await TrackPlayer.getProgress().then(
              (progress) => progress.position
            );
            await TrackPlayer.seekTo(Math.max(0, currentPositionBackward - (event.interval || 10)));
            break;

          case Event.PlaybackProgressUpdated:
            if (
              event.position &&
              event.position > 0 &&
              playbackStateRef.current.currentSong &&
              playbackStateRef.current.isPlaying // Only update when actually playing
            ) {
              if (event.position > 5 && event.duration - event.position > 5) {
                if (Math.floor(event.position) % 10 === 0) {
                  playbackHistory.updatePlaybackProgress(
                    playbackStateRef.current.currentSong,
                    event.position,
                    event.duration,
                    playbackStateRef.current.isPlaying
                  );
                }
              }
            }
            break;
        }
      } catch (error) {
        console.error('Error handling TrackPlayer event:', error);
        isSwitchingTracks.current = false;
        playbackDispatch({ type: 'SET_LOADING', payload: false });
      }
    }
  );

  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

  const controls: PlayerControls = useMemo(
    () => ({
      playSong: async (song: Song) => {
        if (!song?.id) return;

        try {
          playbackDispatch({ type: 'SET_CURRENT_SONG', payload: song });
          playbackDispatch({ type: 'SET_LOADING', payload: true });
          playbackDispatch({ type: 'SET_PLAYING', payload: true });

          // Check if the song exists in the playlist
          const songExistsInPlaylist = playlistState.playlist.some((s) => s.id === song.id);

          // If not in playlist, clear the queue and add just this song
          if (!songExistsInPlaylist) {
            console.log('Song not in playlist, adding to queue:', song.name);
            playlistDispatch({ type: 'SET_PLAYLIST', payload: [song] });
          }

          const playOperation = async () => {
            try {
              await TrackPlayer.reset();

              const track = await convertSongToTrack(song);

              if (!track.url) {
                console.error('Song has no playable URL:', song.id);
                playbackDispatch({ type: 'SET_LOADING', payload: false });
                return;
              }
              await TrackPlayer.setRepeatMode(RepeatMode.Off);
              await TrackPlayer.add([track]);
              await TrackPlayer.play();

              if (user?.userid && song.id) {
                playbackHistory
                  .updatePlaybackProgress(song, 0, song.duration || 0, true) // Starting playback so isPlaying is true
                  .catch((err: any) => {
                    console.error('Error updating playback history:', err);
                  });
              }

              playbackDispatch({ type: 'SET_LOADING', payload: false });
            } catch (error) {
              console.error('Error in play operation:', error);
              playbackDispatch({ type: 'SET_LOADING', payload: false });
            }
          };
          if (playerSetupComplete.current) {
            await playOperation();
          }
        } catch (error) {
          console.error('Song play error:', error);
          playbackDispatch({ type: 'SET_LOADING', payload: false });
        }
      },

      stopSong: async () => {
        try {
          playbackDispatch({ type: 'STOP_SONG' });

          // Stop playback history tracking
          await playbackHistory.stopPlayback().catch((err) => {
            console.error('Error stopping playback history:', err);
          });

          if (trackPlayerInitialized.current) {
            await TrackPlayer.stop();
            await TrackPlayer.reset();
          }
        } catch (error) {
          console.error('Stop song error:', error);
        }
      },

      handlePlayPauseSong: async () => {
        try {
          const newPlayingState = !playbackStateRef.current.isPlaying;
          // Update UI immediately for responsiveness
          playbackDispatch({ type: 'SET_PLAYING', payload: newPlayingState });

          if (!trackPlayerInitialized.current) {
            if (playerSetupPromise.current) {
              await playerSetupPromise.current;
            } else {
              return;
            }
          }

          // Update playback history with new playing state
          if (playbackStateRef.current.currentSong) {
            const { position, duration } = await TrackPlayer.getProgress();
            playbackHistory.updatePlaybackProgress(
              playbackStateRef.current.currentSong,
              position,
              duration,
              newPlayingState
            );
          }

          const playerState = await TrackPlayer.getState();

          if (newPlayingState) {
            if (playerState === State.None && playbackStateRef.current.currentSong) {
              await controls.playSong(playbackStateRef.current.currentSong);
            } else {
              await TrackPlayer.play();
            }
          } else {
            await TrackPlayer.pause();
          }
        } catch (error) {
          console.error('Error toggling play/pause:', error);
          // Revert UI state if operation failed
          playbackDispatch({
            type: 'SET_PLAYING',
            payload: !playbackStateRef.current.isPlaying,
          });
        }
      },

      addToPlaylist: async (songs: Song | Song[]) => {
        const newSongs = Array.isArray(songs) ? songs : [songs];
        // Update playlist state
        playlistDispatch({
          type: 'SET_PLAYLIST',
          payload: newSongs,
        });

        // Add to TrackPlayer queue if initialized
        if (trackPlayerInitialized.current) {
          try {
            // Convert all tracks at once
            const tracksToAdd = await Promise.all(newSongs.map(convertSongToTrack));
            const validTracks = tracksToAdd.filter((track) => track.url);

            if (validTracks.length > 0) {
              await TrackPlayer.add(validTracks);
              console.log(`Added ${validTracks.length} tracks to player queue`);
            }
          } catch (error) {
            console.error('Error adding tracks to player queue:', error);
          }
        }
      },

      clearQueue: async () => {
        playlistDispatch({ type: 'CLEAR_PLAYLIST' });

        if (playbackStateRef.current.isPlaying) {
          playbackDispatch({ type: 'SET_PLAYING', payload: false });
        }

        if (trackPlayerInitialized.current) {
          await TrackPlayer.reset();
          playbackDispatch({ type: 'STOP_SONG' });
        }
      },

      addToQueue: async (songs: Song | Song[]) => {
        if (queueUpdateInProgress.current) return;
        queueUpdateInProgress.current = true;

        try {
          const newSongs = Array.isArray(songs) ? songs : [songs];
          console.log(`Adding ${newSongs.length} songs to queue`);

          const currentSongId = playbackStateRef.current.currentSong?.id;
          const uniqueNewSongs = newSongs.filter(
            (song) =>
              song.id !== currentSongId && !playlistState.playlist.some((s) => s.id === song.id)
          );

          if (uniqueNewSongs.length > 0) {
            playlistDispatch({
              type: 'ADD_TO_PLAYLIST',
              payload: [playbackStateRef.current.currentSong, ...uniqueNewSongs],
            });
          }
        } catch (error) {
          console.error('Queue addition error:', error);
        } finally {
          queueUpdateInProgress.current = false;
        }
      },

      removeFromQueue: async (songId: string) => {
        try {
          // Update playlist state
          playlistDispatch({ type: 'REMOVE_FROM_PLAYLIST', payload: songId });

          if (trackPlayerInitialized.current) {
            const currentSongId = playbackStateRef.current.currentSong?.id;

            // If removing currently playing song
            if (currentSongId === songId) {
              playbackDispatch({ type: 'SET_LOADING', payload: true });

              // Stop current song
              playbackDispatch({ type: 'STOP_SONG' });
              await TrackPlayer.stop();

              // Play next song if available
              if (playlistState.playlist.length > 0) {
                setTimeout(() => controls.handleNextSong(), 100);
              }
            } else {
              // Remove from player queue
              try {
                const currentQueue = await TrackPlayer.getQueue();
                const songIndex = currentQueue.findIndex((track) => track.id === songId);

                if (songIndex >= 0) {
                  await TrackPlayer.remove(songIndex);
                }
              } catch (error) {
                console.error('Error removing from player queue:', error);
              }
            }
          }
        } catch (error) {
          console.error('Queue removal error:', error);
        }
      },

      reorderPlaylist: async (newPlaylistOrder: Song[]) => {
        try {
          // Update the playlist state with the new order
          playlistDispatch({
            type: 'REORDER_PLAYLIST',
            payload: newPlaylistOrder,
          });

          // If the player is initialized, update the queue without resetting
          if (trackPlayerInitialized.current) {
            // Get current queue and active track
            const currentQueue = await TrackPlayer.getQueue();
            const currentTrackIndex = await TrackPlayer.getActiveTrackIndex();
            const currentTrack =
              currentTrackIndex != null && currentTrackIndex >= 0
                ? currentQueue[currentTrackIndex]
                : undefined;
            const currentTrackId = currentTrack?.id;

            // Find where the current track is in the new order
            const newCurrentIndex = newPlaylistOrder.findIndex(
              (song) => song.id === currentTrackId
            );

            if (newCurrentIndex >= 0) {
              const isPlaying = (await getPlaybackState()).state;

              // Remove upcoming tracks and add new ones
              await TrackPlayer.removeUpcomingTracks();

              // Add tracks after current position
              if (newCurrentIndex < newPlaylistOrder.length - 1) {
                const tracksToAdd = await Promise.all(
                  newPlaylistOrder.slice(newCurrentIndex + 1).map(convertSongToTrack)
                );
                const filteredTracks = tracksToAdd.filter((track) => track.url);

                if (filteredTracks.length > 0) {
                  await TrackPlayer.add(filteredTracks);
                }
              }

              // Restore playback state
              if (isPlaying) {
                await TrackPlayer.play();
              }
            } else {
              // Current track not in new order, handle gracefully
              if (currentTrack) {
                // Add new tracks in background
                setTimeout(async () => {
                  const tracksToAdd = await Promise.all(
                    newPlaylistOrder.slice(0, 5).map(convertSongToTrack)
                  );
                  const filteredTracks = tracksToAdd.filter((track) => track.url);

                  if (filteredTracks.length > 0) {
                    await TrackPlayer.add(filteredTracks);
                  }

                  // Add remaining tracks in background
                  if (newPlaylistOrder.length > 5) {
                    setTimeout(async () => {
                      const remainingTracks = await Promise.all(
                        newPlaylistOrder.slice(5).map(convertSongToTrack)
                      );
                      const filteredRemaining = remainingTracks.filter((track) => track.url);

                      if (filteredRemaining.length > 0) {
                        await TrackPlayer.add(filteredRemaining);
                      }
                    }, 100);
                  }
                }, 100);
              }
            }
          }
        } catch (error) {
          console.error('Error reordering playlist:', error);
        }
      },

      handleNextSong: async () => {
        try {
          if (!trackPlayerInitialized.current) {
            if (playerSetupPromise.current) {
              await playerSetupPromise.current;
            } else {
              playbackDispatch({ type: 'SET_LOADING', payload: false });
              return;
            }
          }

          // Set loading state and track switching flag
          playbackDispatch({ type: 'SET_LOADING', payload: true });
          isSwitchingTracks.current = true;

          // Use local playlist state instead of TrackPlayer queue
          const playlist = playlistState.playlist;
          const currentSongId = playbackStateRef.current.currentSong?.id;

          if (!currentSongId || playlist.length === 0) {
            console.log('No song is currently playing or playlist is empty');
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
            return;
          }

          // Find the current song index in our local playlist state
          const currentIndex = playlist.findIndex((song) => song.id === currentSongId);

          if (currentIndex === -1) {
            console.log('Current song not found in playlist');
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
            return;
          }

          // If we have a next song in the playlist
          if (currentIndex < playlist.length - 1) {
            console.log(`Playing next song from playlist: ${currentIndex} to ${currentIndex + 1}`);

            const nextSong = playlist[currentIndex + 1];
            await controls.playSong(nextSong);

            // Track change logging will be handled by PlaybackActiveTrackChanged event
          } else if (playlist.length > 0) {
            // We're at the end - decide whether to loop or stop
            console.log('Reached end of playlist, playing first song');
            const firstSong = playlist[0];
            await controls.playSong(firstSong);

            // Track change logging will be handled by PlaybackActiveTrackChanged event
          } else {
            // No more songs
            console.log('No more songs in playlist');
            playbackDispatch({ type: 'STOP_SONG' });
            await TrackPlayer.stop();
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
          }
        } catch (error) {
          console.error('Next song error:', error);
          isSwitchingTracks.current = false;
          playbackDispatch({ type: 'SET_LOADING', payload: false });
        }
      },

      handlePrevSong: async () => {
        try {
          if (!trackPlayerInitialized.current) {
            if (playerSetupPromise.current) {
              await playerSetupPromise.current;
            } else {
              playbackDispatch({ type: 'SET_LOADING', payload: false });
              return;
            }
          }

          // Set loading state and track switching flag
          playbackDispatch({ type: 'SET_LOADING', payload: true });
          isSwitchingTracks.current = true;

          // Get current playback position
          const position = await TrackPlayer.getProgress().then((progress) => progress.position);

          // Use local playlist state instead of TrackPlayer queue
          const playlist = playlistState.playlist;
          const currentSongId = playbackStateRef.current.currentSong?.id;

          if (!currentSongId || playlist.length === 0) {
            console.log('No song is currently playing or playlist is empty');
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
            return;
          }

          // Find the current song index in our local playlist state
          const currentIndex = playlist.findIndex((song) => song.id === currentSongId);

          if (currentIndex === -1) {
            console.log('Current song not found in playlist');
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
            return;
          }

          // If we're more than 3 seconds into the song, just restart it
          if (position > 3) {
            console.log('Restarting current track (position > 3s)');
            await TrackPlayer.seekTo(0);
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
          }
          // If we're not at the first track, go to previous
          else if (currentIndex > 0) {
            console.log(
              `Playing previous song from playlist: ${currentIndex} to ${currentIndex - 1}`
            );

            const prevSong = playlist[currentIndex - 1];
            await controls.playSong(prevSong);

            // Track change logging will be handled by PlaybackActiveTrackChanged event
          }
          // If we're at the first track
          else if (currentIndex === 0) {
            console.log('At first track, restarting');
            // Restart current song
            await TrackPlayer.seekTo(0);
            await TrackPlayer.play();
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
          } else {
            console.log('No previous track available');
            isSwitchingTracks.current = false;
            playbackDispatch({ type: 'SET_LOADING', payload: false });
          }
        } catch (error) {
          console.error('Previous song error:', error);
          isSwitchingTracks.current = false;
          playbackDispatch({ type: 'SET_LOADING', payload: false });
        }
      },
    }),
    [playbackState, playlistState.playlist, user?.userid]
  );

  const playbackValue: PlaybackContextValue = {
    ...playbackState,
    setCurrentSong: (song: Song) => playbackDispatch({ type: 'SET_CURRENT_SONG', payload: song }),
    setPlaying: (isPlaying: boolean) =>
      playbackDispatch({ type: 'SET_PLAYING', payload: isPlaying }),

    setLoading: (loading: boolean) => playbackDispatch({ type: 'SET_LOADING', payload: loading }),
    stopSong: () => playbackDispatch({ type: 'STOP_SONG' }),
  };

  const getPlaylists = async () => {
    try {
      if (!user) return;
      const { data } = await api.get(`/api/playlist/get`);
      if (data?.data) {
        playlistDispatch({
          type: 'SET_USER_PLAYLIST',
          payload: data.data,
        });
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  // Fetch playlists when user is available
  useEffect(() => {
    if (user?.userid) {
      getPlaylists();
    }
  }, [user?.userid]);

  const playlistValue: PlaylistContextValue = {
    ...playlistState,
    getPlaylists,
    setPlaylist: (playlist: Song[]) => {
      playlistDispatch({ type: 'SET_PLAYLIST', payload: playlist });
    },
    setUserPlaylist: (playlist: Song[]) => {
      playlistDispatch({ type: 'SET_USER_PLAYLIST', payload: playlist });
    },
  };

  return (
    <PlayerControlsContext.Provider value={controls}>
      <PlayerStateContext.Provider value={playbackValue}>
        <PlaylistContext.Provider value={playlistValue}>{children}</PlaylistContext.Provider>
      </PlayerStateContext.Provider>
    </PlayerControlsContext.Provider>
  );
}
