import { Song } from "@/types/song"
import { playbackHistory } from "@/utils/playbackHistory"
import streamingManager from "@/utils/streamingManager"
import { addToHistory } from "@/utils/api/addToHistory"
import { AppState, AppStateStatus } from "react-native"
import TrackPlayer, { Event, RepeatMode } from "@rntp/player"
import { setupPlayer } from "@/utils/playerSetup"
import {
  usePlayerStore,
  setOnReorderPlaylist,
  setOnPlaySong,
  setOnStopSong,
  setOnPlayPause,
  setOnHandleNextSong,
  setOnHandlePrevSong,
  setOnRepeatModeChange,
  type RepeatMode as StoreRepeatMode,
} from "./playerStore"
import { useGroupPlaybackStore } from "./groupMusic/groupPlaybackStore"

const pauseGroupPlaybackLocally = () => {
  const groupStore = useGroupPlaybackStore.getState()
  if (groupStore.isPlaying) {
    TrackPlayer.pause()
    groupStore.stopProgressPolling()
    useGroupPlaybackStore.setState({ isPlaying: false })
  }
}

interface MediaItem {
  mediaId?: string
  url: any
  title?: string
  artist?: string
  albumTitle?: string
  artworkUrl?: string
  duration?: number
  isLive?: boolean
  mimeType?: string
  extras?: Record<string, unknown>
}

const trackCache = new Map<string, MediaItem>()
const MAX_TRACK_CACHE_SIZE = 50
const QUEUE_LOOKAHEAD = 3
const QUEUE_APPEND_THRESHOLD = 2

const addToTrackCache = (songId: string, track: MediaItem) => {
  if (trackCache.size >= MAX_TRACK_CACHE_SIZE) {
    const oldestKey = trackCache.keys().next().value
    if (oldestKey !== undefined) {
      trackCache.delete(oldestKey)
    }
  }
  trackCache.set(songId, track)
}

const resolveStreamUrl = (song: Song): string => {
  const qualities = ["320kbps", "128kbps", "48kbps", "12kbps"]
  for (const quality of qualities) {
    const link = song.download_url?.find((u) => u.quality === quality)?.link
    if (link) return link
  }
  return song.download_url?.[0]?.link || ""
}

const buildMediaItem = (song: Song, audioUrl: string): MediaItem => {
  const artwork = song.image[2]?.link || song.image[1]?.link || song.image[0]?.link
  return {
    mediaId: song.id,
    url: {
      uri: audioUrl,
      headers: {
        "User-Agent": "SyncVibe/1.0",
        Accept: "audio/*",
      },
    },
    title: song.name || "Unknown Title",
    artist: song?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist",
    albumTitle: song.album || "Unknown Album",
    artworkUrl: artwork,
    duration: song.duration || 0,
  }
}

const convertSongToTrackSync = (song: Song): MediaItem | null => {
  if (trackCache.has(song.id)) {
    return trackCache.get(song.id)!
  }

  const audioUrl = resolveStreamUrl(song)
  if (!audioUrl) return null

  const track = buildMediaItem(song, audioUrl)
  addToTrackCache(song.id, track)
  return track
}

export const convertSongToTrack = async (song: Song): Promise<MediaItem> => {
  const cached = convertSongToTrackSync(song)
  if (cached) return cached

  try {
    const streamingTrack = await streamingManager.convertSongToStreamingTrack(song)
    addToTrackCache(song.id, streamingTrack)
    return streamingTrack
  } catch (error) {
    console.error(`Failed to get streaming track for ${song.name}:`, error)
    const audioUrl = resolveStreamUrl(song)
    if (!audioUrl) throw error
    const track = buildMediaItem(song, audioUrl)
    addToTrackCache(song.id, track)
    return track
  }
}

let trackPlayerInitialized = false
let isSwitchingTracks = false
let isRecoveringFromError = false
let playbackErrorRetries = 0
let lastPlaybackErrorTime = 0
let bridgeUserId: number | undefined
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null

const MAX_PLAYBACK_ERROR_RETRIES = 2
const PLAYBACK_ERROR_COOLDOWN_MS = 8000

