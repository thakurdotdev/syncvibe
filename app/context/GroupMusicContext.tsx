import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
} from "react"
import { Alert } from "react-native"
import TrackPlayer, { Event, PlaybackState } from "@rntp/player"
import { Song } from "@/types/song"
import { useChat } from "./SocketContext"
import { useUser } from "./UserContext"
import { useGroupPlaybackStore } from "@/stores/groupMusic/groupPlaybackStore"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { useGroupInviteStore } from "@/stores/groupMusic/groupInviteStore"
import { usePlayerStore } from "@/stores/playerStore"
import { runAfterIdle } from "@/utils/runAfterIdle"

interface GroupMusicContextType {
  socket: any
  user: any

  handlePlayPause: (forceState?: boolean) => Promise<void>
  handleSeek: (value: number) => Promise<void>
  createGroup: (groupName: string) => void
  joinGroup: (groupId: string) => void
  leaveGroup: () => void
  sendMessage: (message: string, messageType?: string) => void
  addToQueue: (song: Song) => void
  playNow: (song: Song) => void
  playNext: (song: Song) => void
  skipSong: () => void
  removeFromQueue: (queueItemId: string) => void
  reorderQueue: (fromIndex: number, toIndex: number) => void
  addPlaylistToQueue: (songs: Song[]) => void
  sendReaction: (emoji: string) => void
  startTyping: () => void
  stopTyping: () => void
  sendInvite: (inviteeUserId: number) => void
  acceptInvite: () => void
  declineInvite: () => void
}

const GroupMusicContext = createContext<GroupMusicContextType | null>(null)

