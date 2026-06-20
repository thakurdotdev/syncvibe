import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createJSONStorage, persist } from 'zustand/middleware';

export type RepeatMode = 'off' | 'all' | 'one';

export let onReorderPlaylist: ((newOrder: Song[]) => void) | null = null;
export const setOnReorderPlaylist = (cb: (newOrder: Song[]) => void) => {
  onReorderPlaylist = cb;
};


interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
  playlist: Song[];
  originalPlaylist: Song[];
  userPlaylist: any[];
  shuffleMode: boolean;
  repeatMode: RepeatMode;
  autoFetchRecommendations: boolean;
}

interface PlayerActions {
  playSong: (song: Song) => void;
  stopSong: () => void;
  handlePlayPause: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setCurrentSong: (song: Song | null) => void;

  handleNextSong: (isAutoPlay?: boolean) => void;
  handlePrevSong: () => void;

  setPlaylist: (playlist: Song[]) => void;
  addToQueue: (songs: Song | Song[]) => void;
  removeFromQueue: (songId: string) => void;
  removeFromQueueBelow: (songId: string) => void;
  clearQueue: () => void;
  replaceQueue: (songs: Song[], keepCurrentSong?: boolean) => void;
  reorderPlaylist: (newOrder: Song[]) => void;

  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setAutoFetchRecommendations: (value: boolean) => void;

  setUserPlaylist: (playlists: any[]) => void;
}