const resetPlaybackErrorState = () => {
  playbackErrorRetries = 0
  isRecoveringFromError = false
  lastPlaybackErrorTime = 0
}

const hasExceededPlaybackErrorRetries = () => {
  const withinCooldown = Date.now() - lastPlaybackErrorTime < PLAYBACK_ERROR_COOLDOWN_MS
  return withinCooldown && playbackErrorRetries >= MAX_PLAYBACK_ERROR_RETRIES
}

const pausePlaybackAfterError = (store: ReturnType<typeof getStore>) => {
  isRecoveringFromError = false
  store.setPlaying(false)
  try {
    TrackPlayer.pause()
  } catch {
    // Player may already be stopped after a fatal error.
  }
}

const getStore = () => usePlayerStore.getState()

export const setBridgeUserId = (userId?: number) => {
  bridgeUserId = userId
}

const getNativeRepeatMode = (mode: StoreRepeatMode) => {
  if (mode === "one") return RepeatMode.One
  if (mode === "all") return RepeatMode.All
  return RepeatMode.Off
}

const convertSongsBatch = (songs: Song[]): MediaItem[] => {
  return songs
    .map(convertSongToTrackSync)
    .filter((track): track is MediaItem => track != null && !!track.url)
}

const appendUpcomingTracks = () => {
  if (!trackPlayerInitialized) return

  const store = getStore()
  const { playlist } = store
  if (!playlist.length) return

  const queue = TrackPlayer.getQueue()
  const activeIndex = TrackPlayer.getActiveMediaItemIndex() ?? 0
  const tracksRemainingInQueue = queue.length - activeIndex - 1

  if (tracksRemainingInQueue >= QUEUE_APPEND_THRESHOLD) return

  const lastQueueItem = queue[queue.length - 1]
  if (!lastQueueItem?.mediaId) return

  const lastInPlaylistIndex = playlist.findIndex((s) => s.id === lastQueueItem.mediaId)
  if (lastInPlaylistIndex < 0 || lastInPlaylistIndex >= playlist.length - 1) return

  const appendStart = lastInPlaylistIndex + 1
  const appendEnd = Math.min(appendStart + QUEUE_LOOKAHEAD, playlist.length)
  const queueIds = new Set(queue.map((t) => t.mediaId))
  const newSongs = playlist.slice(appendStart, appendEnd).filter((s) => !queueIds.has(s.id))

  if (newSongs.length === 0) return

  const tracks = convertSongsBatch(newSongs)
  if (tracks.length > 0) {
    TrackPlayer.addMediaItems(tracks)
  }
}

const syncQueueFromPlaylist = (playlist: Song[], startIndex: number, userId?: number) => {
  if (!trackPlayerInitialized || !playlist.length) return

  isSwitchingTracks = true
  const store = getStore()

  const endIndex = Math.min(startIndex + QUEUE_LOOKAHEAD, playlist.length)
  const tracks = convertSongsBatch(playlist.slice(startIndex, endIndex))

  if (tracks.length === 0) {
    isSwitchingTracks = false
    return
  }

  TrackPlayer.setRepeatMode(getNativeRepeatMode(store.repeatMode))
  TrackPlayer.setMediaItems(tracks, 0)
  TrackPlayer.play()

  const song = playlist[startIndex]
  if (song && song.id !== store.currentSong?.id) {
    store.setCurrentSong(song)
  }

  store.setPlaying(true)

  if (userId && song?.id) {
    playbackHistory.updatePlaybackProgress(song, 0, song.duration || 0, true).catch(console.error)
  }
}

