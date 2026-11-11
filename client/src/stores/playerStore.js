import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { ensureHttpsForDownloadUrls, addToHistory } from '@/Pages/Music/Common';
import axios from 'axios';
import { recordPlayEnd, recordPlayProgress, recordPlayStart, setPlayEndReason } from './playEvents';

let audioElement = null;
let nextAudioElement = null;
const TIME_STORAGE_KEY = 'player-time';

const getAudioUrl = (song) => {
  return song?.download_url?.[4]?.link || song?.download_url?.[3]?.link || '';
};

export const getAudioElement = () => audioElement;

/**
 * While your devices share one player (lib/player.js), it takes the actions below that change
 * what plays and sends them to the server instead. It returns true when it did; otherwise the
 * action runs here as it always has.
 */
let router = null;
export const setPlayerRouter = (next) => {
  router = next;
};
const routed = (action, ...args) => Boolean(router?.(action, ...args));

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      isLoading: false,
      volume: 1,
      currentTime: 0,
      duration: 0,
      playlist: [],
      originalPlaylist: [],
      userPlaylist: [],
      shuffleMode: false,
      repeatMode: 'off',
      autoFetchRecommendations: true,
      sleepTimer: {
        timeRemaining: 0,
        songsRemaining: 0,
        isActive: false,
      },
      sleepTimerInterval: null,
      _hasRestoredTime: false,
      isMinimized: (() => {
        try {
          const saved = localStorage.getItem('bottom-player-minimized');
          return saved ? JSON.parse(saved) : false;
        } catch {
          return false;
        }
      })(),

      setIsMinimized: (isMinimized) => {
        localStorage.setItem('bottom-player-minimized', JSON.stringify(isMinimized));
        set({ isMinimized });
      },

      isClosed: false,

      closePlayer: () => {
        if (routed('stop')) {
          set({ isClosed: true });
          return;
        }
        if (audioElement) {
          audioElement.pause();
        }
        set({ isPlaying: false, isClosed: true });
        recordPlayEnd('closed');
      },

      setAudioRefs: (audio, nextAudio) => {
        audioElement = audio;
        nextAudioElement = nextAudio;
      },

      playSong: (song) => {
        if (!song?.id) return;
        if (routed('playSong', ensureHttpsForDownloadUrls(song))) return;
        set({ isLoading: true, isClosed: false });
        const secureAudio = ensureHttpsForDownloadUrls(song);
        const { playlist, currentSong } = get();
        if (currentSong?.id !== song.id) setPlayEndReason('selected', true);
        const isInQueue = playlist.some((item) => item.id === song.id);
        if (!isInQueue) {
          set({ playlist: [secureAudio] });
        }
        set({ currentSong: secureAudio, isLoading: false, currentTime: 0, duration: 0 });
      },

      stopSong: () => {
        if (routed('stop')) return;
        recordPlayEnd('closed');
        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.src = '';
        }
        set({ currentSong: null, isPlaying: false, currentTime: 0 });
        document.title = 'SyncVibe';
      },

      handlePlayPause: () => {
        const { isPlaying, isClosed } = get();
        if (!audioElement) return;
        if (isClosed) {
          set({ isClosed: false });
        }
        if (routed('playPause')) return;
        if (isPlaying) {
          audioElement.pause();
          set({ isPlaying: false });
        } else {
          audioElement
            .play()
            .then(() => set({ isPlaying: true }))
            .catch((err) => {
              console.error('Play failed:', err);
              set({ isPlaying: false });
            });
        }
      },

      setPlaying: (isPlaying) => set({ isPlaying }),
      setLoading: (isLoading) => set({ isLoading }),
      updateTime: (currentTime) => {
        const { currentSong, isPlaying } = get();
        if (isPlaying) recordPlayProgress(currentSong, currentTime);
        set({ currentTime });
      },
      setDuration: (duration) => set({ duration }),

      handleTimeSeek: (time) => {
        if (routed('seek', time)) return;
        if (audioElement) {
          audioElement.currentTime = time;
          set({ currentTime: time });
        }
      },

      handleVolumeChange: (value) => {
        const newVolume = Math.min(Math.max(value, 0), 1);
        if (audioElement) {
          audioElement.volume = newVolume;
        }
        set({ volume: newVolume });
      },

      setVolume: (volume) => set({ volume: Math.min(Math.max(volume, 0), 1) }),
      setPlaylist: (playlist) => {
        if (routed('setPlaylist', playlist.map(ensureHttpsForDownloadUrls))) return;
        set({ playlist, originalPlaylist: playlist, autoFetchRecommendations: true });
      },

      addToQueue: (songs) => {
        if (routed('addToQueue', songs)) return;
        const { playlist, originalPlaylist } = get();
        const newSongs = Array.isArray(songs) ? songs : [songs];
        const existingIds = new Set(playlist.map((song) => song.id));
        const uniqueNewSongs = newSongs.filter((song) => !existingIds.has(song.id));
        if (uniqueNewSongs.length > 0) {
          const newPlaylist = [...playlist, ...uniqueNewSongs];
          const newOriginal = [...originalPlaylist, ...uniqueNewSongs];
          set({ playlist: newPlaylist, originalPlaylist: newOriginal });
        }
      },

      /** Keeps the queue up to and including this song. */
      removeFromQueueBelow: (songId) => {
        if (routed('removeFromQueueBelow', songId)) return;
        const { playlist, originalPlaylist } = get();
        const index = playlist.findIndex((song) => song.id === songId);
        if (index === -1) return;
        const kept = playlist.slice(0, index + 1);
        const keptIds = new Set(kept.map((song) => song.id));
        set({
          playlist: kept,
          originalPlaylist: originalPlaylist.filter((s) => keptIds.has(s.id)),
        });
      },

      /** Autoplay's picks for a song. Shared, only the device playing adds them. */
      addRecommendations: (songs, forSongId) => {
        if (routed('addRecommendations', songs, forSongId)) return;
        get().addToQueue(songs);
      },

      clearQueue: () => {
        if (routed('clearQueue')) return;
        const { currentSong } = get();
        if (currentSong) {
          set({
            playlist: [currentSong],
            originalPlaylist: [currentSong],
            autoFetchRecommendations: false,
          });
        } else {
          set({ playlist: [], originalPlaylist: [], autoFetchRecommendations: false });
        }
      },

      replaceQueue: (songs, keepCurrentSong = false) => {
        const { currentSong } = get();
        const newSongs = Array.isArray(songs) ? songs : [songs];
        const secureSongs = newSongs.map(ensureHttpsForDownloadUrls);
        if (routed('replaceQueue', secureSongs, keepCurrentSong)) return;
        if (keepCurrentSong && currentSong) {
          const filtered = secureSongs.filter((s) => s.id !== currentSong.id);
          const newQueue = [currentSong, ...filtered];
          set({ playlist: newQueue, originalPlaylist: newQueue, autoFetchRecommendations: false });
        } else {
          set({
            playlist: secureSongs,
            originalPlaylist: secureSongs,
            autoFetchRecommendations: false,
          });
        }
      },

      setAutoFetchRecommendations: (value) => {
        if (routed('setAutoplay', value)) return;
        set({ autoFetchRecommendations: value });
      },

      toggleShuffle: () => {
        if (routed('toggleShuffle')) return;
        const { shuffleMode, playlist, originalPlaylist, currentSong } = get();
        if (!shuffleMode) {
          const currentIndex = playlist.findIndex((s) => s.id === currentSong?.id);
          const songsToShuffle = playlist.filter((_, i) => i !== currentIndex);
          for (let i = songsToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [songsToShuffle[i], songsToShuffle[j]] = [songsToShuffle[j], songsToShuffle[i]];
          }
          const shuffled =
            currentIndex !== -1 ? [playlist[currentIndex], ...songsToShuffle] : songsToShuffle;
          set({ shuffleMode: true, playlist: shuffled });
        } else {
          set({ shuffleMode: false, playlist: [...originalPlaylist] });
        }
      },

      toggleRepeat: () => {
        if (routed('toggleRepeat')) return;
        const { repeatMode } = get();
        const modes = ['off', 'all', 'one'];
        const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
        set({ repeatMode: modes[nextIndex] });
      },

      handleNextSong: (isAutoPlay = false) => {
        const { currentSong, playlist, playSong, repeatMode } = get();
        if (!currentSong) return;
        if (routed('next', isAutoPlay)) return;
        if (!playlist.length) {
          set({ playlist: [currentSong] });
          return;
        }
        if (isAutoPlay && repeatMode === 'one') {
          if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.play().catch(console.error);
          }
          return;
        }
        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        if (currentIndex !== -1) {
          const isLastSong = currentIndex === playlist.length - 1;
          if (isLastSong && repeatMode === 'off' && isAutoPlay) {
            if (audioElement) {
              audioElement.pause();
            }
            set({ isPlaying: false });
            recordPlayEnd('completed');
            return;
          }
          const nextIndex = (currentIndex + 1) % playlist.length;
          // Strict check: the media keys call this with an event object.
          setPlayEndReason(isAutoPlay === true ? 'completed' : 'next');
          playSong(playlist[nextIndex]);
        } else if (playlist.length > 0) {
          playSong(playlist[0]);
        }
      },

      handlePrevSong: () => {
        const { currentSong, playlist, playSong, currentTime } = get();
        if (!playlist.length || !currentSong) return;
        if (routed('previous')) return;
        if (currentTime > 3 && audioElement) {
          audioElement.currentTime = 0;
          set({ currentTime: 0 });
          return;
        }
        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        if (currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
          setPlayEndReason('previous');
          playSong(playlist[prevIndex]);
        }
      },

      preloadNextTrack: () => {
        const { playlist, currentSong, repeatMode } = get();
        if (!playlist.length || !currentSong || !nextAudioElement) return;
        if (repeatMode === 'one') return;
        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        const isLastSong = currentIndex === playlist.length - 1;
        if (isLastSong && repeatMode === 'off') return;
        const nextIndex = (currentIndex + 1) % playlist.length;
        const nextSong = playlist[nextIndex];
        if (nextSong) {
          nextAudioElement.src = getAudioUrl(nextSong);
          nextAudioElement.load();
        }
      },

      setUserPlaylist: (userPlaylist) => set({ userPlaylist }),

      getPlaylists: async () => {
        try {
          const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/api/playlist/get`, {
            withCredentials: true,
          });
          if (data?.data) {
            set({ userPlaylist: data.data });
          }
        } catch (error) {
          console.error('Failed to fetch playlists:', error);
        }
      },

      setSleepTimer: (minutes = 0, songs = 0) => {
        const { sleepTimerInterval } = get();
        if (sleepTimerInterval) {
          clearInterval(sleepTimerInterval);
        }
        if (minutes > 0) {
          const interval = setInterval(() => {
            const { sleepTimer, stopSong } = get();
            const newTimeRemaining = sleepTimer.timeRemaining - 1;
            if (newTimeRemaining <= 0) {
              clearInterval(interval);
              stopSong();
              set({
                sleepTimer: { timeRemaining: 0, songsRemaining: 0, isActive: false },
                sleepTimerInterval: null,
              });
            } else {
              set({ sleepTimer: { ...sleepTimer, timeRemaining: newTimeRemaining } });
            }
          }, 1000);
          set({
            sleepTimer: { timeRemaining: minutes * 60, songsRemaining: 0, isActive: true },
            sleepTimerInterval: interval,
          });
        } else if (songs > 0) {
          set({
            sleepTimer: { timeRemaining: 0, songsRemaining: songs, isActive: true },
            sleepTimerInterval: null,
          });
        }
      },

      clearSleepTimer: () => {
        const { sleepTimerInterval } = get();
        if (sleepTimerInterval) {
          clearInterval(sleepTimerInterval);
        }
        set({
          sleepTimer: { timeRemaining: 0, songsRemaining: 0, isActive: false },
          sleepTimerInterval: null,
        });
      },

      decrementSongsRemaining: () => {
        const { sleepTimer, stopSong } = get();
        if (sleepTimer.isActive && sleepTimer.songsRemaining > 0) {
          const newSongsRemaining = sleepTimer.songsRemaining - 1;
          if (newSongsRemaining <= 0) {
            stopSong();
            set({ sleepTimer: { timeRemaining: 0, songsRemaining: 0, isActive: false } });
          } else {
            set({ sleepTimer: { ...sleepTimer, songsRemaining: newSongsRemaining } });
          }
        }
      },

      updateMediaSession: (song) => {
        if (!('mediaSession' in navigator)) return;
        const { handlePrevSong, handleNextSong } = get();

        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.name,
          artist: song?.artist_map?.artists
            ?.slice(0, 3)
            ?.map((a) => a.name)
            .join(', '),
          album: song?.album,
          artwork: song.image?.[2]?.link
            ? [{ src: song.image[2].link, sizes: '500x500', type: 'image/jpeg' }]
            : [],
        });

        navigator.mediaSession.setActionHandler('play', () => {
          audioElement?.play().catch(console.error);
          set({ isPlaying: true });
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioElement?.pause();
          set({ isPlaying: false });
        });
        navigator.mediaSession.setActionHandler('previoustrack', handlePrevSong);
        navigator.mediaSession.setActionHandler('nexttrack', handleNextSong);
        document.title = `${song.name} - SyncVibe`;
      },

      /**
       * Loads a song into the audio element and, unless told not to, plays it from a position.
       * `newPlay` counts it in history; a song picked up partway (moved from another device)
       * isn't a new listen. Rejects with the browser's error if it won't play.
       */
      startAudio: async (song, { positionSec = 0, play = true, newPlay = true } = {}) => {
        if (!audioElement || !song) return;
        const { updateMediaSession, preloadNextTrack } = get();
        set({ isLoading: true });
        const url = getAudioUrl(song);
        // Already loaded (preloaded while nobody played): keep it, so starting is instant.
        if (audioElement.src !== url) audioElement.src = url;
        if (Math.abs(audioElement.currentTime - positionSec) > 1) {
          audioElement.currentTime = positionSec;
        }
        set({ currentTime: positionSec });
        updateMediaSession(song);
        preloadNextTrack();
        if (!play) {
          if (!audioElement.paused) audioElement.pause();
          set({ isLoading: false, isPlaying: false });
          return;
        }
        try {
          await audioElement.play();
          set({ isPlaying: true, isLoading: false });
          recordPlayStart(song);
          if (newPlay) addToHistory(song, 0, 'autoplay');
        } catch (err) {
          if (err.name === 'AbortError') return;
          set({ isPlaying: false, isLoading: false });
          throw err;
        }
      },

      loadAndPlayCurrentSong: async (prevSongId) => {
        const { currentSong, currentTime, startAudio, _hasRestoredTime, isClosed } = get();
        if (!audioElement || !currentSong || currentSong.id === prevSongId || isClosed) {
          return prevSongId;
        }
        // Shared between devices: the audio follows the server instead.
        if (routed('loadCurrent')) return currentSong.id;
        try {
          if (!_hasRestoredTime && currentTime > 0) {
            await startAudio(currentSong, { positionSec: currentTime, play: false });
            set({ _hasRestoredTime: true });
          } else {
            set({ _hasRestoredTime: true });
            await startAudio(currentSong);
          }
          return currentSong.id;
        } catch (err) {
          console.error('Playback error:', err);
          return prevSongId;
        }
      },
    }),
    {
      name: 'player-storage',
      partialize: (state) => ({
        currentSong: state.currentSong,
        playlist: state.playlist,
        originalPlaylist: state.originalPlaylist,
        volume: state.volume,
        shuffleMode: state.shuffleMode,
        repeatMode: state.repeatMode,
        isMinimized: state.isMinimized,
        isClosed: state.isClosed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isPlaying = false;
          state.isLoading = false;
          try {
            const savedTime = parseFloat(localStorage.getItem(TIME_STORAGE_KEY));
            if (savedTime > 0) {
              state.currentTime = savedTime;
            }
          } catch {}
        }
      },
    }
  )
);

export const usePlayerControls = () =>
  usePlayerStore(
    useShallow((s) => ({
      playSong: s.playSong,
      stopSong: s.stopSong,
      handlePlayPause: s.handlePlayPause,
      handleNextSong: s.handleNextSong,
      handlePrevSong: s.handlePrevSong,
      handleTimeSeek: s.handleTimeSeek,
      handleVolumeChange: s.handleVolumeChange,
      addToQueue: s.addToQueue,
      addToPlaylist: s.setPlaylist,
    }))
  );

export const usePlaybackState = () =>
  usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      volume: s.volume,
    }))
  );

export const useTimeState = () =>
  usePlayerStore(
    useShallow((s) => ({
      currentTime: s.currentTime,
      duration: s.duration,
      updateTime: s.updateTime,
      setDuration: s.setDuration,
    }))
  );

export const usePlaylistState = () =>
  usePlayerStore(
    useShallow((s) => ({
      playlist: s.playlist,
      userPlaylist: s.userPlaylist,
      setPlaylist: s.setPlaylist,
      setUserPlaylist: s.setUserPlaylist,
      getPlaylists: s.getPlaylists,
    }))
  );

export const useSleepTimerState = () =>
  usePlayerStore(
    useShallow((s) => ({
      ...s.sleepTimer,
      setSleepTimer: s.setSleepTimer,
      clearSleepTimer: s.clearSleepTimer,
    }))
  );

export const useCurrentSong = () => usePlayerStore((s) => s.currentSong);
export const useIsPlaying = () => usePlayerStore((s) => s.isPlaying);
export const usePlaylist = () => usePlayerStore((s) => s.playlist);
export const useVolume = () => usePlayerStore((s) => s.volume);
export const useShuffleMode = () =>
  usePlayerStore((s) => ({ shuffleMode: s.shuffleMode, toggleShuffle: s.toggleShuffle }));
export const useRepeatMode = () =>
  usePlayerStore((s) => ({ repeatMode: s.repeatMode, toggleRepeat: s.toggleRepeat }));

export { getAudioUrl };
