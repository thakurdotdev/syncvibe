import { useSocket } from "@/Context/ChatContext"
import { useProfile } from "@/Context/Context"
import { ensureHttpsForDownloadUrls } from "@/Pages/Music/Common"
import axios from "axios"
import _ from "lodash"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

export const GroupMusicContext = createContext(null)

// Session storage key for group persistence
const SESSION_KEY = "syncvibe_group_session"

export function GroupMusicProvider({ children }) {
  const { socket } = useSocket()
  const { user } = useProfile()

  // Group state
  const [currentGroup, setCurrentGroup] = useState(null)
  const [groupMembers, setGroupMembers] = useState([])
  const [messages, setMessages] = useState([])

  // Queue state
  const [queue, setQueue] = useState([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1)
  const [isQueueOpen, setIsQueueOpen] = useState(false)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentSong, setCurrentSong] = useState(null)
  const [volume, setVolume] = useState(0.7)
  const [isLoading, setIsLoading] = useState(false)

  // Search state
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)

  // Sync state
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const [lastSync, setLastSync] = useState(0)

  // UI state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [connectionState, setConnectionState] = useState("disconnected")
  const [isRejoining, setIsRejoining] = useState(false)

  // Refs
  const syncIntervalRef = useRef(null)
  const lastPlaybackUpdateRef = useRef(null)
  const periodicSyncRef = useRef(null)
  const hasAttemptedRejoinRef = useRef(false)
  const audioRef = useRef(null)

  // Derived state
  const currentQueueItem = useMemo(() => {
    return currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null
  }, [queue, currentQueueIndex])

  const upcomingQueue = useMemo(() => {
    return queue.filter((_, idx) => idx > currentQueueIndex)
  }, [queue, currentQueueIndex])

  const playedQueue = useMemo(() => {
    return queue.filter((_, idx) => idx < currentQueueIndex)
  }, [queue, currentQueueIndex])

  // Utility functions
  const getServerTime = useCallback(() => {
    return Date.now() + serverTimeOffset
  }, [serverTimeOffset])

  const formatTime = (seconds) => {
    if (!seconds) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Session management
  const saveSession = useCallback((groupId) => {
    if (groupId) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ groupId, lastUpdate: Date.now() }))
    }
  }, [])

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  const getStoredSession = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (e) {
      console.error("Error reading session:", e)
      return null
    }
  }, [])

  // Media session
  const updateMediaSession = useCallback((song) => {
    if (!("mediaSession" in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.name,
      artist: song?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", "),
      album: song?.album,
      artwork: song.image?.[2]?.link
        ? [{ src: song.image[2].link, sizes: "500x500", type: "image/jpeg" }]
        : [],
    })

    navigator.mediaSession.setActionHandler("play", () => handlePlayPause(true))
    navigator.mediaSession.setActionHandler("pause", () => handlePlayPause(false))
    navigator.mediaSession.setActionHandler("nexttrack", () => skipSong())

    document.title = `${song.name} - SyncVibe`
  }, [])

  useEffect(() => {
    if (currentSong) {
      updateMediaSession(currentSong)
    }
  }, [currentSong, updateMediaSession])

  // Beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentGroup) {
        e.preventDefault()
        e.returnValue = "You are in a music group. Your session will be restored when you return."
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [currentGroup])

  // Audio loading - accepts optional queueItemId for idempotent song-ended tracking
  const loadAudio = useCallback(
    async (url, queueItemId = null) => {
      try {
        setIsLoading(true)
        if (audioRef.current) {
          audioRef.current.src = url
          await audioRef.current.load()

          audioRef.current.onloadedmetadata = () => {
            setCurrentTime(0)
            setDuration(audioRef.current.duration)
            setIsLoading(false)
          }

          audioRef.current.ontimeupdate = () => {
            setCurrentTime(audioRef.current.currentTime)
          }

          audioRef.current.onended = () => {
            setIsPlaying(false)
            // Notify server that song ended - pass songId for idempotency
            if (currentGroup?.id) {
              socket.emit("song-ended", {
                groupId: currentGroup.id,
                songId: queueItemId, // Server uses this to verify which song ended
              })
            }
          }

          audioRef.current.volume = volume
        }
      } catch (error) {
        console.error("Error loading audio:", error)
        toast.error("Failed to load audio")
        setIsLoading(false)
      }
    },
    [currentGroup?.id, socket, volume],
  )

  // Playback controls
  const handlePlayPause = async (forceState) => {
    const newIsPlaying = typeof forceState === "boolean" ? forceState : !isPlaying
    const currentAudioTime = audioRef.current?.currentTime || 0

    try {
      const scheduledTime = getServerTime() + 300

      socket.emit("music-playback", {
        groupId: currentGroup?.id,
        isPlaying: newIsPlaying,
        currentTime: currentAudioTime,
        scheduledTime,
      })

      const executePlayback = async () => {
        if (newIsPlaying) {
          try {
            await audioRef.current.play()
          } catch (err) {
            console.error("Error playing audio:", err)
          }
        } else {
          audioRef.current.pause()
        }
        setIsPlaying(newIsPlaying)
      }

      const delay = Math.max(0, scheduledTime - getServerTime())
      setTimeout(executePlayback, delay)
    } catch (error) {
      console.error("Playback control error:", error)
    }
  }

  const handleSeek = (value) => {
    if (!audioRef.current) return

    const newTime = value[0]
    const scheduledTime = getServerTime() + 300

    socket.emit("music-seek", {
      groupId: currentGroup?.id,
      currentTime: newTime,
      scheduledTime,
      isPlaying,
    })

    audioRef.current.currentTime = newTime
  }

  const handleVolumeChange = (value) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  // ==================== QUEUE FUNCTIONS ====================

  // Add song to queue
  const addToQueue = useCallback(
    (song) => {
      if (!currentGroup?.id || !user) return

      const securedSong = ensureHttpsForDownloadUrls(song)

      socket.emit("add-to-queue", {
        groupId: currentGroup.id,
        song: securedSong,
        addedBy: {
          userId: user.userid,
          userName: user.name,
          profilePic: user.profilepic,
        },
      })

      setIsSearchOpen(false)
      setSearchQuery("")
      setSearchResults([])
      toast.success("Added to queue")
    },
    [currentGroup?.id, user, socket],
  )

  // Play song now (inserts at current position)
  const playNow = useCallback(
    async (song) => {
      if (!currentGroup?.id || !user) return

      try {
        const securedSong = ensureHttpsForDownloadUrls(song)
        setIsLoading(true)
        setCurrentSong(securedSong)
        setIsPlaying(false)
        setDuration(0)
        setCurrentTime(0)

        const url = securedSong.download_url.find((url) => url.quality === "320kbps").link
        await loadAudio(url)

        socket.emit("music-change", {
          groupId: currentGroup.id,
          song: securedSong,
          currentTime: 0,
          scheduledTime: Date.now() + serverTimeOffset + 300,
          addedBy: {
            userId: user.userid,
            userName: user.name,
            profilePic: user.profilepic,
          },
        })

        setIsSearchOpen(false)
        setSearchQuery("")
        setSearchResults([])
      } catch (error) {
        console.log(error)
        toast.error("Failed to load song")
      } finally {
        setIsLoading(false)
      }
    },
    [currentGroup?.id, user, socket, serverTimeOffset, loadAudio],
  )

  // Remove song from queue
  const removeFromQueue = useCallback(
    (queueItemId) => {
      if (!currentGroup?.id || !user) return

      socket.emit("remove-from-queue", {
        groupId: currentGroup.id,
        queueItemId,
        userId: user.userid,
      })
    },
    [currentGroup?.id, user, socket],
  )

  // Skip to next song
  const skipSong = useCallback(() => {
    if (!currentGroup?.id) return
    socket.emit("skip-song", { groupId: currentGroup.id, userName: user?.name })
  }, [currentGroup?.id, socket, user?.name])

  // Reorder queue - server is source of truth
  const reorderQueue = useCallback(
    (fromIndex, toIndex) => {
      if (!currentGroup?.id) return
      if (fromIndex === toIndex) return

      // Emit to server - server will broadcast updated queue
      socket.emit("reorder-queue", {
        groupId: currentGroup.id,
        fromIndex,
        toIndex,
      })
    },
    [currentGroup?.id, socket],
  )

  // Search
  const debouncedSearch = useCallback(
    _.debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([])
        return
      }

      try {
        setIsSearchLoading(true)
        const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/search/songs?q=${query}`)
        setSearchResults(response.data?.data?.results || [])
      } catch (error) {
        toast.error("Search failed. Please try again.")
      } finally {
        setIsSearchLoading(false)
      }
    }, 500),
    [],
  )

  // Group management
  const createGroup = (groupName) => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name")
      return
    }

    socket.emit("create-music-group", {
      name: groupName,
      createdBy: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    })
    setIsGroupModalOpen(false)
  }

  const joinGroup = (groupId) => {
    if (!groupId.trim()) return

    socket.emit("join-music-group", {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    })
    setIsGroupModalOpen(false)
  }

  const rejoinGroup = useCallback(
    (groupId) => {
      if (!groupId || !user?.userid || !socket) return

      setIsRejoining(true)
      socket.emit("rejoin-music-group", {
        groupId,
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      })
    },
    [socket, user],
  )

  const leaveGroup = () => {
    if (!currentGroup) return

    socket.emit("leave-group", {
      groupId: currentGroup.id,
      userId: user.userid,
    })

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    setCurrentGroup(null)
    setCurrentSong(null)
    setIsPlaying(false)
    setMessages([])
    setGroupMembers([])
    setQueue([])
    setCurrentQueueIndex(-1)
    clearSession()
    toast.info(`Left group ${currentGroup.name}`)
  }

  const sendMessage = (message) => {
    if (!message.trim()) return

    socket.emit("chat-message", {
      groupId: currentGroup?.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      message,
    })
  }

  // Time sync with server
  useEffect(() => {
    if (socket) {
      const syncWithServer = () => {
        const startTime = Date.now()
        socket.emit("time-sync-request", { clientTime: startTime })
      }

      socket.on("time-sync-response", (data) => {
        const endTime = Date.now()
        const roundTripTime = endTime - data.clientTime
        const serverTime = data.serverTime + roundTripTime / 2
        setServerTimeOffset(serverTime - endTime)
        setLastSync(endTime)
      })

      syncWithServer()
      syncIntervalRef.current = setInterval(syncWithServer, 5000)

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current)
        }
      }
    }
  }, [socket])

  // Periodic sync for drift correction
  useEffect(() => {
    if (!currentGroup || !socket) return

    const requestSync = () => {
      socket.emit("request-sync", { groupId: currentGroup.id })
    }

    periodicSyncRef.current = setInterval(requestSync, 5000) // Sync every 5 seconds

    return () => {
      if (periodicSyncRef.current) {
        clearInterval(periodicSyncRef.current)
      }
    }
  }, [currentGroup, socket])

  // Auto-rejoin on mount
  useEffect(() => {
    if (socket && user?.userid && !hasAttemptedRejoinRef.current) {
      const session = getStoredSession()
      if (session?.groupId) {
        hasAttemptedRejoinRef.current = true
        rejoinGroup(session.groupId)
      }
    }
  }, [socket, user, getStoredSession, rejoinGroup])

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    // Sync state for drift correction and out-of-sync recovery
    socket.on("sync-state", async (data) => {
      const {
        playbackState,
        queue: serverQueue,
        currentQueueIndex: serverQueueIndex,
        currentSongId,
      } = data

      // Update queue state
      if (serverQueue) {
        setQueue(serverQueue)
        setCurrentQueueIndex(serverQueueIndex)
      }

      if (!playbackState) return

      // Check if we're playing the correct song (song ID verification)
      const serverTrack = playbackState.currentTrack
      const currentItem =
        serverQueueIndex >= 0 && serverQueue ? serverQueue[serverQueueIndex] : null

      // If server has no song playing, stop our playback
      if (!serverTrack) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause()
          setIsPlaying(false)
        }
        setCurrentSong(null)
        return
      }

      // If we're playing a different song or no song, load the correct one
      if (!currentSong || currentSong.id !== serverTrack.id) {
        console.log("Out of sync - loading correct song")
        setCurrentSong(serverTrack)
        const url = serverTrack.download_url?.find((u) => u.quality === "320kbps")?.link
        if (url && audioRef.current) {
          await loadAudio(url, currentItem?.id)
        }
      }

      if (!audioRef.current) return

      // Drift correction
      const serverNow = Date.now() + serverTimeOffset
      const timePassed = (serverNow - playbackState.lastUpdate) / 1000
      const expectedTime = playbackState.currentTime + (playbackState.isPlaying ? timePassed : 0)
      const actualTime = audioRef.current.currentTime
      const drift = Math.abs(expectedTime - actualTime)

      // Correct drift if more than 0.5 seconds
      if (drift > 0.5 && expectedTime <= (audioRef.current.duration || Infinity)) {
        audioRef.current.currentTime = expectedTime
        console.log(`Drift corrected: ${drift.toFixed(2)}s`)
      }

      // Sync play/pause state
      if (playbackState.isPlaying && audioRef.current.paused) {
        try {
          await audioRef.current.play()
          setIsPlaying(true)
        } catch (err) {
          console.error("Autoplay blocked:", err)
        }
      } else if (!playbackState.isPlaying && !audioRef.current.paused) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    })

    // Queue updates
    socket.on("queue-updated", (data) => {
      const { queue: serverQueue, currentQueueIndex: serverQueueIndex, action, item } = data
      setQueue(serverQueue)
      setCurrentQueueIndex(serverQueueIndex)

      if (action === "add" && item) {
        // Notification handled by toast in addToQueue
      } else if (action === "remove") {
        toast.info("Song removed from queue")
      } else if (action === "skip") {
        toast.info("Skipped to next song")
      }
    })

    socket.on("queue-error", ({ error }) => {
      toast.error(error)
    })

    socket.on("queue-ended", () => {
      setIsPlaying(false)
      toast.info("Queue ended")
    })

    // Playback updates
    socket.on("playback-update", (data) => {
      const serverNow = getServerTime()
      lastPlaybackUpdateRef.current = serverNow
      const { isPlaying: newIsPlaying, currentTime: newTime, scheduledTime } = data
      const timeUntilPlay = Math.max(0, scheduledTime - serverNow)

      if (audioRef.current) {
        audioRef.current.currentTime = newTime

        if (newIsPlaying) {
          setTimeout(() => {
            audioRef.current.play()
            setIsPlaying(true)
          }, timeUntilPlay)
        } else {
          audioRef.current.pause()
          setIsPlaying(false)
        }
      }

      setCurrentTime(newTime)
      setLastSync(serverNow)
    })

    socket.on("music-update", async ({ song, currentTime, queueItem, autoPlay }) => {
      setCurrentSong(song)
      const url = song.download_url.find((url) => url.quality === "320kbps")?.link

      if (url) {
        await loadAudio(url, queueItem?.id)

        if (audioRef.current) {
          audioRef.current.currentTime = currentTime
          if (autoPlay || isPlaying) {
            try {
              await audioRef.current.play()
              setIsPlaying(true)
            } catch (err) {
              console.error("Autoplay blocked:", err)
            }
          }
        }
      }

      if (queueItem?.addedBy) {
        toast.info(`Now playing: ${song.name} (added by ${queueItem.addedBy.userName})`)
      }
    })

    // Group events
    socket.on("group-created", (group) => {
      setCurrentGroup(group)
      setGroupMembers([
        {
          groupId: group.id,
          userId: user.userid,
          userName: user.name,
          profilePic: user.profilepic,
        },
      ])
      setQueue([])
      setCurrentQueueIndex(-1)
      saveSession(group.id)
      toast.success(`Created group: ${group.name}`)
    })

    socket.on("group-joined", async (data) => {
      const {
        group,
        members,
        playbackState,
        queue: serverQueue,
        currentQueueIndex: serverQueueIndex,
      } = data
      setCurrentGroup(group)
      setGroupMembers(members)
      setQueue(serverQueue || [])
      setCurrentQueueIndex(serverQueueIndex ?? -1)
      saveSession(group.id)

      if (playbackState?.currentTrack) {
        setCurrentSong(playbackState.currentTrack)
        const url =
          playbackState.currentTrack.download_url?.find((u) => u.quality === "320kbps")?.link ||
          playbackState.currentTrack.download_url?.[3]?.link

        if (url) {
          await loadAudio(url, serverQueue?.[serverQueueIndex]?.id)

          const serverNow = Date.now() + serverTimeOffset
          const timePassed = (serverNow - playbackState.lastUpdate) / 1000
          const syncedTime = playbackState.currentTime + (playbackState.isPlaying ? timePassed : 0)

          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(
              syncedTime,
              audioRef.current.duration || syncedTime,
            )

            if (playbackState.isPlaying) {
              try {
                await audioRef.current.play()
                setIsPlaying(true)
              } catch (err) {
                console.error("Autoplay blocked:", err)
              }
            }
          }
        }
      }

      toast.success(`Joined group: ${group.name}`)
    })

    socket.on("group-rejoined", async (data) => {
      const {
        group,
        members,
        playbackState,
        queue: serverQueue,
        currentQueueIndex: serverQueueIndex,
      } = data
      setCurrentGroup(group)
      setGroupMembers(members)
      setQueue(serverQueue || [])
      setCurrentQueueIndex(serverQueueIndex ?? -1)
      setIsRejoining(false)
      saveSession(group.id)

      if (playbackState?.currentTrack) {
        setCurrentSong(playbackState.currentTrack)
        const url =
          playbackState.currentTrack.download_url?.find((u) => u.quality === "320kbps")?.link ||
          playbackState.currentTrack.download_url?.[3]?.link

        if (url) {
          await loadAudio(url, serverQueue?.[serverQueueIndex]?.id)

          const serverNow = Date.now() + serverTimeOffset
          const timePassed = (serverNow - playbackState.lastUpdate) / 1000
          const syncedTime = playbackState.currentTime + (playbackState.isPlaying ? timePassed : 0)

          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(
              syncedTime,
              audioRef.current.duration || syncedTime,
            )

            if (playbackState.isPlaying) {
              try {
                await audioRef.current.play()
                setIsPlaying(true)
              } catch (err) {
                console.error("Autoplay blocked:", err)
                toast.info("Click play to resume music")
              }
            }
          }
        }
      }

      toast.success(`Rejoined group: ${group.name}`)
    })

    socket.on("group-not-found", () => {
      setIsRejoining(false)
      clearSession()
      toast.error("The group no longer exists")
    })

    socket.on("member-joined", (member) => {
      setGroupMembers((prev) => {
        if (prev.find((m) => m.userId === member.userId)) return prev
        return [...prev, member]
      })
      toast.info(`${member.userName} joined the group`)
    })

    socket.on("member-left", ({ userId }) => {
      if (userId) {
        setGroupMembers((prev) => {
          const member = prev.find((m) => m.userId === userId)
          if (member) {
            toast.info(`${member.userName} left the group`)
          }
          return prev.filter((member) => member.userId !== userId)
        })
      }
    })

    socket.on("group-disbanded", () => {
      setCurrentGroup(null)
      setCurrentSong(null)
      setIsPlaying(false)
      setMessages([])
      setGroupMembers([])
      setQueue([])
      setCurrentQueueIndex(-1)
      clearSession()
      toast.info("Group disbanded")
    })

    socket.on("new-message", (message) => {
      setMessages((prev) => [...prev, message])
    })

    return () => {
      socket.off("sync-state")
      socket.off("queue-updated")
      socket.off("queue-error")
      socket.off("queue-ended")
      socket.off("playback-update")
      socket.off("music-update")
      socket.off("group-created")
      socket.off("group-joined")
      socket.off("group-rejoined")
      socket.off("group-not-found")
      socket.off("member-joined")
      socket.off("member-left")
      socket.off("group-disbanded")
      socket.off("new-message")
    }
  }, [
    socket,
    isPlaying,
    serverTimeOffset,
    user,
    loadAudio,
    saveSession,
    clearSession,
    getServerTime,
  ])

  const contextValue = {
    // Group state
    currentGroup,
    setCurrentGroup,
    groupMembers,
    setGroupMembers,
    messages,
    setMessages,

    // Queue state
    queue,
    currentQueueIndex,
    currentQueueItem,
    upcomingQueue,
    playedQueue,
    isQueueOpen,
    setIsQueueOpen,

    // Playback state
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    currentSong,
    setCurrentSong,
    volume,
    setVolume,
    isLoading,
    setIsLoading,

    // Search state
    searchResults,
    setSearchResults,
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    isSearchLoading,
    setIsSearchLoading,

    // Sync state
    serverTimeOffset,
    setServerTimeOffset,
    lastSync,
    setLastSync,

    // UI state
    isGroupModalOpen,
    setIsGroupModalOpen,
    connectionState,
    isRejoining,
    audioRef,

    // Functions
    formatTime,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    debouncedSearch,

    // Queue functions
    addToQueue,
    playNow,
    removeFromQueue,
    skipSong,
    reorderQueue,

    // Group functions
    createGroup,
    joinGroup,
    rejoinGroup,
    leaveGroup,
    sendMessage,

    // Legacy alias
    selectSong: playNow,
  }

  return (
    <GroupMusicContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} />
    </GroupMusicContext.Provider>
  )
}

export const useGroupMusic = () => {
  const context = useContext(GroupMusicContext)
  if (!context) {
    throw new Error("useGroupMusic must be used within a GroupMusicProvider")
  }
  return context
}
