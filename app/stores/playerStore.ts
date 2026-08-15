import { API_URL } from "@/constants"
import { Song } from "@/types/song"
import { ensureHttpsForSongUrls } from "@/utils/getHttpsUrls"
import AsyncStorage from "@react-native-async-storage/async-storage"
import axios from "axios"
import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import { createJSONStorage, persist } from "zustand/middleware"

export type RepeatMode = "off" | "all" | "one"

let lastFetchedRecSongId: string | null = null
let isFetchingRecs = false

export const checkAndFetchRecommendations = async (targetSong?: Song | null, force = false) => {
  const store = usePlayerStore.getState()
  if (!store.autoFetchRecommendations && !force) return
  if (store.activePlayerMode === "group") return

  const song = targetSong ?? store.currentSong
  if (!song?.id) return

  const { playlist } = store
  const currentIndex = playlist.findIndex((s) => s.id === song.id)
  const remaining = currentIndex === -1 ? 0 : playlist.length - currentIndex - 1

  if (!force && (remaining > 2 || lastFetchedRecSongId === song.id)) return
  if (isFetchingRecs) return

  try {
    isFetchingRecs = true
    lastFetchedRecSongId = song.id

    const token = await AsyncStorage.getItem("token")
    const headers: Record<string, string> = { Accept: "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await axios.get(`${API_URL}/api/play-next/${song.id}?limit=20`, {
      headers,
      timeout: 10000,
    })

    if (response.data?.data?.length) {
      const newRecommendations: Song[] = response.data.data.map(ensureHttpsForSongUrls)
      store.addToQueue(newRecommendations)
    }
  } catch (err) {
    console.error("Auto recommendation fetch error:", err)
  } finally {
    isFetchingRecs = false
  }
}

export let onReorderPlaylist: ((newOrder: Song[]) => void) | null = null
export const setOnReorderPlaylist = (cb: (newOrder: Song[]) => void) => {
  onReorderPlaylist = cb
}

export let onPlaySong: ((song: Song) => void) | null = null
export const setOnPlaySong = (cb: (song: Song) => void) => {
  onPlaySong = cb
}

export let onStopSong: (() => void) | null = null
export const setOnStopSong = (cb: () => void) => {
  onStopSong = cb
}

export let onPlayPause: (() => void) | null = null
export const setOnPlayPause = (cb: () => void) => {
  onPlayPause = cb
}

export let onHandleNextSong: ((isAutoPlay?: boolean) => void) | null = null
export const setOnHandleNextSong = (cb: (isAutoPlay?: boolean) => void) => {
  onHandleNextSong = cb
}

export let onHandlePrevSong: (() => void) | null = null
export const setOnHandlePrevSong = (cb: () => void) => {
  onHandlePrevSong = cb
}

export let onRepeatModeChange: ((mode: RepeatMode) => void) | null = null
export const setOnRepeatModeChange = (cb: (mode: RepeatMode) => void) => {
  onRepeatModeChange = cb
}

export let onAddToQueue: ((songs: Song[]) => void) | null = null
export const setOnAddToQueue = (cb: (songs: Song[]) => void) => {
  onAddToQueue = cb
}

export let onRemoveFromQueue: ((songId: string) => void) | null = null
export const setOnRemoveFromQueue = (cb: (songId: string) => void) => {
  onRemoveFromQueue = cb
}

export let onAfterSongTransition: ((song: Song) => void) | null = null
export const setOnAfterSongTransition = (cb: ((song: Song) => void) | null) => {
  onAfterSongTransition = cb
}

export let onOpenFullPlayer: (() => void) | null = null
export const setOnOpenFullPlayer = (cb: (() => void) | null) => {
  onOpenFullPlayer = cb
}
export const openFullPlayer = () => {
  onOpenFullPlayer?.()
}

interface PlayerState {
  currentSong: Song | null
  isPlaying: boolean
  isLoading: boolean
  playlist: Song[]
  originalPlaylist: Song[]
  userPlaylist: any[]
  shuffleMode: boolean
  repeatMode: RepeatMode
  autoFetchRecommendations: boolean
  activePlayerMode: "normal" | "group"
}

interface PlayerActions {
  playSong: (song: Song) => void
  stopSong: () => void
  handlePlayPause: () => void
  setPlaying: (isPlaying: boolean) => void
  setLoading: (isLoading: boolean) => void
  setCurrentSong: (song: Song | null) => void

  handleNextSong: (isAutoPlay?: boolean) => void
  handlePrevSong: () => void

