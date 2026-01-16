import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { ensureHttpsForDownloadUrls, addToHistory } from '@/Pages/Music/Common';
import axios from 'axios';

/* singletons */
let audioElement = null;
let nextAudioElement = null;
let progressAutoSaveInterval = null;
let lifecycleBound = false;

const getAudioUrl = (song) =>
  song?.download_url?.[4]?.link || song?.download_url?.[3]?.link || '';

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      isLoading: false,
      volume: 1,

      currentTime: 0,
      duration: 0,

      savedTime: 0,
      _hasRestoredTime: false,

      playlist: [],
      userPlaylist: [],

      sleepTimer: {
        timeRemaining: 0,
        songsRemaining: 0,
        isActive: false,
      },

      setAudioRefs: (audio, nextAudio) => {
        audioElement = audio;
        nextAudioElement = nextAudio;
      },

      bindLifecycle: () => {
        if (lifecycleBound) return;
        lifecycleBound = true;

        const persistNow = () => {
          try {
            get().saveProgress();
          } catch {}
        };

        window.addEventListener('pagehide', persistNow);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') persistNow();
        });
      },

      updateTime: (currentTime) => set({ currentTime }),

      saveProgress: () => {
        const { currentTime } = get();
        set({ savedTime: Math.floor(currentTime) });
      },

      startAutoSave: () => {
        if (progressAutoSaveInterval) return;
        progressAutoSaveInterval = setInterval(() => {
          const { currentTime } = get();
          set({ savedTime: Math.floor(currentTime) });
        }, 20000);
      },

      stopAutoSave: () => {
        if (progressAutoSaveInterval) {
          clearInterval(progressAutoSaveInterval);
          progressAutoSaveInterval = null;
        }
      },

      playSong: (song) => {
        if (!song?.id) return;
        const { saveProgress, playlist } = get();
        saveProgress();
        set({ isLoading: true, _hasRestoredTime: false });

        const secureSong = ensureHttpsForDownloadUrls(song);
        const exists = playlist.some((s) => s.id === song.id);
        if (!exists) set({ playlist: [secureSong] });

        set({ currentSong: secureSong, isLoading: false });
      },

      stopSong: () => {
        const { stopAutoSave, saveProgress } = get();
        saveProgress();
        stopAutoSave();

        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement.src = '';
        }

        set({
          currentSong: null,
          isPlaying: false,
          currentTime: 0,
          savedTime: 0,
        });

        document.title = 'SyncVibe';
      },

      handlePlayPause: () => {
        const { isPlaying, saveProgress, startAutoSave, stopAutoSave } = get();
        if (!audioElement) return;

        if (isPlaying) {
          audioElement.pause();
          saveProgress();
          stopAutoSave();
        } else {
          audioElement.play().catch(console.error);
          startAutoSave();
        }

        set({ isPlaying: !isPlaying });
      },

      handleTimeSeek: (time) => {
        if (audioElement) {
          audioElement.currentTime = time;
          set({ currentTime: time });
        }
      },

      setDuration: (duration) => set({ duration }),

      setPlaylist: (playlist) => set({ playlist }),

      addToQueue: (songs) => {
        const { playlist } = get();
        const arr = Array.isArray(songs) ? songs : [songs];
        const ids = new Set(playlist.map((s) => s.id));
        const unique = arr.filter((s) => !ids.has(s.id));
        if (unique.length) set({ playlist: [...playlist, ...unique] });
      },

      handleNextSong: () => {
        const { currentSong, playlist, playSong, saveProgress } = get();
        if (!currentSong || !playlist.length) return;
        saveProgress();
        const idx = playlist.findIndex((s) => s.id === currentSong.id);
        playSong(playlist[(idx + 1) % playlist.length]);
      },

      handlePrevSong: () => {
        const { currentSong, playlist, playSong, saveProgress } = get();
        if (!currentSong || !playlist.length) return;
        saveProgress();
        const idx = playlist.findIndex((s) => s.id === currentSong.id);
        playSong(playlist[(idx - 1 + playlist.length) % playlist.length]);
      },

      preloadNextTrack: () => {
        const { playlist, currentSong } = get();
        if (!nextAudioElement || !currentSong || !playlist.length) return;
        const idx = playlist.findIndex((s) => s.id === currentSong.id);
        const next = playlist[(idx + 1) % playlist.length];
        if (next) {
          nextAudioElement.src = getAudioUrl(next);
          nextAudioElement.load();
        }
      },

      updateMediaSession: (song) => {
        if (!('mediaSession' in navigator)) return;
        const { handleNextSong, handlePrevSong } = get();

        navigator.mediaSession.metadata = new MediaMetadata({
          title: song.name,
          artist: song?.artist_map?.artists?.slice(0, 3).map((a) => a.name).join(', '),
          album: song?.album,
          artwork: song.image?.[2]?.link
            ? [{ src: song.image[2].link, sizes: '500x500', type: 'image/jpeg' }]
            : [],
        });

        navigator.mediaSession.setActionHandler('play', () => audioElement?.play());
        navigator.mediaSession.setActionHandler('pause', () => audioElement?.pause());
        navigator.mediaSession.setActionHandler('nexttrack', handleNextSong);
        navigator.mediaSession.setActionHandler('previoustrack', handlePrevSong);

        document.title = `${song.name} - SyncVibe`;
      },

      loadAndPlayCurrentSong: async (prevSongId) => {
        const {
          currentSong,
          savedTime,
          _hasRestoredTime,
          updateMediaSession,
          preloadNextTrack,
          startAutoSave,
          bindLifecycle,
        } = get();

        if (!audioElement || !currentSong || currentSong.id === prevSongId) {
          return prevSongId;
        }

        try {
          audioElement.src = getAudioUrl(currentSong);
          await audioElement.load();

          if (!_hasRestoredTime && savedTime > 0) {
            audioElement.currentTime = savedTime;
            set({ currentTime: savedTime, _hasRestoredTime: true });
          }

          await audioElement.play();
          startAutoSave();
          bindLifecycle();

          set({ isPlaying: true });
          addToHistory(currentSong, audioElement.currentTime, 'autoplay');

          updateMediaSession(currentSong);
          preloadNextTrack();

          return currentSong.id;
        } catch (err) {
          console.error('Playback error:', err);
          set({ isPlaying: false });
          return prevSongId;
        }
      },

      setUserPlaylist: (userPlaylist) => set({ userPlaylist }),

      getPlaylists: async () => {
        try {
          const { data } = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/playlist/get`,
            { withCredentials: true }
          );
          if (data?.data) set({ userPlaylist: data.data });
        } catch (e) {
          console.error('Failed to fetch playlists', e);
        }
      },
    }),
    {
      name: 'player-storage',
      partialize: (state) => ({
        currentSong: state.currentSong,
        playlist: state.playlist,
        volume: state.volume,
        savedTime: state.savedTime,
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

export const useCurrentSong = () => usePlayerStore((s) => s.currentSong);
export const useIsPlaying = () => usePlayerStore((s) => s.isPlaying);
export const usePlaylist = () => usePlayerStore((s) => s.playlist);
export const useVolume = () => usePlayerStore((s) => s.volume);

export { getAudioUrl };