export type PlayerStore = PlayerState & PlayerActions;

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      isLoading: false,
      playlist: [],
      originalPlaylist: [],
      userPlaylist: [],
      shuffleMode: false,
      repeatMode: 'off' as RepeatMode,
      autoFetchRecommendations: true,

      playSong: (song: Song) => {
        if (!song?.id) return;
        const secureAudio = ensureHttpsForSongUrls(song);
        const { playlist } = get();
        const isInQueue = playlist.some((item) => item.id === song.id);

        set({
          currentSong: secureAudio,
          isLoading: true,
          ...(isInQueue ? {} : { playlist: [secureAudio], originalPlaylist: [secureAudio] }),
        });
      },

      stopSong: () => {
        set({
          currentSong: null,
          isPlaying: false,
          isLoading: false,
        });
      },

      handlePlayPause: () => {
        const { isPlaying } = get();
        set({ isPlaying: !isPlaying });
      },

      setPlaying: (isPlaying: boolean) => set({ isPlaying }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setCurrentSong: (song: Song | null) => set({ currentSong: song }),

      handleNextSong: (isAutoPlay = false) => {
        const { currentSong, playlist, repeatMode } = get();
        if (!currentSong || !playlist.length) return;

        if (isAutoPlay && repeatMode === 'one') {
          return;
        }

        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        if (currentIndex === -1) {
          if (playlist.length > 0) {
            get().playSong(playlist[0]);
          }
          return;
        }

        const isLastSong = currentIndex === playlist.length - 1;
        if (isLastSong && repeatMode === 'off' && isAutoPlay) {
          set({ isPlaying: false });
          return;
        }

        const nextIndex = (currentIndex + 1) % playlist.length;
        get().playSong(playlist[nextIndex]);
      },

      handlePrevSong: () => {
        const { currentSong, playlist } = get();
        if (!playlist.length || !currentSong) return;

        const currentIndex = playlist.findIndex((song) => song.id === currentSong.id);
        if (currentIndex === -1) return;

        if (currentIndex > 0) {
          get().playSong(playlist[currentIndex - 1]);
        } else {
          get().playSong(playlist[0]);
        }
      },

      setPlaylist: (songs: Song[]) => {
        const secureSongs = songs.map(ensureHttpsForSongUrls);
        set({
          playlist: secureSongs,
          originalPlaylist: secureSongs,
          autoFetchRecommendations: true,
        });
      },

      addToQueue: (songs: Song | Song[]) => {
        const { playlist, originalPlaylist } = get();
        const newSongs = Array.isArray(songs) ? songs : [songs];
        const existingIds = new Set(playlist.map((s) => s.id));
        const uniqueNewSongs = newSongs
          .filter((song) => !existingIds.has(song.id))
          .map(ensureHttpsForSongUrls);

        if (uniqueNewSongs.length > 0) {
          set({
            playlist: [...playlist, ...uniqueNewSongs],
            originalPlaylist: [...originalPlaylist, ...uniqueNewSongs],
          });
        }
      },

      removeFromQueue: (songId: string) => {
        const { playlist, originalPlaylist, currentSong } = get();
        if (currentSong?.id === songId) return;

        set({
          playlist: playlist.filter((s) => s.id !== songId),
          originalPlaylist: originalPlaylist.filter((s) => s.id !== songId),
        });
      },

      removeFromQueueBelow: (songId: string) => {
        const { playlist, originalPlaylist } = get();
        const index = playlist.findIndex((s) => s.id === songId);
        if (index === -1) return;
        const newPlaylist = playlist.slice(0, index + 1);
        set({
          playlist: newPlaylist,
          originalPlaylist: newPlaylist.filter((s) => originalPlaylist.some((o) => o.id === s.id)),
        });
      },

      clearQueue: () => {
        const { currentSong } = get();
        if (currentSong) {
          set({
            playlist: [currentSong],
            originalPlaylist: [currentSong],
            autoFetchRecommendations: false,
          });
        } else {
          set({
            playlist: [],
            originalPlaylist: [],
            autoFetchRecommendations: false,
          });
        }
      },

      replaceQueue: (songs: Song[], keepCurrentSong = false) => {
        const { currentSong } = get();
        const secureSongs = songs.map(ensureHttpsForSongUrls);

        if (keepCurrentSong && currentSong) {
          const filtered = secureSongs.filter((s) => s.id !== currentSong.id);
          const newQueue = [currentSong, ...filtered];
          set({
            playlist: newQueue,
            originalPlaylist: newQueue,
            autoFetchRecommendations: false,
          });
        } else {
          set({
            playlist: secureSongs,
            originalPlaylist: secureSongs,
            autoFetchRecommendations: false,
          });
        }
      },

      reorderPlaylist: (newOrder: Song[]) => {
        set({ playlist: newOrder });
        if (onReorderPlaylist) {
          onReorderPlaylist(newOrder);
        }
      },

      toggleShuffle: () => {
        const { shuffleMode, playlist, originalPlaylist, currentSong } = get();

        if (!shuffleMode) {
          const currentIndex = playlist.findIndex((s) => s.id === currentSong?.id);
          const songsToShuffle = playlist.filter((_, i) => i !== currentIndex);

          for (let i = songsToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [songsToShuffle[i], songsToShuffle[j]] = [songsToShuffle[j], songsToShuffle[i]];
          }

          const shuffled =
            currentIndex !== -1
              ? [playlist[currentIndex], ...songsToShuffle]
              : songsToShuffle;

          set({ shuffleMode: true, playlist: shuffled });
        } else {
          set({ shuffleMode: false, playlist: [...originalPlaylist] });
        }
      },

      toggleRepeat: () => {
        const { repeatMode } = get();
        const modes: RepeatMode[] = ['off', 'all', 'one'];
        const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
        set({ repeatMode: modes[nextIndex] });
      },

      setAutoFetchRecommendations: (value: boolean) => {
        set({ autoFetchRecommendations: value });
      },

      setUserPlaylist: (playlists: any[]) => set({ userPlaylist: playlists }),
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentSong: state.currentSong,
        playlist: state.playlist,
        originalPlaylist: state.originalPlaylist,
        shuffleMode: state.shuffleMode,
        repeatMode: state.repeatMode,
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

export const useCurrentSong = () => usePlayerStore((s) => s.currentSong);
export const useIsPlaying = () => usePlayerStore((s) => s.isPlaying);
export const useIsLoading = () => usePlayerStore((s) => s.isLoading);
export const usePlaylist = () => usePlayerStore((s) => s.playlist);
export const useShuffleMode = () =>
  usePlayerStore(useShallow((s) => ({ shuffleMode: s.shuffleMode, toggleShuffle: s.toggleShuffle })));
export const useRepeatMode = () =>
  usePlayerStore(useShallow((s) => ({ repeatMode: s.repeatMode, toggleRepeat: s.toggleRepeat })));

export const usePlayerControls = () =>
  usePlayerStore(useShallow((s) => ({
    playSong: s.playSong,
    stopSong: s.stopSong,
    handlePlayPause: s.handlePlayPause,
    handleNextSong: s.handleNextSong,
    handlePrevSong: s.handlePrevSong,
    addToQueue: s.addToQueue,
    addToPlaylist: s.setPlaylist,
    removeFromQueue: s.removeFromQueue,
    removeFromQueueBelow: s.removeFromQueueBelow,
    clearQueue: s.clearQueue,
    replaceQueue: s.replaceQueue,
    reorderPlaylist: s.reorderPlaylist,
    toggleShuffle: s.toggleShuffle,
    toggleRepeat: s.toggleRepeat,
  })));

export const usePlaybackState = () =>
  usePlayerStore(useShallow((s) => ({
    currentSong: s.currentSong,
    isPlaying: s.isPlaying,
    isLoading: s.isLoading,
  })));

export const usePlaylistState = () =>
  usePlayerStore(useShallow((s) => ({
    playlist: s.playlist,
    userPlaylist: s.userPlaylist,
    setPlaylist: s.setPlaylist,
    setUserPlaylist: s.setUserPlaylist,
  })));