export const bridgePlaySong = (song: Song, userId?: number) => {
  if (!trackPlayerInitialized || !song?.id) return

  pauseGroupPlaybackLocally()
  resetPlaybackErrorState()
  const store = getStore()
  if (store.activePlayerMode !== "normal") {
    store.setActivePlayerMode("normal")
  }
  const playlist = store.playlist.length ? store.playlist : [song]
  const queue = TrackPlayer.getQueue()
  const trackIndex = queue.findIndex((t) => t.mediaId === song.id)

  if (trackIndex >= 0) {
    isSwitchingTracks = true

    const activeIndex = TrackPlayer.getActiveMediaItemIndex()
    if (trackIndex === activeIndex) {
      if (!TrackPlayer.isPlaying()) {
        TrackPlayer.play()
      }
    } else {
      TrackPlayer.skipToIndex(trackIndex)
      TrackPlayer.play()
    }

    store.setPlaying(true)
    appendUpcomingTracks()
    return
  }

  const startIndex = Math.max(
    0,
    playlist.findIndex((s) => s.id === song.id),
  )
  syncQueueFromPlaylist(playlist, startIndex, userId)
  appendUpcomingTracks()
}

export const bridgeStopSong = async () => {
  if (!trackPlayerInitialized) return

  try {
    await playbackHistory.stopPlayback().catch(console.error)
    TrackPlayer.stop()
    TrackPlayer.clear()
  } catch (error) {
    console.error("Stop song error:", error)
  }
}

export const bridgePlayPause = () => {
  if (!trackPlayerInitialized) return

  pauseGroupPlaybackLocally()
  const store = getStore()
  if (store.activePlayerMode !== "normal") {
    store.setActivePlayerMode("normal")
  }

  const activeItem = TrackPlayer.getActiveMediaItem()
  const isActiveSongMatched = activeItem?.mediaId === store.currentSong?.id

  if (!isActiveSongMatched) {
    if (store.currentSong) {
      bridgePlaySong(store.currentSong, bridgeUserId)
    } else {
      store.setPlaying(false)
    }
    return
  }

  const currentlyPlaying = TrackPlayer.isPlaying()

  if (currentlyPlaying) {
    TrackPlayer.pause()
    store.setPlaying(false)
    return
  }

  if (!store.currentSong) {
    store.setPlaying(false)
    return
  }

  resetPlaybackErrorState()

  const playerState = TrackPlayer.getPlaybackState()
  if (playerState === "idle") {
    bridgePlaySong(store.currentSong, bridgeUserId)
  } else {
    TrackPlayer.play()
    store.setPlaying(true)
  }
}

export const bridgeHandleNextSong = (isAutoPlay = false, userId?: number) => {
  if (!trackPlayerInitialized) return

  pauseGroupPlaybackLocally()
  const store = getStore()
  if (store.activePlayerMode !== "normal") {
    store.setActivePlayerMode("normal")
  }
  const { currentSong, playlist, repeatMode } = store
  if (!currentSong || !playlist.length) return

  const activeItem = TrackPlayer.getActiveMediaItem()
  const isActiveSongMatched = activeItem?.mediaId === currentSong.id

  if (repeatMode === "one" && !isAutoPlay) {
    isSwitchingTracks = true
    TrackPlayer.seekTo(0)
    TrackPlayer.play()
    store.setPlaying(true)
    return
  }

  if (isAutoPlay && repeatMode === "one") return

  const currentIndex = playlist.findIndex((s) => s.id === currentSong.id)
  if (currentIndex === -1) {
    if (playlist.length > 0) {
      store.setCurrentSong(playlist[0])
      bridgePlaySong(playlist[0], userId)
    }
    return
  }

  const isLastSong = currentIndex === playlist.length - 1
  if (isAutoPlay && isLastSong && repeatMode === "off") {
    store.setPlaying(false)
    isSwitchingTracks = false
    return
  }

  const queue = TrackPlayer.getQueue()
  const activeIndex = TrackPlayer.getActiveMediaItemIndex()
  const canSkipNative =
    isActiveSongMatched && activeIndex != null && activeIndex >= 0 && activeIndex < queue.length - 1

  if (canSkipNative) {
    isSwitchingTracks = true
    const nextSong = playlist[currentIndex + 1]
    if (nextSong) {
      store.setCurrentSong(nextSong)
    }
    store.setPlaying(true)
    TrackPlayer.skipToNext()
    appendUpcomingTracks()
    return
  }

  if (isAutoPlay && isLastSong && repeatMode === "all") {
    store.setCurrentSong(playlist[0])
    syncQueueFromPlaylist(playlist, 0, userId)
    appendUpcomingTracks()
    return
  }

  const nextIndex = (currentIndex + 1) % playlist.length
  const nextSong = playlist[nextIndex]
  store.setCurrentSong(nextSong)
  store.setPlaying(true)
  bridgePlaySong(nextSong, userId)
}