  setPlaylist: (playlist: Song[]) => void
  addToQueue: (songs: Song | Song[]) => void
  removeFromQueue: (songId: string) => void
  removeFromQueueBelow: (songId: string) => void
  clearQueue: () => void
  replaceQueue: (songs: Song[], keepCurrentSong?: boolean) => void
  reorderPlaylist: (newOrder: Song[]) => void

  toggleShuffle: () => void
  toggleRepeat: () => void
  setAutoFetchRecommendations: (value: boolean) => void

  setUserPlaylist: (playlists: any[]) => void
  setActivePlayerMode: (mode: "normal" | "group") => void
}

export type PlayerStore = PlayerState & PlayerActions

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
      repeatMode: "off" as RepeatMode,
      autoFetchRecommendations: true,
      activePlayerMode: "normal" as "normal" | "group",

      playSong: (song: Song) => {
        if (!song?.id) return
        if (get().activePlayerMode === "group") return
        const secureAudio = ensureHttpsForSongUrls(song)
        const { playlist } = get()
        const isInQueue = playlist.some((item) => item.id === song.id)

        set({
          activePlayerMode: "normal",
          currentSong: secureAudio,
          isPlaying: true,
          ...(isInQueue ? {} : { playlist: [secureAudio], originalPlaylist: [secureAudio] }),
        })

        onPlaySong?.(secureAudio)
        checkAndFetchRecommendations(secureAudio)
      },

      stopSong: () => {
        if (get().activePlayerMode === "group") return
        set({
          currentSong: null,
          isPlaying: false,
          isLoading: false,
        })
        onStopSong?.()
      },

      handlePlayPause: () => {
        const { activePlayerMode } = get()
        if (activePlayerMode !== "normal") return
        onPlayPause?.()
      },

      setPlaying: (isPlaying: boolean) => set({ isPlaying }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setCurrentSong: (song: Song | null) => set({ currentSong: song }),

      handleNextSong: (isAutoPlay = false) => {
        const { activePlayerMode } = get()
        if (activePlayerMode !== "normal") return
        if (!isAutoPlay) {
          const { currentSong, playlist } = get()
          if (currentSong && playlist.length) {
            const currentIndex = playlist.findIndex((s) => s.id === currentSong.id)
            if (currentIndex !== -1) {
              const nextSong = playlist[(currentIndex + 1) % playlist.length]
              set({ currentSong: nextSong, isPlaying: true })
            }
          }
        }
        onHandleNextSong?.(isAutoPlay)
        checkAndFetchRecommendations()
      },

      handlePrevSong: () => {
        const { activePlayerMode } = get()
        if (activePlayerMode !== "normal") return
        onHandlePrevSong?.()
      },

      setPlaylist: (songs: Song[]) => {
        const secureSongs = songs.map(ensureHttpsForSongUrls)
        set({
          playlist: secureSongs,
          originalPlaylist: secureSongs,
          autoFetchRecommendations: true,
        })
        checkAndFetchRecommendations()
      },

      addToQueue: (songs: Song | Song[]) => {
        const { playlist, originalPlaylist } = get()
        const newSongs = Array.isArray(songs) ? songs : [songs]
        const existingIds = new Set(playlist.map((s) => s.id))
        const uniqueNewSongs = newSongs
          .filter((song) => !existingIds.has(song.id))
          .map(ensureHttpsForSongUrls)

        if (uniqueNewSongs.length > 0) {
          set({
            playlist: [...playlist, ...uniqueNewSongs],
            originalPlaylist: [...originalPlaylist, ...uniqueNewSongs],
          })
          onAddToQueue?.(uniqueNewSongs)
        }
      },

      removeFromQueue: (songId: string) => {
        const { playlist, originalPlaylist, currentSong } = get()
        if (currentSong?.id === songId) return

        set({
          playlist: playlist.filter((s) => s.id !== songId),
          originalPlaylist: originalPlaylist.filter((s) => s.id !== songId),
        })
        onRemoveFromQueue?.(songId)
      },

      removeFromQueueBelow: (songId: string) => {
        const { playlist, originalPlaylist } = get()
        const index = playlist.findIndex((s) => s.id === songId)
        if (index === -1) return
        const newPlaylist = playlist.slice(0, index + 1)
        const removedSongs = playlist.slice(index + 1)
        set({
          playlist: newPlaylist,
          originalPlaylist: newPlaylist.filter((s) => originalPlaylist.some((o) => o.id === s.id)),
        })
        removedSongs.forEach((s) => onRemoveFromQueue?.(s.id))
      },

      clearQueue: () => {
        lastFetchedRecSongId = null
        const { currentSong } = get()
        if (currentSong) {
          set({
            playlist: [currentSong],
            originalPlaylist: [currentSong],
            autoFetchRecommendations: false,
          })
        } else {
          set({
            playlist: [],
            originalPlaylist: [],
            autoFetchRecommendations: false,
          })
        }
      },

      replaceQueue: (songs: Song[], keepCurrentSong = false) => {
        lastFetchedRecSongId = null
        const { currentSong } = get()
        const secureSongs = songs.map(ensureHttpsForSongUrls)

        if (keepCurrentSong && currentSong) {
          const filtered = secureSongs.filter((s) => s.id !== currentSong.id)
          const newQueue = [currentSong, ...filtered]
          set({
            playlist: newQueue,
            originalPlaylist: newQueue,
            autoFetchRecommendations: false,
          })
        } else {
          set({
            playlist: secureSongs,
            originalPlaylist: secureSongs,
            autoFetchRecommendations: false,
          })
        }
      },

      reorderPlaylist: (newOrder: Song[]) => {
        set({ playlist: newOrder })
        if (onReorderPlaylist) {
          onReorderPlaylist(newOrder)
        }
      },

      toggleShuffle: () => {
        const { shuffleMode, playlist, originalPlaylist, currentSong } = get()

        if (!shuffleMode) {
          const currentIndex = playlist.findIndex((s) => s.id === currentSong?.id)
          const songsToShuffle = playlist.filter((_, i) => i !== currentIndex)

          for (let i = songsToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[songsToShuffle[i], songsToShuffle[j]] = [songsToShuffle[j], songsToShuffle[i]]
          }

          const shuffled =
            currentIndex !== -1 ? [playlist[currentIndex], ...songsToShuffle] : songsToShuffle

          set({ shuffleMode: true, playlist: shuffled })
        } else {
          set({ shuffleMode: false, playlist: [...originalPlaylist] })
        }
      },

      toggleRepeat: () => {
        const { repeatMode } = get()
        const modes: RepeatMode[] = ["off", "all", "one"]
        const nextIndex = (modes.indexOf(repeatMode) + 1) % modes.length
        const nextMode = modes[nextIndex]
        set({ repeatMode: nextMode })
        onRepeatModeChange?.(nextMode)
      },

      setAutoFetchRecommendations: (value: boolean) => {
        set({ autoFetchRecommendations: value })
        if (value) {
          lastFetchedRecSongId = null
          checkAndFetchRecommendations(null, true)
        }
      },

      setUserPlaylist: (playlists: any[]) => set({ userPlaylist: playlists }),

      setActivePlayerMode: (mode: "normal" | "group") => set({ activePlayerMode: mode }),
    }),
    {
      name: "player-storage",
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
          state.isPlaying = false
          state.isLoading = false
        }
      },
    }
  )
)

