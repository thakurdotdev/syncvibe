import axios from 'axios';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useCallback,
} from 'react';
import { Context } from './Context';
import { ensureHttpsForDownloadUrls, addToHistory } from '@/Pages/Music/Common';

// Separate contexts for different concerns
const PlayerControlsContext = createContext();
const PlayerTimeContext = createContext();
const PlayerStateContext = createContext();
const PlaylistContext = createContext();
const SleepTimerContext = createContext();

// Time-related state reducer
const timeReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    default:
      return state;
  }
};

// Playback state reducer
const playbackReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CURRENT_SONG':
      return { ...state, currentSong: action.payload };
    case 'STOP_SONG':
      return { ...state, currentSong: null, isPlaying: false };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: Math.min(Math.max(action.payload, 0), 1) };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
};

// Playlist state reducer
const playlistReducer = (state, action) => {
  switch (action.type) {
    case 'SET_PLAYLIST':
      return {
        ...state,
        playlist: action.payload,
      };
    case 'SET_USER_PLAYLIST':
      return { ...state, userPlaylist: action.payload };
    default:
      return state;
  }
};

const sleepTimerReducer = (state, action) => {
  switch (action.type) {
    case 'SET_TIMER':
      return {
        ...state,
        timeRemaining: action.payload.time,
        songsRemaining: action.payload.songs,
        isActive: true,
      };
    case 'UPDATE_TIME':
      return {
        ...state,
        timeRemaining: Math.max(0, state.timeRemaining - 1),
      };
    case 'UPDATE_SONGS':
      return {
        ...state,
        songsRemaining: Math.max(0, state.songsRemaining - 1),
      };
    case 'CLEAR_TIMER':
      return {
        timeRemaining: 0,
        songsRemaining: 0,
        isActive: false,
      };
    default:
      return state;
  }
};

// Custom hooks for accessing specific parts of state
export const usePlayer = () => useContext(PlayerControlsContext);
export const usePlayerTime = () => useContext(PlayerTimeContext);
export const usePlayerState = () => useContext(PlayerStateContext);
export const usePlaylist = () => useContext(PlaylistContext);
export const useSleepTimer = () => useContext(SleepTimerContext);