export const bridgeHandlePrevSong = (userId?: number) => {
  if (!trackPlayerInitialized) return

  pauseGroupPlaybackLocally()
  const store = getStore()
  if (store.activePlayerMode !== "normal") {
    store.setActivePlayerMode("normal")
  }

  const position = TrackPlayer.getProgress().position
  if (position > 3) {
    TrackPlayer.seekTo(0)
    return
  }

  const { currentSong, playlist } = store
  if (!currentSong || !playlist.length) return

  const activeItem = TrackPlayer.getActiveMediaItem()
  const isActiveSongMatched = activeItem?.mediaId === currentSong.id

  const queue = TrackPlayer.getQueue()
  const activeIndex = TrackPlayer.getActiveMediaItemIndex()

  if (isActiveSongMatched && activeIndex != null && activeIndex > 0) {
    isSwitchingTracks = true
    const prevTrack = queue[activeIndex - 1]
    const prevSong = prevTrack?.mediaId
      ? playlist.find((s) => s.id === prevTrack.mediaId)
      : undefined
    if (prevSong) {
      store.setCurrentSong(prevSong)
    }
    store.setPlaying(true)
    TrackPlayer.skipToPrevious()
    return
  }

  const currentIndex = playlist.findIndex((s) => s.id === currentSong.id)
  if (currentIndex > 0) {
    const prevSong = playlist[currentIndex - 1]
    store.setCurrentSong(prevSong)
    store.setPlaying(true)
    bridgePlaySong(prevSong, userId)
  } else {
    store.setCurrentSong(playlist[0])
    store.setPlaying(true)
    bridgePlaySong(playlist[0], userId)
  }
}

export const bridgeSetRepeatMode = (mode: StoreRepeatMode) => {
  if (!trackPlayerInitialized) return
  TrackPlayer.setRepeatMode(getNativeRepeatMode(mode))
}

let reorderTimeout: ReturnType<typeof setTimeout> | null = null

export const syncReorderPlaylist = (newOrder: Song[]) => {
  if (!trackPlayerInitialized) return

  if (reorderTimeout) {
    clearTimeout(reorderTimeout)
  }

  reorderTimeout = setTimeout(async () => {
    try {
      const currentTrackIndex = TrackPlayer.getActiveMediaItemIndex()
      const currentQueue = TrackPlayer.getQueue()
      const currentTrack =
        currentTrackIndex != null && currentTrackIndex >= 0
          ? currentQueue[currentTrackIndex]
          : undefined

      if (!currentTrack?.mediaId) return

      const newCurrentIndex = newOrder.findIndex((song) => song.id === currentTrack.mediaId)
      if (newCurrentIndex < 0) return

      const queue = TrackPlayer.getQueue()
      if (queue.length > newCurrentIndex + 1) {
        TrackPlayer.removeMediaItems(newCurrentIndex + 1, queue.length)
      }

      const queueIds = new Set(TrackPlayer.getQueue().map((t) => t.mediaId))
      const songsToAdd = newOrder
        .slice(newCurrentIndex + 1, newCurrentIndex + 1 + QUEUE_LOOKAHEAD)
        .filter((s) => !queueIds.has(s.id))

      if (songsToAdd.length > 0) {
        const tracks = convertSongsBatch(songsToAdd)
        if (tracks.length > 0) {
          TrackPlayer.addMediaItems(tracks)
        }
      }
    } catch (error) {
      console.error("Error syncing reorder:", error)
    }
  }, 500)
}