export const useCurrentSong = () => usePlayerStore((s) => s.currentSong)
export const useIsPlaying = () => usePlayerStore((s) => s.isPlaying)
export const useIsLoading = () => usePlayerStore((s) => s.isLoading)
export const usePlaylist = () => usePlayerStore((s) => s.playlist)
export const useShuffleMode = () =>
  usePlayerStore(
    useShallow((s) => ({ shuffleMode: s.shuffleMode, toggleShuffle: s.toggleShuffle }))
  )
export const useRepeatMode = () =>
  usePlayerStore(useShallow((s) => ({ repeatMode: s.repeatMode, toggleRepeat: s.toggleRepeat })))

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
  )

export const usePlaybackState = () => {
  return usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      isLoading: s.isLoading,
      activePlayerMode: s.activePlayerMode,
    }))
  )
}

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
  )

export const usePlaylistState = () =>
  usePlayerStore(
    useShallow((s) => ({
      playlist: s.playlist,
      userPlaylist: s.userPlaylist,
      setPlaylist: s.setPlaylist,
      setUserPlaylist: s.setUserPlaylist,
    }))
  )

export const useQueueCount = () =>
  usePlayerStore((s) => {
    if (!s.currentSong) return s.playlist.length
    return s.playlist.filter((item) => item.id !== s.currentSong?.id).length
  })

export const useNextSong = () =>
  usePlayerStore((s) => {
    if (!s.currentSong || !s.playlist.length) return null
    const idx = s.playlist.findIndex((item) => item.id === s.currentSong?.id)
    return idx >= 0 && idx < s.playlist.length - 1 ? s.playlist[idx + 1] : null
  })
