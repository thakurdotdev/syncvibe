import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useSocket } from "@/Context/ChatContext"
import { useProfile } from "@/Context/Context"
import InviteNotification from "@/components/InviteNotification"
import UpgradeDialog from "@/components/UpgradeDialog"
import { useGroupInviteStore } from "@/stores/groupMusic/inviteStore"
import { useGroupPlaybackStore } from "@/stores/groupMusic/playbackStore"
import { useGroupSessionStore } from "@/stores/groupMusic/sessionStore"

export const GroupMusicContext = createContext(null)

export function GroupMusicProvider({ children }) {
  const { socket } = useSocket()
  const { user } = useProfile()
  const navigate = useNavigate()

  const audioRef = useRef(null)
  const syncIntervalRef = useRef(null)
  const periodicSyncRef = useRef(null)
  const hasAttemptedRejoinRef = useRef(false)

  const playback = useGroupPlaybackStore()
  const session = useGroupSessionStore()
  const invite = useGroupInviteStore()

  useEffect(() => {
    if (audioRef.current) {
      useGroupPlaybackStore.getState().setAudioRef(audioRef.current)
    }
  }, [])

  useEffect(() => {
    if (playback.currentSong) {
      playback.updateMediaSession(
        playback.currentSong,
        (force) => playback.handlePlayPause(socket, session.currentGroup?.id, force),
        () => session.skipSong(socket, user),
      )
    }
  }, [playback.currentSong])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (useGroupSessionStore.getState().currentGroup) {
        e.preventDefault()
        e.returnValue = "You are in a music group. Your session will be restored when you return."
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  useEffect(() => {
    if (!socket) return

    const syncWithServer = () => {
      const startTime = Date.now()
      socket.emit("time-sync-request", { clientTime: startTime })
    }

    socket.on("time-sync-response", (data) => {
      const endTime = Date.now()
      const roundTripTime = endTime - data.clientTime
      const serverTime = data.serverTime + roundTripTime / 2
      useGroupPlaybackStore.setState({
        serverTimeOffset: serverTime - endTime,
        lastSync: endTime,
      })
    })

    syncWithServer()
    syncIntervalRef.current = setInterval(syncWithServer, 5000)

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [socket])

  useEffect(() => {
    const currentGroup = useGroupSessionStore.getState().currentGroup
    if (!currentGroup || !socket) return

    const requestSync = () => {
      socket.emit("request-sync", { groupId: currentGroup.id })
    }

    periodicSyncRef.current = setInterval(requestSync, 10000)
    return () => {
      if (periodicSyncRef.current) clearInterval(periodicSyncRef.current)
    }
  }, [session.currentGroup, socket])

  useEffect(() => {
    if (!socket || !user?.userid) return

    const handleSetupComplete = () => {
      if (!hasAttemptedRejoinRef.current) {
        const stored = useGroupSessionStore.getState().getStoredSession()
        if (stored?.groupId) {
          hasAttemptedRejoinRef.current = true
          useGroupSessionStore.getState().rejoinGroup(socket, user, stored.groupId)
        }
      }
      socket.emit("get-pending-invites")
    }

    socket.on("setup-complete", handleSetupComplete)
    return () => socket.off("setup-complete", handleSetupComplete)
  }, [socket, user])

  useEffect(() => {
    if (!socket) return

    const getGroupId = () => useGroupSessionStore.getState().currentGroup?.id
    const pb = useGroupPlaybackStore
    const ss = useGroupSessionStore
    const inv = useGroupInviteStore

    socket.on("sync-state", async (data) => {
      if (data.queue) {
        ss.setState({ queue: data.queue, currentQueueIndex: data.currentQueueIndex })
      }
      await pb.getState().handleSyncState(data, socket, getGroupId())
    })

    socket.on("queue-updated", (data) => {
      const { queue, currentQueueIndex, action, item } = data
      ss.setState({ queue, currentQueueIndex })

      if (action === "remove") toast.info("Song removed from queue")
      else if (action === "skip") toast.info("Skipped to next song")
    })

    socket.on("queue-error", ({ error }) => toast.error(error))

    socket.on("queue-ended", () => {
      pb.setState({ isPlaying: false })
      toast.info("Queue ended")
    })

    socket.on("playback-update", (data) => {
      pb.getState().handlePlaybackUpdate(data)
    })

    socket.on("music-update", async (data) => {
      await pb.getState().handleMusicUpdate(data, socket, getGroupId())
    })

    socket.on("group-created", (group) => {
      ss.getState().handleGroupCreated(group, user, (v) => inv.setState({ isInviteSheetOpen: v }))
    })

    socket.on("group-joined", async (data) => {
      ss.getState().handleGroupJoined(data)
      const offset = pb.getState().serverTimeOffset
      await pb.getState().syncPlaybackFromServer(
        data.playbackState, data.queue, data.currentQueueIndex, socket, data.group.id, offset,
      )
    })

    socket.on("group-rejoined", async (data) => {
      ss.getState().handleGroupRejoined(data)
      const offset = pb.getState().serverTimeOffset
      await pb.getState().syncPlaybackFromServer(
        data.playbackState, data.queue, data.currentQueueIndex, socket, data.group.id, offset,
      )
    })

    socket.on("group-not-found", () => {
      ss.setState({ isRejoining: false })
      ss.getState().clearSession()
      toast.error("The group no longer exists")
    })

    socket.on("member-joined", (member) => {
      ss.setState((state) => {
        if (state.groupMembers.find((m) => m.userId === member.userId)) return state
        return { groupMembers: [...state.groupMembers, member] }
      })
      toast.info(`${member.userName} joined the group`)
    })

    socket.on("member-left", ({ userId }) => {
      if (!userId) return
      const members = ss.getState().groupMembers
      const member = members.find((m) => m.userId === userId)
      if (member) toast.info(`${member.userName} left the group`)
      ss.setState({ groupMembers: members.filter((m) => m.userId !== userId) })
    })

    socket.on("group-disbanded", () => {
      ss.getState().resetSession(() => pb.getState().reset())
      toast.info("Group disbanded")
    })

    socket.on("new-message", (message) => {
      ss.setState((state) => ({ messages: [...state.messages, message] }))
    })

    socket.on("group-full", ({ maxMembers, message }) => {
      ss.setState({
        upgradeDialog: {
          open: true,
          feature: "groupMembers",
          message: message || `Group is full (${maxMembers} members max)`,
        },
      })
    })

    socket.on("feature-locked", ({ feature, message }) => {
      ss.setState({
        upgradeDialog: {
          open: true,
          feature: feature || "default",
          message: message || "This feature requires PRO plan",
        },
      })
    })

    socket.on("group-invite-received", (inviteData) => {
      if (ss.getState().currentGroup) return
      inv.setState({ pendingInvite: inviteData })
    })

    socket.on("invite-sent", () => toast.success("Invite sent!"))
    socket.on("invite-error", ({ error }) => toast.error(error))
    socket.on("invite-accepted", ({ userName }) => toast.success(`${userName} accepted the invite!`))
    socket.on("group-invite-declined", () => toast.info("Invite was declined"))

    socket.on("song-reaction", (data) => {
      ss.setState((state) => ({
        floatingReactions: [...state.floatingReactions.slice(-20), data],
      }))
    })

    return () => {
      const events = [
        "sync-state", "queue-updated", "queue-error", "queue-ended",
        "playback-update", "music-update", "group-created", "group-joined",
        "group-rejoined", "group-not-found", "member-joined", "member-left",
        "group-disbanded", "new-message", "group-full", "feature-locked",
        "group-invite-received", "invite-sent", "invite-error",
        "invite-accepted", "group-invite-declined", "song-reaction",
      ]
      events.forEach((e) => socket.off(e))
    }
  }, [socket, user])

  const currentQueueItem = useMemo(() => session.getCurrentQueueItem(), [session.queue, session.currentQueueIndex])
  const upcomingQueue = useMemo(() => session.getUpcomingQueue(), [session.queue, session.currentQueueIndex])
  const playedQueue = useMemo(() => session.getPlayedQueue(), [session.queue, session.currentQueueIndex])

  const wrappedHandlePlayPause = useCallback(
    (forceState) => playback.handlePlayPause(socket, session.currentGroup?.id, forceState),
    [socket, session.currentGroup?.id],
  )

  const wrappedHandleSeek = useCallback(
    (value) => playback.handleSeek(socket, session.currentGroup?.id, value),
    [socket, session.currentGroup?.id],
  )

  const wrappedCreateGroup = useCallback(
    (name) => session.createGroup(socket, user, name),
    [socket, user],
  )

  const wrappedJoinGroup = useCallback(
    (groupId) => session.joinGroup(socket, user, groupId),
    [socket, user],
  )

  const wrappedRejoinGroup = useCallback(
    (groupId) => session.rejoinGroup(socket, user, groupId),
    [socket, user],
  )

  const wrappedLeaveGroup = useCallback(
    () => session.leaveGroup(socket, user, () => useGroupPlaybackStore.getState().reset()),
    [socket, user],
  )

  const wrappedSendMessage = useCallback(
    (msg) => session.sendMessage(socket, user, msg),
    [socket, user],
  )

  const wrappedAddToQueue = useCallback(
    (song) => session.addToQueue(socket, user, song),
    [socket, user],
  )

  const wrappedPlayNow = useCallback(
    (song) => session.playNow(socket, user, song),
    [socket, user],
  )

  const wrappedPlayNext = useCallback(
    (song) => session.playNext(socket, user, song),
    [socket, user],
  )

  const wrappedRemoveFromQueue = useCallback(
    (id) => session.removeFromQueue(socket, user, id),
    [socket, user],
  )

  const wrappedSkipSong = useCallback(
    () => session.skipSong(socket, user),
    [socket, user],
  )

  const wrappedReorderQueue = useCallback(
    (from, to) => session.reorderQueue(socket, from, to),
    [socket],
  )

  const wrappedAddPlaylistToQueue = useCallback(
    (songs) => session.addPlaylistToQueue(socket, user, songs),
    [socket, user],
  )

  const wrappedAcceptInvite = useCallback(
    (inv) => invite.acceptInvite(socket, user, inv, navigate),
    [socket, user, navigate],
  )

  const wrappedDeclineInvite = useCallback(
    (inv) => invite.declineInvite(socket, inv),
    [socket],
  )

  const wrappedSendInvite = useCallback(
    (userId) => invite.sendInvite(socket, user, session.currentGroup, userId),
    [socket, user, session.currentGroup],
  )

  const wrappedSendReaction = useCallback(
    (emoji) => {
      if (!socket || !session.currentGroup?.id || !user) return
      const reactionData = {
        groupId: session.currentGroup.id,
        emoji,
        userName: user.name,
      }
      socket.emit("song-reaction", reactionData)
      useGroupSessionStore.setState((state) => ({
        floatingReactions: [...state.floatingReactions.slice(-20), {
          ...reactionData,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        }],
      }))
    },
    [socket, session.currentGroup?.id, user],
  )

  const contextValue = {
    currentGroup: session.currentGroup,
    setCurrentGroup: (v) => useGroupSessionStore.setState({ currentGroup: v }),
    groupMembers: session.groupMembers,
    setGroupMembers: (v) => useGroupSessionStore.setState({ groupMembers: v }),
    messages: session.messages,
    setMessages: (v) => useGroupSessionStore.setState({ messages: v }),

    queue: session.queue,
    currentQueueIndex: session.currentQueueIndex,
    currentQueueItem,
    upcomingQueue,
    playedQueue,
    isQueueOpen: session.isQueueOpen,
    setIsQueueOpen: (v) => useGroupSessionStore.setState({ isQueueOpen: v }),

    isPlaying: playback.isPlaying,
    setIsPlaying: (v) => useGroupPlaybackStore.setState({ isPlaying: v }),
    currentTime: playback.currentTime,
    setCurrentTime: (v) => useGroupPlaybackStore.setState({ currentTime: v }),
    duration: playback.duration,
    setDuration: (v) => useGroupPlaybackStore.setState({ duration: v }),
    currentSong: playback.currentSong,
    setCurrentSong: (v) => useGroupPlaybackStore.setState({ currentSong: v }),
    volume: playback.volume,
    setVolume: (v) => useGroupPlaybackStore.setState({ volume: v }),
    isLoading: playback.isLoading,
    setIsLoading: (v) => useGroupPlaybackStore.setState({ isLoading: v }),
    isSyncing: playback.isSyncing,
    syncCountdown: playback.syncCountdown,

    searchResults: session.searchResults,
    setSearchResults: (v) => useGroupSessionStore.setState({ searchResults: v }),
    searchQuery: session.searchQuery,
    setSearchQuery: (v) => useGroupSessionStore.setState({ searchQuery: v }),
    isSearchOpen: session.isSearchOpen,
    setIsSearchOpen: (v) => useGroupSessionStore.setState({ isSearchOpen: v }),
    isSearchLoading: session.isSearchLoading,
    setIsSearchLoading: (v) => useGroupSessionStore.setState({ isSearchLoading: v }),

    serverTimeOffset: playback.serverTimeOffset,
    setServerTimeOffset: (v) => useGroupPlaybackStore.setState({ serverTimeOffset: v }),
    lastSync: playback.lastSync,
    setLastSync: (v) => useGroupPlaybackStore.setState({ lastSync: v }),

    isGroupModalOpen: session.isGroupModalOpen,
    setIsGroupModalOpen: (v) => useGroupSessionStore.setState({ isGroupModalOpen: v }),
    connectionState: session.connectionState,
    isRejoining: session.isRejoining,
    audioRef,

    formatTime: playback.formatTime,
    handlePlayPause: wrappedHandlePlayPause,
    handleSeek: wrappedHandleSeek,
    handleVolumeChange: playback.handleVolumeChange,
    debouncedSearch: session.debouncedSearch,

    addToQueue: wrappedAddToQueue,
    playNow: wrappedPlayNow,
    playNext: wrappedPlayNext,
    removeFromQueue: wrappedRemoveFromQueue,
    skipSong: wrappedSkipSong,
    reorderQueue: wrappedReorderQueue,
    addPlaylistToQueue: wrappedAddPlaylistToQueue,

    createGroup: wrappedCreateGroup,
    joinGroup: wrappedJoinGroup,
    rejoinGroup: wrappedRejoinGroup,
    leaveGroup: wrappedLeaveGroup,
    sendMessage: wrappedSendMessage,

    pendingInvite: invite.pendingInvite,
    setPendingInvite: (v) => useGroupInviteStore.setState({ pendingInvite: v }),
    acceptInvite: wrappedAcceptInvite,
    declineInvite: wrappedDeclineInvite,
    sendInvite: wrappedSendInvite,
    isInviteSheetOpen: invite.isInviteSheetOpen,
    setIsInviteSheetOpen: (v) => useGroupInviteStore.setState({ isInviteSheetOpen: v }),

    selectSong: wrappedPlayNow,
    sendReaction: wrappedSendReaction,
  }

  return (
    <GroupMusicContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} />
      <UpgradeDialog
        open={session.upgradeDialog.open}
        onOpenChange={(open) =>
          useGroupSessionStore.setState((s) => ({ upgradeDialog: { ...s.upgradeDialog, open } }))
        }
        feature={session.upgradeDialog.feature}
        customMessage={session.upgradeDialog.message}
      />
      <InviteNotification
        invite={invite.pendingInvite}
        onAccept={wrappedAcceptInvite}
        onDecline={wrappedDeclineInvite}
      />
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
