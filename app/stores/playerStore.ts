import { API_URL } from '@/constants';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { getAuthHeaders } from '@/lib/auth-client';
import { markRecommendations, recordPlayEnd } from '@/utils/playEvents';
import axios from 'axios';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { persist } from 'zustand/middleware';
import { createDeferredStorage } from '@/utils/deferredStorage';

export type RepeatMode = 'off' | 'all' | 'one';

let lastFetchedRecSongId: string | null = null;
let isRemote: (() => boolean) | null = null;
export const setIsRemote = (check: (() => boolean) | null) => {
  isRemote = check;
};
let isFetchingRecs = false;

export const checkAndFetchRecommendations = async (targetSong?: Song | null, force = false) => {
  const store = usePlayerStore.getState();
  if (!store.autoFetchRecommendations && !force) return;
  if (store.activePlayerMode === 'group') return;
  // Another of your devices is playing: it picks the next songs, not this one.
  if (isRemote?.()) return;

  const song = targetSong ?? store.currentSong;
  if (!song?.id) return;

  const { playlist } = store;
  const currentIndex = playlist.findIndex((s) => s.id === song.id);
  const remaining = currentIndex === -1 ? 0 : playlist.length - currentIndex - 1;

  if (!force && (remaining > 2 || lastFetchedRecSongId === song.id)) return;
  if (isFetchingRecs) return;

  try {
    isFetchingRecs = true;
    lastFetchedRecSongId = song.id;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(await getAuthHeaders()),
    };

    const response = await axios.get(`${API_URL}/api/play-next/${song.id}?limit=20`, {
      headers,
      timeout: 10000,
    });

    if (response.data?.data?.length) {
      const newRecommendations: Song[] = response.data.data.map(ensureHttpsForSongUrls);
      markRecommendations(song.id, newRecommendations);
      store.addRecommendations(newRecommendations, song.id);
    }
  } catch (err) {
    console.error('Auto recommendation fetch error:', err);
  } finally {
    isFetchingRecs = false;
  }
};

/**
 * While your devices share one player (lib/player.ts), it takes the actions below that change
 * what plays and sends them to the server instead. It returns true when it did; otherwise the
 * action runs here as it always has.
 */
type PlayerRouter = (action: string, ...args: any[]) => boolean;
let router: PlayerRouter | null = null;
export const setPlayerRouter = (next: PlayerRouter | null) => {
  router = next;
};
const routed = (action: string, ...args: any[]) => Boolean(router?.(action, ...args));

export let onPlaySong: ((song: Song) => void) | null = null;
export const setOnPlaySong = (cb: (song: Song) => void) => {
  onPlaySong = cb;
};

export let onStopSong: (() => void) | null = null;
export const setOnStopSong = (cb: () => void) => {
  onStopSong = cb;
};

export let onPlayPause: (() => void) | null = null;
export const setOnPlayPause = (cb: () => void) => {
  onPlayPause = cb;
};

export let onHandleNextSong: ((isAutoPlay?: boolean) => void) | null = null;
export const setOnHandleNextSong = (cb: (isAutoPlay?: boolean) => void) => {
  onHandleNextSong = cb;
};

export let onHandlePrevSong: ((force?: boolean) => void) | null = null;
export const setOnHandlePrevSong = (cb: (force?: boolean) => void) => {
  onHandlePrevSong = cb;
};

export let onRepeatModeChange: ((mode: RepeatMode) => void) | null = null;
export const setOnRepeatModeChange = (cb: (mode: RepeatMode) => void) => {
  onRepeatModeChange = cb;
};

export let onAfterSongTransition: ((song: Song) => void) | null = null;
export const setOnAfterSongTransition = (cb: ((song: Song) => void) | null) => {
  onAfterSongTransition = cb;
};

/** Whether the full player covers the app, so things hidden under it can stop animating. */
export const useFullPlayerOpen = create<{ open: boolean }>(() => ({ open: false }));
export const setFullPlayerOpen = (open: boolean) => useFullPlayerOpen.setState({ open });

export let onOpenFullPlayer: (() => void) | null = null;
export const setOnOpenFullPlayer = (cb: (() => void) | null) => {
  onOpenFullPlayer = cb;
};
/** Opens the full player. Where it grows from is set beforehand (lib/playerMorph). */
export const openFullPlayer = () => {
  onOpenFullPlayer?.();
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
  activePlayerMode: 'normal' | 'group';
}