const syncStoreFromActiveTrack = () => {
  const store = getStore()
  const activeItem = TrackPlayer.getActiveMediaItem()

  if (activeItem?.mediaId) {
    const song = store.playlist.find((s) => s.id === activeItem.mediaId)
    if (song && song.id !== store.currentSong?.id) {
      store.setCurrentSong(song)
    }
  }

  store.setPlaying(TrackPlayer.isPlaying())
}

export const initializeTrackPlayer = async (userId?: number): Promise<boolean> => {
  try {
    setBridgeUserId(userId)
    await playbackHistory.preloadHistoryData().catch(console.error)

    const isSetup = setupPlayer()
    trackPlayerInitialized = isSetup

    if (isSetup) {
      setupAppStateListener()
      bridgeSetRepeatMode(getStore().repeatMode)
      await restoreLastPlayedSong()
    }

    return isSetup
  } catch (error) {
    console.error("Error initializing TrackPlayer:", error)
    return false
  }
}

const restoreLastPlayedSong = async () => {
  const store = getStore()

  try {
    const lastPlayedData = await playbackHistory.getLastPlayedSong()
    const song = store.currentSong ?? lastPlayedData?.song

    if (!song) return

    if (!store.currentSong) {
      store.setCurrentSong(song)
    }

    const track = convertSongToTrackSync(song)
    if (!track?.url) return

    TrackPlayer.setRepeatMode(getNativeRepeatMode(store.repeatMode))
    TrackPlayer.setMediaItems([track])
    TrackPlayer.pause()

    const position = lastPlayedData?.position ?? 0
    if (position > 0) {
      TrackPlayer.seekTo(position)
    }

    appendUpcomingTracks()
  } catch (error) {
    console.error("Error restoring last played song:", error)
    getStore().stopSong()
  }
}

const setupAppStateListener = () => {
  if (appStateSubscription) return

  appStateSubscription = AppState.addEventListener(
    "change",
    async (nextAppState: AppStateStatus) => {
      const store = getStore()

      if (nextAppState === "background") {
        if (trackCache.size > MAX_TRACK_CACHE_SIZE / 2) {
          trackCache.clear()
        }

        if (store.currentSong?.id && trackPlayerInitialized) {
          try {
            const { position, duration } = TrackPlayer.getProgress()
            if (position > 0 && duration > 0) {
              await playbackHistory.updatePlaybackProgress(
                store.currentSong,
                position,
                duration,
                TrackPlayer.isPlaying(),
              )
            }
          } catch (error) {
            console.error("Error saving position on background:", error)
          }
        }
      }

      if (nextAppState === "active" && trackPlayerInitialized) {
        try {
          syncStoreFromActiveTrack()

          if (store.currentSong) {
            const { position, duration } = TrackPlayer.getProgress()
            if (position > 0) {
              playbackHistory.updatePlaybackProgress(
                store.currentSong,
                position,
                duration,
                TrackPlayer.isPlaying(),
              )
            }
          }
        } catch (error) {
          console.error("Error resyncing on foreground:", error)
        }
      }
    },
  )
}

