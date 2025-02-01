import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import axios from "axios";

export const useAudioStore = create(
  subscribeWithSelector((set, get) => ({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playlist: [],
    userPlaylists: [],

    setCurrentSong: (song) => set({ currentSong: song }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setCurrentTime: (currentTime) => set({ currentTime }),
    setDuration: (duration) => set({ duration }),
    setVolume: (volume) => set({ volume: Math.min(Math.max(volume, 0), 1) }),

    playSong: (song) => {
      if (!song?.id) return;
      set({ currentSong: song, isPlaying: true });
    },

    stopSong: () => {
      set({ currentSong: null, isPlaying: false });
      document.title = "SyncVibe";
    },

    handlePlayPauseSong: () =>
      set((state) => ({ isPlaying: !state.isPlaying })),

    handleNextSong: () => {
      const { currentSong, playlist } = get();
      const currentIndex = playlist.findIndex(
        (song) => song.id === currentSong?.id,
      );
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % playlist.length;
        get().playSong(playlist[nextIndex]);
      }
    },

    handlePrevSong: () => {
      const { currentSong, playlist } = get();
      const currentIndex = playlist.findIndex(
        (song) => song.id === currentSong?.id,
      );
      if (currentIndex !== -1) {
        const prevIndex =
          (currentIndex - 1 + playlist.length) % playlist.length;
        get().playSong(playlist[prevIndex]);
      }
    },

    setPlaylist: (playlist) => set({ playlist }),
    addToPlaylist: (songs) =>
      set((state) => ({
        playlist: [
          ...state.playlist,
          ...(Array.isArray(songs) ? songs : [songs]),
        ],
      })),

    setUserPlaylists: (playlists) => set({ userPlaylists: playlists }),
    fetchUserPlaylists: async () => {
      try {
        const { data } = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/playlist/get`,
          { withCredentials: true },
        );
        if (data?.data) {
          set({ userPlaylists: data.data });
        }
      } catch (error) {
        console.error("Failed to fetch playlists:", error);
      }
    },
  })),
);

// Derived state
export const useProgress = () =>
  useAudioStore((state) => {
    if (state.duration === 0) return 0;
    return (state.currentTime / state.duration) * 100;
  });
