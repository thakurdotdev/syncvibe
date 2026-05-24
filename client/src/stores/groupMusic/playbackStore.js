import { toast } from "sonner"
import { create } from "zustand"

let audioElement = null
let syncTimerRef = null
let lastPlaybackActionAt = 0

export const useGroupPlaybackStore = create((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  currentSong: null,
  volume: 1,
  isLoading: false,
  isSyncing: false,
  syncCountdown: 0,
  serverTimeOffset: 0,
  lastSync: 0,

  setAudioRef: (el) => {
    audioElement = el
  },

  getAudioElement: () => audioElement,

  getServerTime: () => Date.now() + get().serverTimeOffset,

  formatTime: (seconds) => {
    if (!seconds) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  },

  loadAudio: async (url, queueItemId, socket, groupId) => {
    try {
      set({ isLoading: true })
      if (!audioElement) return

      audioElement.onended = null
      audioElement.ontimeupdate = null
      audioElement.onloadedmetadata = null

      audioElement.src = url
      await audioElement.load()

      audioElement.onloadedmetadata = () => {
        set({ currentTime: 0, duration: audioElement.duration, isLoading: false })
      }

      audioElement.ontimeupdate = () => {
        set({ currentTime: audioElement.currentTime })
      }

      audioElement.onended = () => {
        if (audioElement.currentTime < 1) return
        set({ isPlaying: false })
        if (groupId && socket) {
          socket.emit("song-ended", { groupId, songId: queueItemId })
        }
      }

      audioElement.volume = get().volume
    } catch (error) {
      console.error("Error loading audio:", error)
      toast.error("Failed to load audio")
      set({ isLoading: false })
    }
  },

  handlePlayPause: async (socket, groupId, forceState) => {
    const { isPlaying } = get()
    if (!audioElement || !socket || !groupId) return

    const newIsPlaying = typeof forceState === "boolean" ? forceState : !isPlaying
    const currentAudioTime = audioElement.currentTime || 0

    socket.emit("music-playback", {
      groupId,
      isPlaying: newIsPlaying,
      currentTime: currentAudioTime,
    })
  },

  handleSeek: (socket, groupId, value) => {
    if (!audioElement || !socket || !groupId) return
    const { isPlaying } = get()
    const newTime = value[0]

    socket.emit("music-seek", {
      groupId,
      currentTime: newTime,
      isPlaying,
    })
  },

  handleVolumeChange: (value) => {
    const newVolume = value[0]
    set({ volume: newVolume })
    if (audioElement) audioElement.volume = newVolume
  },

  updateMediaSession: (song, playPauseFn, skipFn) => {
    if (!("mediaSession" in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((a) => a.name)
        .join(", "),
      album: song?.album,
      artwork: song.image?.[2]?.link
        ? [{ src: song.image[2].link, sizes: "500x500", type: "image/jpeg" }]
        : [],
    })

    navigator.mediaSession.setActionHandler("play", () => playPauseFn(true))
    navigator.mediaSession.setActionHandler("pause", () => playPauseFn(false))
    navigator.mediaSession.setActionHandler("nexttrack", skipFn)

    document.title = `${song.name} - SyncVibe`
  },

  handleSyncState: async (data, socket, groupId) => {
    const { playbackState, queue: serverQueue, currentQueueIndex: serverQueueIndex } = data
    if (!playbackState) return
    if (get().isSyncing) return

    const recentAction = Date.now() - lastPlaybackActionAt < 4000
    if (recentAction) return

    const serverTrack = playbackState.currentTrack
    const currentItem = serverQueueIndex >= 0 && serverQueue ? serverQueue[serverQueueIndex] : null

    if (!serverTrack) {
      if (audioElement && !audioElement.paused) {
        audioElement.pause()
        set({ isPlaying: false })
      }
      set({ currentSong: null })
      return
    }

    const { currentSong } = get()
    if (!currentSong || currentSong.id !== serverTrack.id) {
      set({ currentSong: serverTrack })
      const url = serverTrack.download_url?.find((u) => u.quality === "320kbps")?.link
      if (url && audioElement) {
        await get().loadAudio(url, currentItem?.id, socket, groupId)
      }
    }

    if (!audioElement) return

    const serverNow = playbackState.serverTime || Date.now() + get().serverTimeOffset
    const clientNow = Date.now() + get().serverTimeOffset
    const timeSinceUpdate = Math.max(
      0,
      (clientNow - (playbackState.lastUpdate || serverNow)) / 1000,
    )
    const expectedTime = playbackState.currentTime + (playbackState.isPlaying ? timeSinceUpdate : 0)
    const actualTime = audioElement.currentTime
    const drift = Math.abs(expectedTime - actualTime)

    if (drift > 1.0 && expectedTime <= (audioElement.duration || Infinity)) {
      audioElement.currentTime = expectedTime
    }

    if (playbackState.isPlaying && audioElement.paused) {
      try {
        await audioElement.play()
        set({ isPlaying: true })
      } catch (err) {
        console.error("Autoplay blocked:", err)
      }
    } else if (!playbackState.isPlaying && !audioElement.paused) {
      audioElement.pause()
      set({ isPlaying: false })
    }
  },

  handlePlaybackUpdate: (data) => {
    if (get().isSyncing) return
    lastPlaybackActionAt = Date.now()
    const { isPlaying: newIsPlaying, currentTime: newTime, serverTime, isSeeking } = data

    if (!audioElement) return

    let adjustedTime = newTime
    if (serverTime) {
      const clientNow = Date.now() + get().serverTimeOffset
      const elapsed = Math.max(0, (clientNow - serverTime) / 1000)
      adjustedTime = newIsPlaying ? newTime + elapsed : newTime
    }

    const drift = Math.abs(audioElement.currentTime - adjustedTime)
    if (drift > 0.3 || isSeeking) {
      audioElement.currentTime = adjustedTime
    }

    if (newIsPlaying) {
      audioElement.play().catch(() => {})
      set({ isPlaying: true })
    } else {
      audioElement.pause()
      set({ isPlaying: false })
    }

    set({ currentTime: adjustedTime })
  },

  handleMusicUpdate: async (
    { song, currentTime, queueItem, autoPlay, scheduledPlayTime, serverTime },
    socket,
    groupId,
  ) => {
    if (syncTimerRef) clearInterval(syncTimerRef)
    lastPlaybackActionAt = Date.now()

    set({ currentSong: song })
    const url = song.download_url.find((u) => u.quality === "320kbps")?.link
    const { loadAudio } = get()

    if (scheduledPlayTime) {
      set({ isSyncing: true })
      const clientNow = Date.now() + get().serverTimeOffset
      const totalDelay = Math.max(0, scheduledPlayTime - clientNow)
      set({ syncCountdown: Math.ceil(totalDelay / 1000) })

      syncTimerRef = setInterval(() => {
        const remaining = Math.max(0, scheduledPlayTime - (Date.now() + get().serverTimeOffset))
        const secs = Math.ceil(remaining / 1000)
        set({ syncCountdown: secs })
        if (secs <= 0) {
          clearInterval(syncTimerRef)
          syncTimerRef = null
        }
      }, 200)

      if (url) await loadAudio(url, queueItem?.id, socket, groupId)

      const nowAfterLoad = Date.now() + get().serverTimeOffset
      const remainingDelay = Math.max(0, scheduledPlayTime - nowAfterLoad)

      setTimeout(async () => {
        set({ isSyncing: false, syncCountdown: 0 })
        lastPlaybackActionAt = Date.now()
        if (audioElement?.src) {
          audioElement.currentTime = currentTime || 0
          try {
            await audioElement.play()
            set({ isPlaying: true })
          } catch (err) {
            console.error("Autoplay blocked:", err)
          }
        }
      }, remainingDelay)
    } else {
      if (url) {
        await loadAudio(url, queueItem?.id, socket, groupId)
        if (audioElement) {
          audioElement.currentTime = currentTime
          if (autoPlay) {
            try {
              await audioElement.play()
              set({ isPlaying: true })
            } catch (err) {
              console.error("Autoplay blocked:", err)
            }
          }
        }
      }
    }

    if (queueItem?.addedBy) {
      toast.info(`Now playing: ${song.name} (added by ${queueItem.addedBy.userName})`)
    }
  },

  syncPlaybackFromServer: async (
    playbackState,
    serverQueue,
    serverQueueIndex,
    socket,
    groupId,
    serverTimeOffset,
  ) => {
    if (!playbackState?.currentTrack) return

    set({ currentSong: playbackState.currentTrack })
    const url =
      playbackState.currentTrack.download_url?.find((u) => u.quality === "320kbps")?.link ||
      playbackState.currentTrack.download_url?.[3]?.link

    if (url) {
      await get().loadAudio(url, serverQueue?.[serverQueueIndex]?.id, socket, groupId)

      const serverNow = Date.now() + serverTimeOffset
      const timePassed = (serverNow - playbackState.lastUpdate) / 1000
      const syncedTime = playbackState.currentTime + (playbackState.isPlaying ? timePassed : 0)

      if (audioElement) {
        audioElement.currentTime = Math.min(syncedTime, audioElement.duration || syncedTime)

        if (playbackState.isPlaying) {
          try {
            await audioElement.play()
            set({ isPlaying: true })
          } catch (err) {
            console.error("Autoplay blocked:", err)
          }
        }
      }
    }
  },

  reset: () => {
    if (audioElement) {
      audioElement.pause()
      audioElement.removeAttribute("src")
      audioElement.load()
    }
    if (syncTimerRef) {
      clearInterval(syncTimerRef)
      syncTimerRef = null
    }
    set({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      currentSong: null,
      isLoading: false,
      isSyncing: false,
      syncCountdown: 0,
    })
  },
}))