interface PlayerActions {
  playSong: (song: Song) => void;
  stopSong: () => void;
  handlePlayPause: () => void;
  setPlaying: (isPlaying: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setCurrentSong: (song: Song | null) => void;

  handleNextSong: (isAutoPlay?: boolean) => void;
  /** Past 3s this restarts the song; `force` always goes to the previous one (swipes). */
  handlePrevSong: (force?: boolean) => void;

  setPlaylist: (playlist: Song[]) => void;
  addToQueue: (songs: Song | Song[]) => void;
  /** Autoplay's picks for a song. Shared, only the device playing adds them. */
  addRecommendations: (songs: Song[], forSongId: string) => void;
  /** Returns a function that undoes the removal, or nothing if no song was removed. */
  removeFromQueue: (songId: string) => (() => void) | undefined;
  removeFromQueueBelow: (songId: string) => void;
  clearQueue: () => void;
  replaceQueue: (songs: Song[], keepCurrentSong?: boolean) => void;
  reorderPlaylist: (newOrder: Song[]) => void;

  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setAutoFetchRecommendations: (value: boolean) => void;

  setUserPlaylist: (playlists: any[]) => void;
  setActivePlayerMode: (mode: 'normal' | 'group') => void;
}

export type PlayerStore = PlayerState & PlayerActions;

/**
 * Puts a song back after the one it used to follow. The queue may have changed since, so the old
 * index is only the fallback for when that song has gone too.
 */
const insertAfter = (list: Song[], song: Song, afterId: string | undefined, index: number) => {
  const anchor = afterId === undefined ? -1 : list.findIndex((s) => s.id === afterId);
  const at = afterId === undefined ? 0 : anchor === -1 ? Math.min(index, list.length) : anchor + 1;
  return [...list.slice(0, at), song, ...list.slice(at)];
};

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
      activePlayerMode: 'normal' as 'normal' | 'group',

      playSong: (song: Song) => {
        if (!song?.id) return;
        if (get().activePlayerMode === 'group') return;
        const secureAudio = ensureHttpsForSongUrls(song);
        if (routed('playSong', secureAudio)) return;
        const { playlist } = get();
        const isInQueue = playlist.some((item) => item.id === song.id);

        set({
          activePlayerMode: 'normal',
          currentSong: secureAudio,
          isPlaying: true,
          ...(isInQueue ? {} : { playlist: [secureAudio], originalPlaylist: [secureAudio] }),
        });

        onPlaySong?.(secureAudio);
        checkAndFetchRecommendations(secureAudio);
      },

      stopSong: () => {
        if (get().activePlayerMode === 'group') return;
        if (routed('stop')) return;

        // Let the native bridge capture the current position before the store
        // clears the song. The bridge callback reads the current song
        // synchronously before it awaits the storage write.
        onStopSong?.();
        set({
          currentSong: null,
          isPlaying: false,
          isLoading: false,
        });
      },

      handlePlayPause: () => {
        const { activePlayerMode } = get();
        if (activePlayerMode !== 'normal') return;
        if (routed('playPause')) return;
        onPlayPause?.();
      },

