import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { ensureHttpsForDownloadUrls, addToHistory } from '@/Pages/Music/Common';
import axios from 'axios';

let audioElement = null;
let nextAudioElement = null;

const getAudioUrl = (song) => {
  return song?.download_url?.[4]?.link || song?.download_url?.[3]?.link || '';
};

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
      userPlaylist: [],
      sleepTimer: {
        timeRemaining: 0,
        songsRemaining: 0,
        isActive: false,
      },
      sleepTimerInterval: null,
      _hasRestoredTime: false,

      setAudioRefs: (audio, nextAudio) => {
        audioElement = audio;
        nextAudioElement = nextAudio;
      },

      playSong: (song) => {
        if (!song?.id) return;
        set({ isLoading: true });
        const secureAudio = ensureHttpsForDownloadUrls(song);
        const { playlist } = get();
        const isInQueue = playlist.some((item) => item.id === song.id);
        if (!isInQueue) {
          set({ playlist: [secureAudio] });
        }
        set({ currentSong: secureAudio, isLoading: false });
      },

      stopSong: () => {
        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.src = '';
        }
        set({ currentSong: null, isPlaying: false, currentTime: 0 });
        document.title = 'SyncVibe';
      },

      handlePlayPause: () => {
        const { isPlaying } = get();
        if (!audioElement) return;
        if (isPlaying) {
          audioElement.pause();
        } else {
          audioElement.play().catch(console.error);
        }
        set({ isPlaying: !isPlaying });
      },

      setPlaying: (isPlaying) => set({ isPlaying }),
      setLoading: (isLoading) => set({ isLoading }),
      updateTime: (currentTime) => set({ currentTime }),
      setDuration: (duration) => set({ duration }),

      handleTimeSeek: (time) => {
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
      setPlaylist: (playlist) => set({ playlist }),

      addToQueue: (songs) => {
        const { playlist } = get();
        const newSongs = Array.isArray(songs) ? songs : [songs];
        const existingIds = new Set(playlist.map((song) => song.id));
        const uniqueNewSongs = newSongs.filter((song) => !existingIds.has(song.id));
        if (uniqueNewSongs.length > 0) {
          set({ playlist: [...playlist, ...uniqueNewSongs] });
        }
      },

      handleNextSong: () => {
        const { currentSong, playlist, playSong } = get();
        if (!currentSong) return;
        if (!playlist.length) {
          set({ playlist: [currentSong] });
          return;
        }
        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % playlist.length;
          playSong(playlist[nextIndex]);
        } else if (playlist.length > 0) {
          playSong(playlist[0]);
        }
      },

      handlePrevSong: () => {
        const { currentSong, playlist, playSong } = get();
        if (!playlist.length || !currentSong) return;
        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        if (currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
          playSong(playlist[prevIndex]);
        }
      },

      preloadNextTrack: () => {
        const { playlist, currentSong } = get();
        if (!playlist.length || !currentSong || !nextAudioElement) return;
        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
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

      loadAndPlayCurrentSong: async (prevSongId) => {
        const { currentSong, currentTime, updateMediaSession, preloadNextTrack, _hasRestoredTime } =
          get();
        if (!audioElement || !currentSong || currentSong.id === prevSongId) {
          return prevSongId;
        }
        try {
          audioElement.src = getAudioUrl(currentSong);
          await audioElement.load();

          if (!_hasRestoredTime && currentTime > 0) {
            audioElement.currentTime = currentTime;
            set({ _hasRestoredTime: true });
          } else {
            await audioElement.play();
            set({ isPlaying: true, _hasRestoredTime: true });
            addToHistory(currentSong, 0, 'autoplay');
          }

          updateMediaSession(currentSong);
          preloadNextTrack();
          return currentSong.id;
        } catch (err) {
          console.error('Playback error:', err);
          set({ isPlaying: false });
          return prevSongId;
        }
      },
    }),
    {
      name: 'player-storage',
      partialize: (state) => ({
        currentSong: state.currentSong,
        playlist: state.playlist,
        volume: state.volume,
        currentTime: state.currentTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isPlaying = false;
          state.isLoading = false;
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

export { getAudioUrl };