export const dispatchTrackPlayerEvent = async (event: { type: string; [key: string]: unknown }) => {
  if (!trackPlayerInitialized) return

  const store = getStore()
  const userId = bridgeUserId

  if (store.activePlayerMode === "group") {
    if (event.type === Event.RemoteStop) {
      const groupStore = useGroupPlaybackStore.getState()
      if (groupStore.isPlaying) {
        TrackPlayer.pause()
        groupStore.stopProgressPolling()
        useGroupPlaybackStore.setState({ isPlaying: false })
      }
      TrackPlayer.stop()
      TrackPlayer.clear()
    }
    return
  }

  try {
    switch (event.type) {
      case Event.PlaybackStateChanged: {
        const playerState = event.state as string

        if (playerState === "ended") {
          if (isSwitchingTracks || isRecoveringFromError || hasExceededPlaybackErrorRetries()) break
          isSwitchingTracks = true
          bridgeHandleNextSong(true, userId)
        }
        break
      }

      case Event.IsPlayingChanged: {
        const playing = event.playing as boolean

        if (playing) {
          isSwitchingTracks = false
        }

        if (isRecoveringFromError) {
          break
        }

        store.setPlaying(playing)

        if (store.currentSong) {
          const { position, duration } = TrackPlayer.getProgress()
          playbackHistory
            .updatePlaybackProgress(store.currentSong, position, duration, playing)
            .catch(console.error)
        }
        break
      }

      case Event.MediaItemTransition: {
        if (event.item && event.index !== undefined) {
          const trackId = (event.item as MediaItem).mediaId
          if (trackId) {
            const playlist = store.playlist
            const songIndex = playlist.findIndex((song) => song.id === trackId)

            if (songIndex >= 0) {
              const song = playlist[songIndex]
              if (song.id !== store.currentSong?.id) {
                store.setCurrentSong(song)

                if (userId) {
                  playbackHistory
                    .updatePlaybackProgress(song, 0, song.duration || 0, true)
                    .catch(console.error)
                  addToHistory(song, 10).catch(console.error)
                }
              }
            }
          }
        }

        isSwitchingTracks = false
        resetPlaybackErrorState()
        appendUpcomingTracks()
        break
      }

      case Event.PlaybackError: {
        console.error(`Playback error: ${event.code} - ${event.message}`)
        isSwitchingTracks = false
        lastPlaybackErrorTime = Date.now()

        if (isRecoveringFromError || hasExceededPlaybackErrorRetries()) {
          pausePlaybackAfterError(store)
          break
        }

        if (store.currentSong) {
          playbackErrorRetries += 1
          isRecoveringFromError = true

          try {
            trackCache.delete(store.currentSong.id)
            const fallbackTrack = convertSongToTrackSync(store.currentSong)
            if (fallbackTrack?.url) {
              isSwitchingTracks = true
              TrackPlayer.stop()
              TrackPlayer.clear()
              TrackPlayer.setMediaItems([fallbackTrack])
              TrackPlayer.play()
              store.setPlaying(true)
              return
            }
          } catch (fallbackError) {
            console.error("Fallback URL also failed:", fallbackError)
          }

          pausePlaybackAfterError(store)
        } else {
          pausePlaybackAfterError(store)
        }
        break
      }

      case Event.RemoteStop: {
        store.stopSong()
        await bridgeStopSong()
        break
      }

      case Event.PlaybackProgressUpdated: {
        const position = event.position as number
        const duration = event.duration as number

        if (position > 1 && isRecoveringFromError) {
          resetPlaybackErrorState()
          store.setPlaying(TrackPlayer.isPlaying())
        }

        if (position > 0 && store.currentSong && store.isPlaying) {
          if (position > 5 && duration - position > 5 && Math.floor(position) % 10 === 0) {
            playbackHistory
              .updatePlaybackProgress(store.currentSong, position, duration, store.isPlaying)
              .catch(console.error)
          }
        }
        break
      }
    }
  } catch (error) {
    console.error("Error handling TrackPlayer event:", error)
    isSwitchingTracks = false
  }
}

export const handleTrackPlayerEvents = dispatchTrackPlayerEvent

export const destroyTrackPlayer = async () => {
  if (appStateSubscription) {
    appStateSubscription.remove()
    appStateSubscription = null
  }

  playbackHistory.destroy()
  trackCache.clear()
  resetPlaybackErrorState()

  if (trackPlayerInitialized) {
    try {
      TrackPlayer.stop()
      TrackPlayer.clear()
    } catch (error) {
      console.error("Error resetting TrackPlayer:", error)
    }
    trackPlayerInitialized = false
  }
}

export const isTrackPlayerReady = () => trackPlayerInitialized

setOnReorderPlaylist(syncReorderPlaylist)
setOnPlaySong((song) => bridgePlaySong(song, bridgeUserId))
setOnStopSong(() => bridgeStopSong())
setOnPlayPause(() => bridgePlayPause())
setOnHandleNextSong((isAutoPlay) => bridgeHandleNextSong(isAutoPlay, bridgeUserId))
setOnHandlePrevSong(() => bridgeHandlePrevSong(bridgeUserId))
setOnRepeatModeChange((mode) => bridgeSetRepeatMode(mode))