      setPlaying: (isPlaying: boolean) => set({ isPlaying }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setCurrentSong: (song: Song | null) => set({ currentSong: song }),

      handleNextSong: (isAutoPlay = false) => {
        const { activePlayerMode } = get();
        if (activePlayerMode !== 'normal') return;
        if (routed('next', isAutoPlay)) return;
        // The bridge works out the next song from the current one and sets it in this same
        // tick. Moving currentSong here first made it skip one song further.
        onHandleNextSong?.(isAutoPlay);
        checkAndFetchRecommendations();
      },

      handlePrevSong: (force?: boolean) => {
        const { activePlayerMode } = get();
        if (activePlayerMode !== 'normal') return;
        if (routed('previous')) return;
        // Strict check: this is also wired straight to onPress, which passes an event.
        onHandlePrevSong?.(force === true);
      },

      setPlaylist: (songs: Song[]) => {
        const secureSongs = songs.map(ensureHttpsForSongUrls);
        if (routed('setPlaylist', secureSongs)) return;
        set({
          playlist: secureSongs,
          originalPlaylist: secureSongs,
          autoFetchRecommendations: true,
        });
        checkAndFetchRecommendations();
      },

      addToQueue: (songs: Song | Song[]) => {
        if (
          routed(
            'addToQueue',
            Array.isArray(songs) ? songs.map(ensureHttpsForSongUrls) : ensureHttpsForSongUrls(songs)
          )
        )
          return;
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

      addRecommendations: (songs: Song[], forSongId: string) => {
        if (routed('addRecommendations', songs, forSongId)) return;
        get().addToQueue(songs);
      },

      removeFromQueue: (songId: string) => {
        const { playlist, originalPlaylist, currentSong } = get();
        if (currentSong?.id === songId) return;
        // Shared: no undo, since the queue may have changed on another device meanwhile.
        if (routed('removeFromQueue', songId)) return;
        const index = playlist.findIndex((s) => s.id === songId);
        if (index === -1) return;
        const song = playlist[index];
        const before = playlist[index - 1]?.id;
        const originalIndex = originalPlaylist.findIndex((s) => s.id === songId);
        const originalBefore = originalPlaylist[originalIndex - 1]?.id;

        set({
          playlist: playlist.filter((s) => s.id !== songId),
          originalPlaylist: originalPlaylist.filter((s) => s.id !== songId),
        });

        return () => {
          const state = get();
          if (state.playlist.some((s) => s.id === songId)) return;
          set({
            playlist: insertAfter(state.playlist, song, before, index),
            originalPlaylist:
              originalIndex === -1
                ? state.originalPlaylist
                : insertAfter(state.originalPlaylist, song, originalBefore, originalIndex),
          });
        };
      },

      removeFromQueueBelow: (songId: string) => {
        if (routed('removeFromQueueBelow', songId)) return;
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
        lastFetchedRecSongId = null;
        if (routed('clearQueue')) return;
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
        lastFetchedRecSongId = null;
        const { currentSong } = get();
        const secureSongs = songs.map(ensureHttpsForSongUrls);
        if (routed('replaceQueue', secureSongs, keepCurrentSong)) return;

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
        if (routed('reorder', newOrder)) return;
        set({ playlist: newOrder });
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
        const modes: RepeatMode[] = ['off', 'all', 'one'];
        const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length;
        const nextMode = modes[nextIndex];
        set({ repeatMode: nextMode });
        onRepeatModeChange?.(nextMode);
      },

      setAutoFetchRecommendations: (value: boolean) => {
        if (routed('setAutoplay', value)) return;
        set({ autoFetchRecommendations: value });
        if (value) {
          lastFetchedRecSongId = null;
          checkAndFetchRecommendations(null, true);
        }
      },

      setUserPlaylist: (playlists: any[]) => set({ userPlaylist: playlists }),

      setActivePlayerMode: (mode: 'normal' | 'group') => {
        // A room takes this phone's player: if it was playing your music, it stops being the one.
        if (mode === 'group' && get().activePlayerMode !== 'group') routed('stop');
        if (mode === 'group') recordPlayEnd('closed');
        set({ activePlayerMode: mode });
      },
    }),
    {
      name: 'player-storage',
      storage: createDeferredStorage(),
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
  usePlayerStore(
    useShallow((s) => ({ shuffleMode: s.shuffleMode, toggleShuffle: s.toggleShuffle }))
  );
export const useRepeatMode = () =>
  usePlayerStore(useShallow((s) => ({ repeatMode: s.repeatMode, toggleRepeat: s.toggleRepeat })));

export const usePlayerControls = () =>
  usePlayerStore(
    useShallow((s) => ({
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
    }))
  );

export const usePlaybackState = () => {
  return usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      activePlayerMode: s.activePlayerMode,
    }))
  );
};

/**
 * Playback state for a card. Non-active cards keep the same selector result
 * while another song starts or pauses, so large music lists stay still.
 */
export const useSongPlaybackState = (songId: string | undefined) =>
  usePlayerStore(
    useShallow((s) => ({
      isCurrentSong: !!songId && s.currentSong?.id === songId,
      isPlaying: !!songId && s.currentSong?.id === songId && s.isPlaying,
    }))
  );

export const usePlaylistState = () =>
  usePlayerStore(
    useShallow((s) => ({
      playlist: s.playlist,
      userPlaylist: s.userPlaylist,
      setPlaylist: s.setPlaylist,
      setUserPlaylist: s.setUserPlaylist,
    }))
  );

/** The current song's place in the queue, and the songs either side of it. */
export const useQueueNeighbors = () =>
  usePlayerStore(
    useShallow((s) => {
      const idx = s.currentSong ? s.playlist.findIndex((i) => i.id === s.currentSong?.id) : -1;
      return {
        index: Math.max(idx, 0),
        prev: idx > 0 ? s.playlist[idx - 1] : null,
        next: idx >= 0 && idx < s.playlist.length - 1 ? s.playlist[idx + 1] : null,
      };
    })
  );

export const useQueueCount = () =>
  usePlayerStore((s) => {
    if (!s.currentSong) return s.playlist.length;
    return s.playlist.filter((item) => item.id !== s.currentSong?.id).length;
  });

export const useNextSong = () =>
  usePlayerStore((s) => {
    if (!s.currentSong || !s.playlist.length) return null;
    const idx = s.playlist.findIndex((item) => item.id === s.currentSong?.id);
    return idx >= 0 && idx < s.playlist.length - 1 ? s.playlist[idx + 1] : null;
  });