export function PlayerProvider({ children }) {
  const { user, loading } = useContext(Context);
  const audioRef = useRef(null);
  const prevSongRef = useRef(null);
  const nextAudioRef = useRef(null);
  const lastUpdateTime = useRef(0);
  const timerIntervalRef = useRef(null);

  const [timeState, timeDispatch] = useReducer(timeReducer, {
    currentTime: 0,
    duration: 0,
  });

  const [playbackState, playbackDispatch] = useReducer(playbackReducer, {
    currentSong: null,
    isPlaying: false,
    volume: 1,
    isLoading: false,
  });

  const [playlistState, playlistDispatch] = useReducer(playlistReducer, {
    playlist: [],
    userPlaylist: [],
  });

  const [sleepTimerState, sleepTimerDispatch] = useReducer(sleepTimerReducer, {
    timeRemaining: 0,
    songsRemaining: 0,
    isActive: false,
  });

  const getAudioUrl = useCallback((song) => {
    return song?.download_url?.[4]?.link || song?.download_url?.[3]?.link || '';
  }, []);

  const preloadNextTrack = useCallback(() => {
    if (!playlistState.playlist.length || !playbackState.currentSong) return;

    const currentIndex = playlistState.playlist.findIndex(
      (song) => song.id === playbackState.currentSong.id
    );
    const nextIndex = (currentIndex + 1) % playlistState.playlist.length;
    const nextSong = playlistState.playlist[nextIndex];

    if (nextSong && nextAudioRef.current) {
      nextAudioRef.current.src = getAudioUrl(nextSong);
      nextAudioRef.current.load();
    }
  }, [playlistState.playlist, playbackState.currentSong, getAudioUrl]);

  const timeValue = useMemo(
    () => ({
      ...timeState,
      updateTime: (time) => timeDispatch({ type: 'UPDATE_TIME', payload: time }),
      setDuration: (duration) => timeDispatch({ type: 'SET_DURATION', payload: duration }),
    }),
    [timeState]
  );

  const playbackValue = useMemo(
    () => ({
      ...playbackState,
      setCurrentSong: (song) => playbackDispatch({ type: 'SET_CURRENT_SONG', payload: song }),
      setPlaying: (isPlaying) => playbackDispatch({ type: 'SET_PLAYING', payload: isPlaying }),
      setVolume: (volume) => playbackDispatch({ type: 'SET_VOLUME', payload: volume }),
      setLoading: (loading) => playbackDispatch({ type: 'SET_LOADING', payload: loading }),
      stopSong: () => playbackDispatch({ type: 'STOP_SONG' }),
    }),
    [playbackState]
  );

  const controls = useMemo(
    () => ({
      playSong: (song) => {
        if (!song?.id) return;
        playbackDispatch({ type: 'SET_LOADING', payload: true });
        const secureAudio = ensureHttpsForDownloadUrls(song);
        const newAudio = new Audio(getAudioUrl(secureAudio));
        newAudio.load();
        playbackDispatch({ type: 'SET_CURRENT_SONG', payload: secureAudio });
        playbackDispatch({ type: 'SET_LOADING', payload: false });
      },

      stopSong: () => {
        playbackDispatch({ type: 'STOP_SONG' });
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
        }
        document.title = 'SyncVibe';
      },

      handlePlayPauseSong: () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (playbackState.isPlaying) {
          audio.pause();
        } else {
          audio.play().catch(console.error);
        }
        playbackDispatch({
          type: 'SET_PLAYING',
          payload: !playbackState.isPlaying,
        });
      },

      handleTimeSeek: (time) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          timeDispatch({ type: 'UPDATE_TIME', payload: time });
        }
      },

      handleVolumeChange: (value) => {
        const newVolume = Math.min(Math.max(value, 0), 1);
        if (audioRef.current) {
          audioRef.current.volume = newVolume;
          playbackDispatch({ type: 'SET_VOLUME', payload: newVolume });
        }
      },

      addToPlaylist: (songs) => {
        const newSongs = Array.isArray(songs) ? songs : [songs];
        playlistDispatch({
          type: 'SET_PLAYLIST',
          payload: newSongs,
        });
      },

      addToQueue: (songs) => {
        const currentPlaylist = playlistState.playlist || [];
        const newSongs = Array.isArray(songs) ? songs : [songs];

        // Create a Set of existing IDs
        const existingIds = new Set(currentPlaylist.map((song) => song.id));

        // Filter out duplicates
        const uniqueNewSongs = newSongs.filter((song) => !existingIds.has(song.id));

        // Only update if we have new songs to add
        if (uniqueNewSongs.length > 0) {
          const updatedPlaylist = [...currentPlaylist, ...uniqueNewSongs];
          playlistDispatch({
            type: 'SET_PLAYLIST',
            payload: updatedPlaylist,
          });
        }
      },

      handleNextSong: () => {
        if (!playlistState.playlist.length || !playbackState.currentSong) return;
        const currentIndex = playlistState.playlist.findIndex(
          (song) => song.id === playbackState.currentSong.id
        );
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % playlistState.playlist.length;
          const nextSong = playlistState.playlist[nextIndex];
          controls.playSong(nextSong);
        } else {
          controls.playSong(playlistState.playlist[0]);
          const newPlaylist = playlistState.playlist.slice(1);
          playlistDispatch({ type: 'SET_PLAYLIST', payload: newPlaylist });
        }
      },

      handlePrevSong: () => {
        if (!playlistState.playlist.length || !playbackState.currentSong) return;
        const currentIndex = playlistState.playlist.findIndex(
          (song) => song.id === playbackState.currentSong.id
        );
        if (currentIndex !== -1) {
          const prevIndex =
            (currentIndex - 1 + playlistState.playlist.length) % playlistState.playlist.length;
          const prevSong = playlistState.playlist[prevIndex];
          controls.playSong(prevSong);
        }
      },
    }),
    [playbackState.isPlaying, playlistState.playlist, playbackState.currentSong, getAudioUrl]
  );

  const sleepTimerValue = useMemo(
    () => ({
      ...sleepTimerState,
      setSleepTimer: (minutes = 0, songs = 0) => {
        // Clear existing timer if any
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }

        if (minutes > 0) {
          sleepTimerDispatch({
            type: 'SET_TIMER',
            payload: { time: minutes * 60, songs: 0 },
          });

          timerIntervalRef.current = setInterval(() => {
            sleepTimerDispatch({ type: 'UPDATE_TIME' });
          }, 1000);
        } else if (songs > 0) {
          sleepTimerDispatch({
            type: 'SET_TIMER',
            payload: { time: 0, songs },
          });
        }
      },
      clearSleepTimer: () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        sleepTimerDispatch({ type: 'CLEAR_TIMER' });
      },
    }),
    [sleepTimerState]
  );

  useEffect(() => {
    if (sleepTimerState.isActive) {
      if (sleepTimerState.timeRemaining === 0 && sleepTimerState.songsRemaining === 0) {
        controls.stopSong();
        sleepTimerDispatch({ type: 'CLEAR_TIMER' });
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      }
    }
  }, [sleepTimerState]);

  useEffect(() => {
    if (sleepTimerState.isActive && sleepTimerState.songsRemaining > 0) {
      sleepTimerDispatch({ type: 'UPDATE_SONGS' });
    }
  }, [playbackState.currentSong]);

  const updateMediaSession = useCallback(
    (song) => {
      if (!('mediaSession' in navigator)) return;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.name,
        artist: song?.artist_map?.artists
          ?.slice(0, 3)
          ?.map((artist) => artist.name)
          .join(', '),
        album: song?.album,
        artwork: song.image?.[2]?.link
          ? [{ src: song.image[2].link, sizes: '500x500', type: 'image/jpeg' }]
          : [],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current?.play().catch(console.error);
        playbackDispatch({ type: 'SET_PLAYING', payload: true });
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current?.pause();
        playbackDispatch({ type: 'SET_PLAYING', payload: false });
      });

      navigator.mediaSession.setActionHandler('previoustrack', controls.handlePrevSong);
      navigator.mediaSession.setActionHandler('nexttrack', controls.handleNextSong);

      document.title = `${song.name} - SyncVibe`;
    },
    [controls]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUpdateTime.current > 1000) {
        timeDispatch({ type: 'UPDATE_TIME', payload: audio.currentTime });
        lastUpdateTime.current = now;
      }
    };

    const handleLoadedMetadata = () => {
      timeDispatch({ type: 'SET_DURATION', payload: audio.duration });
      audio.volume = playbackState.volume;
    };

    const handleEnded = () => {
      controls.handleNextSong();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [controls, playbackState.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (
      !audio ||
      !playbackState.currentSong ||
      playbackState.currentSong?.id === prevSongRef.current?.id
    )
      return;

    const loadAndPlaySong = async () => {
      try {
        audio.src = getAudioUrl(playbackState.currentSong);
        await audio.load();

        updateMediaSession(playbackState.currentSong);
        prevSongRef.current = playbackState.currentSong;

        if (!playbackState.isLoading) {
          await audio.play();
          playbackDispatch({ type: 'SET_PLAYING', payload: true });
          // Add to history when song starts playing (handles both manual and autoplay)
          addToHistory(playbackState.currentSong, 0, 'autoplay');
        }

        preloadNextTrack();
      } catch (err) {
        console.error('Playback error:', err);
        playbackDispatch({ type: 'SET_PLAYING', payload: false });
      }
    };

    loadAndPlaySong();
  }, [
    playbackState.currentSong,
    playbackState.isLoading,
    getAudioUrl,
    updateMediaSession,
    preloadNextTrack,
  ]);

  const getPlaylists = useCallback(async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/playlist/get`, {
        withCredentials: true,
      });
      if (data?.data) {
        playlistDispatch({ type: 'SET_USER_PLAYLIST', payload: data.data });
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    }
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    getPlaylists();
  }, [user, loading]);

  const playlistValue = useMemo(
    () => ({
      ...playlistState,
      getPlaylists,
      setPlaylist: (playlist) => playlistDispatch({ type: 'SET_PLAYLIST', payload: playlist }),
      setUserPlaylist: (playlist) =>
        playlistDispatch({ type: 'SET_USER_PLAYLIST', payload: playlist }),
    }),
    [playlistState]
  );

  return (
    <PlayerControlsContext.Provider value={controls}>
      <PlayerStateContext.Provider value={playbackValue}>
        <PlayerTimeContext.Provider value={timeValue}>
          <PlaylistContext.Provider value={playlistValue}>
            <SleepTimerContext.Provider value={sleepTimerValue}>
              {children}
              <audio ref={audioRef} preload='auto' />
              <audio ref={nextAudioRef} preload='auto' style={{ display: 'none' }} />
            </SleepTimerContext.Provider>
          </PlaylistContext.Provider>
        </PlayerTimeContext.Provider>
      </PlayerStateContext.Provider>
    </PlayerControlsContext.Provider>
  );
}