export function GroupMusicProvider({ children }: { children: ReactNode }) {
  const { socket } = useChat()
  const { user } = useUser()
  const syncIntervalRef = useRef<any>(null)
  const hasAttemptedRejoin = useRef(false)

  const pb = useGroupPlaybackStore
  const ss = useGroupSessionStore
  const inv = useGroupInviteStore

  // --- TrackPlayer lifecycle ---
  useEffect(() => {
    let cancelled = false
    const task = runAfterIdle(() => {
      if (!cancelled) void pb.getState().initTrackPlayer()
    })

    return () => {
      cancelled = true
      task.cancel()
      pb.getState().reset()
    }
  }, [])

  useEffect(() => {
    const { isPlaying } = pb.getState()
    if (isPlaying) {
      pb.getState().startProgressPolling()
    } else {
      pb.getState().stopProgressPolling()
    }
  }, [pb((s) => s.isPlaying)])

  // --- TrackPlayer event listeners ---
  useEffect(() => {
    const subIsPlaying = TrackPlayer.addEventListener(Event.IsPlayingChanged, ({ playing }) => {
      try {
        const activePlayerMode = usePlayerStore.getState().activePlayerMode
        if (activePlayerMode !== "group") return

        pb.setState({ isPlaying: playing })
        if (playing) {
          pb.getState().startProgressPolling()
        } else {
          pb.getState().stopProgressPolling()
        }
      } catch (error) {
        console.error("Error handling IsPlayingChanged event:", error)
      }
    })

    const subPlaybackState = TrackPlayer.addEventListener(
      Event.PlaybackStateChanged,
      ({ state }) => {
        try {
          const activePlayerMode = usePlayerStore.getState().activePlayerMode
          if (activePlayerMode !== "group") return

          if (state === PlaybackState.Ended) {
            const groupId = ss.getState().currentGroup?.id
            const currentItem = ss.getState().getCurrentQueueItem()

            if (groupId && currentItem) {
              socket?.emit("song-ended", {
                groupId,
                songId: currentItem.id,
              })
            }

            pb.setState({ isPlaying: false })
            pb.getState().stopProgressPolling()
          }
        } catch (error) {
          console.error("Error handling PlaybackStateChanged event:", error)
        }
      },
    )

    const subPlaybackError = TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
      try {
        const activePlayerMode = usePlayerStore.getState().activePlayerMode
        if (activePlayerMode !== "group") return

        console.error("Playback error:", event.message)
        Alert.alert("Playback Error", "An error occurred during playback.")
        pb.setState({ isPlaying: false })
        pb.getState().stopProgressPolling()
      } catch (error) {
        console.error("Error handling PlaybackError event:", error)
      }
    })

    return () => {
      subIsPlaying.remove()
      subPlaybackState.remove()
      subPlaybackError.remove()
    }
  }, [socket])

  // --- Time sync ---
  useEffect(() => {
    if (!socket) return

    const syncWithServer = () => {
      socket.emit("time-sync-request", { clientTime: Date.now() })
    }

    socket.on("time-sync-response", (data: { clientTime: number; serverTime: number }) => {
      pb.getState().processTimeSyncResponse(data.clientTime, data.serverTime)
    })

    syncWithServer()
    syncIntervalRef.current = setInterval(syncWithServer, 5000)

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
      socket.off("time-sync-response")
    }
  }, [socket])

  // --- Session rejoin on socket connect ---
  useEffect(() => {
    if (!socket || !user || hasAttemptedRejoin.current) return

    const handleSetupComplete = async () => {
      if (ss.getState().currentGroup) return

      const stored = await ss.getState().getStoredSession()
      if (stored?.groupId) {
        hasAttemptedRejoin.current = true
        ss.getState().rejoinGroup(socket, user, stored.groupId)
      }
    }

    socket.on("setup-complete", handleSetupComplete)
    // Also try immediately if socket is already connected
    if (socket.connected) {
      handleSetupComplete()
    }

    return () => {
      socket.off("setup-complete", handleSetupComplete)
    }
  }, [socket, user])

  // --- All group socket events ---
  useEffect(() => {
    if (!socket) return

    socket.on("playback-update", async (data: any) => {
      await pb.getState().handlePlaybackUpdate(data)
    })

    socket.on("music-update", async (data: any) => {
      await pb.getState().handleMusicUpdate(data)
    })

    socket.on("queue-updated", (data: any) => {
      const { queue, currentQueueIndex } = data
      ss.setState({ queue, currentQueueIndex })
    })

    socket.on("queue-error", ({ error }: { error: string }) => {
      Alert.alert("Queue Error", error)
    })

    socket.on("queue-ended", () => {
      pb.setState({ isPlaying: false })
      pb.getState().stopProgressPolling()
    })

    socket.on("sync-state", async (data: any) => {
      if (data.queue) {
        ss.setState({ queue: data.queue, currentQueueIndex: data.currentQueueIndex })
      }
      if (data.playbackState?.currentTrack) {
        await pb.getState().handleMusicUpdate({
          song: data.playbackState.currentTrack,
          currentTime: data.playbackState.currentTime,
          serverTime: data.playbackState.serverTime,
        })
      }
    })

    socket.on("group-created", (group: any) => {
      if (!user) return
      ss.getState().handleGroupCreated(group, user, () => {
        inv.setState({ isInviteSheetOpen: true })
      })
    })

    socket.on("group-joined", async (data: any) => {
      ss.getState().handleGroupJoined(data)
      if (data.playbackState) {
        await pb
          .getState()
          .syncPlaybackFromServer(
            data.playbackState,
            data.queue || [],
            data.currentQueueIndex ?? -1,
          )
      }
    })

    socket.on("group-rejoined", async (data: any) => {
      ss.getState().handleGroupRejoined(data)
      if (data.playbackState) {
        await pb
          .getState()
          .syncPlaybackFromServer(
            data.playbackState,
            data.queue || [],
            data.currentQueueIndex ?? -1,
          )
      }
    })

    socket.on("group-not-found", () => {
      ss.setState({ isRejoining: false })
      ss.getState().clearSession()
      Alert.alert("Group Not Found", "The group no longer exists.")
    })

    socket.on("group-full", () => {
      Alert.alert("Group Full", "This group has reached its member limit.")
    })

    socket.on("feature-locked", ({ message }: { message: string }) => {
      Alert.alert("Feature Locked", message)
    })

    socket.on("member-joined", (member: any) => {
      ss.setState((state) => {
        if (state.groupMembers.find((m) => m.userId === member.userId)) return state
        return { groupMembers: [...state.groupMembers, member] }
      })
    })

    socket.on("member-left", ({ userId }: { userId: number }) => {
      if (!userId) return
      ss.setState((state) => ({
        groupMembers: state.groupMembers.filter((m) => m.userId !== userId),
      }))
    })

    socket.on("group-disbanded", () => {
      ss.getState().resetSession(() => pb.getState().reset())
      Alert.alert("Info", "Group disbanded")
    })

    socket.on("new-message", (message: any) => {
      ss.setState((state) => ({ messages: [...state.messages, message] }))
    })

    socket.on("song-reaction", (data: { emoji: string; userName: string }) => {
      const reactionId = `${Date.now()}-${Math.random()}`
      ss.setState((state) => ({
        floatingReactions: [
          ...state.floatingReactions,
          { id: reactionId, emoji: data.emoji, userName: data.userName },
        ],
      }))
      setTimeout(() => {
        ss.setState((state) => ({
          floatingReactions: state.floatingReactions.filter((r) => r.id !== reactionId),
        }))
      }, 3000)
    })

    socket.on("user-typing", (data: { userId: string; userName: string; isTyping: boolean }) => {
      ss.setState((state) => {
        const updated = { ...state.typingUsers }
        if (data.isTyping) {
          updated[data.userId] = data.userName
        } else {
          delete updated[data.userId]
        }
        return { typingUsers: updated }
      })
    })

    // Invite events
    socket.on(
      "group-invite-received",
      (data: {
        groupId: string
        groupName: string
        inviterName: string
        inviterPic: string
        inviterId: number
      }) => {
        inv.setState({ pendingInvite: data })
      },
    )

    socket.on("invite-sent", () => {
      Alert.alert("Invite Sent", "Your invite has been sent.")
    })

    socket.on("invite-error", ({ message }: { message: string }) => {
      Alert.alert("Invite Error", message)
    })

    socket.on("invite-accepted", ({ userName }: { userName: string }) => {
      Alert.alert("Invite Accepted", `${userName} has joined the group!`)
    })

    socket.on("group-invite-declined", ({ userName }: { userName: string }) => {
      Alert.alert("Invite Declined", `${userName} declined the invite.`)
    })

    return () => {
      const events = [
        "playback-update",
        "music-update",
        "queue-updated",
        "queue-error",
        "queue-ended",
        "sync-state",
        "group-created",
        "group-joined",
        "group-rejoined",
        "group-not-found",
        "group-full",
        "feature-locked",
        "member-joined",
        "member-left",
        "group-disbanded",
        "new-message",
        "song-reaction",
        "user-typing",
        "group-invite-received",
        "invite-sent",
        "invite-error",
        "invite-accepted",
        "group-invite-declined",
      ]
      events.forEach((e) => socket.off(e))
    }
  }, [socket, user])

  const groupId = ss((s) => s.currentGroup?.id)

  // --- Wrapped actions ---
  const handlePlayPause = useCallback(
    (forceState?: boolean) => pb.getState().handlePlayPause(socket, groupId, forceState),
    [socket, groupId],
  )

  const handleSeek = useCallback(
    (value: number) => pb.getState().handleSeek(socket, groupId, value),
    [socket, groupId],
  )

  const createGroup = useCallback(
    (groupName: string) => ss.getState().createGroup(socket, user, groupName),
    [socket, user],
  )

  const joinGroup = useCallback(
    (groupId: string) => ss.getState().joinGroup(socket, user, groupId),
    [socket, user],
  )

  const leaveGroup = useCallback(
    () => ss.getState().leaveGroup(socket, user, () => pb.getState().reset()),
    [socket, user],
  )

  const sendMessage = useCallback(
    (message: string, messageType?: string) =>
      ss.getState().sendMessage(socket, user, message, messageType),
    [socket, user],
  )

  const addToQueue = useCallback(
    (song: Song) => ss.getState().addToQueue(socket, user, song),
    [socket, user],
  )

  const playNow = useCallback(
    (song: Song) => ss.getState().playNow(socket, user, song),
    [socket, user],
  )

  const playNext = useCallback(
    (song: Song) => ss.getState().playNext(socket, user, song),
    [socket, user],
  )

  const skipSong = useCallback(() => ss.getState().skipSong(socket, user), [socket, user])

  const removeFromQueue = useCallback(
    (queueItemId: string) => ss.getState().removeFromQueue(socket, user, queueItemId),
    [socket, user],
  )

  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) =>
      ss.getState().reorderQueue(socket, fromIndex, toIndex),
    [socket],
  )

  const addPlaylistToQueue = useCallback(
    (songs: Song[]) => ss.getState().addPlaylistToQueue(socket, user, songs),
    [socket, user],
  )

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!groupId || !user) return
      socket?.emit("song-reaction", {
        groupId,
        emoji,
        userId: user.userid,
        userName: user.name,
      })
    },
    [socket, groupId, user],
  )

  const startTyping = useCallback(() => {
    if (!groupId || !user) return
    socket?.emit("typing-start", { groupId, userId: user.userid, userName: user.name })
  }, [socket, groupId, user])

  const stopTyping = useCallback(() => {
    if (!groupId || !user) return
    socket?.emit("typing-stop", { groupId, userId: user.userid })
  }, [socket, groupId, user])

  const sendInvite = useCallback(
    (inviteeUserId: number) => {
      const currentGroup = ss.getState().currentGroup
      inv.getState().sendInvite(socket, user, currentGroup, inviteeUserId)
    },
    [socket, user],
  )

  const acceptInvite = useCallback(() => {
    const invite = inv.getState().pendingInvite
    if (invite) {
      inv.getState().acceptInvite(socket, user, invite)
    }
  }, [socket, user])

  const declineInvite = useCallback(() => {
    const invite = inv.getState().pendingInvite
    if (invite) {
      inv.getState().declineInvite(socket, invite)
    }
  }, [socket])

  const contextValue = useMemo<GroupMusicContextType>(
    () => ({
      socket,
      user,
      handlePlayPause,
      handleSeek,
      createGroup,
      joinGroup,
      leaveGroup,
      sendMessage,
      addToQueue,
      playNow,
      playNext,
      skipSong,
      removeFromQueue,
      reorderQueue,
      addPlaylistToQueue,
      sendReaction,
      startTyping,
      stopTyping,
      sendInvite,
      acceptInvite,
      declineInvite,
    }),
    [
      socket,
      user,
      handlePlayPause,
      handleSeek,
      createGroup,
      joinGroup,
      leaveGroup,
      sendMessage,
      addToQueue,
      playNow,
      playNext,
      skipSong,
      removeFromQueue,
      reorderQueue,
      addPlaylistToQueue,
      sendReaction,
      startTyping,
      stopTyping,
      sendInvite,
      acceptInvite,
      declineInvite,
    ],
  )

  return <GroupMusicContext.Provider value={contextValue}>{children}</GroupMusicContext.Provider>
}

export const useGroupMusic = () => {
  const context = useContext(GroupMusicContext)
  if (!context) {
    throw new Error("useGroupMusic must be used within a GroupMusicProvider")
  }
  return context
}
