import { create } from "zustand"
import { ensureHttpsForDownloadUrls } from "@/Pages/Music/Common"
import { toast } from "sonner"
import axios from "axios"
import _ from "lodash"

const SESSION_KEY = "syncvibe_group_session"

export const useGroupSessionStore = create((set, get) => ({
  currentGroup: null,
  groupMembers: [],
  messages: [],

  queue: [],
  currentQueueIndex: -1,
  isQueueOpen: false,

  isGroupModalOpen: false,
  connectionState: "disconnected",
  isRejoining: false,
  upgradeDialog: { open: false, feature: "default", message: "" },
  floatingReactions: [],
  typingUsers: {},

  searchResults: [],
  searchQuery: "",
  isSearchOpen: false,
  isSearchLoading: false,

  getCurrentQueueItem: () => {
    const { queue, currentQueueIndex } = get()
    return currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null
  },

  getUpcomingQueue: () => {
    const { queue, currentQueueIndex } = get()
    return queue.filter((_, idx) => idx > currentQueueIndex)
  },

  getPlayedQueue: () => {
    const { queue, currentQueueIndex } = get()
    return queue.filter((_, idx) => idx < currentQueueIndex)
  },

  saveSession: (groupId) => {
    if (groupId) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ groupId, lastUpdate: Date.now() }))
    }
  },

  clearSession: () => {
    sessionStorage.removeItem(SESSION_KEY)
  },

  getStoredSession: () => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (e) {
      console.error("Error reading session:", e)
      return null
    }
  },

  createGroup: (socket, user, groupName) => {
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
    set({ isGroupModalOpen: false })
  },

  joinGroup: (socket, user, groupId) => {
    if (!groupId.trim()) return
    socket.emit("join-music-group", {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    })
    set({ isGroupModalOpen: false })
  },

  rejoinGroup: (socket, user, groupId) => {
    if (!groupId || !user?.userid || !socket) return
    set({ isRejoining: true })
    socket.emit("rejoin-music-group", {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    })
  },

  leaveGroup: (socket, user, resetPlayback) => {
    const { currentGroup, clearSession } = get()
    if (!currentGroup) return

    socket.emit("leave-group", {
      groupId: currentGroup.id,
      userId: user.userid,
    })

    resetPlayback()

    set({
      currentGroup: null,
      currentSong: null,
      messages: [],
      groupMembers: [],
      queue: [],
      currentQueueIndex: -1,
    })
    clearSession()
    toast.info(`Left group ${currentGroup.name}`)
  },

  sendMessage: (socket, user, message) => {
    if (!message.trim()) return
    const { currentGroup } = get()
    socket.emit("chat-message", {
      groupId: currentGroup?.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      message,
    })
  },

  addToQueue: (socket, user, song) => {
    const { currentGroup, queue } = get()
    if (!currentGroup?.id || !user) return

    const maxQueueSize = currentGroup?.settings?.maxQueueSize || 3
    if (queue.length >= maxQueueSize) {
      set({
        upgradeDialog: {
          open: true,
          feature: "queueLimit",
          message: `Free plan allows only ${maxQueueSize} songs in queue. Upgrade to PRO for up to 50.`,
        },
      })
      return
    }

    if (queue.some((item) => item.song?.id === song?.id)) {
      toast.info("Song is already in the queue")
      return
    }

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

    set({ isSearchOpen: false, searchQuery: "", searchResults: [] })
    toast.success("Added to queue")
  },

  playNow: (socket, user, song) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return

    const securedSong = ensureHttpsForDownloadUrls(song)
    socket.emit("music-change", {
      groupId: currentGroup.id,
      song: securedSong,
      currentTime: 0,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })

    set({ isSearchOpen: false, searchQuery: "", searchResults: [] })
  },

  playNext: (socket, user, song) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return

    const securedSong = ensureHttpsForDownloadUrls(song)
    socket.emit("play-next", {
      groupId: currentGroup.id,
      song: securedSong,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })

    set({ isSearchOpen: false, searchQuery: "", searchResults: [] })
    toast.success("Playing next")
  },

  addPlaylistToQueue: (socket, user, songs) => {
    const { currentGroup, queue } = get()
    if (!currentGroup?.id || !user || !songs?.length) return

    const maxQueueSize = currentGroup?.settings?.maxQueueSize || 3
    if (queue.length >= maxQueueSize) {
      set({
        upgradeDialog: {
          open: true,
          feature: "queueLimit",
          message: `Free plan allows only ${maxQueueSize} songs in queue. Upgrade to PRO for up to 50.`,
        },
      })
      return
    }

    const securedSongs = songs.map(ensureHttpsForDownloadUrls)
    socket.emit("add-playlist-to-queue", {
      groupId: currentGroup.id,
      songs: securedSongs,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })

    toast.success(`Adding ${songs.length} songs to queue`)
  },

  removeFromQueue: (socket, user, queueItemId) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return
    socket.emit("remove-from-queue", {
      groupId: currentGroup.id,
      queueItemId,
      userId: user.userid,
    })
  },

  skipSong: (socket, user) => {
    const { currentGroup } = get()
    if (!currentGroup?.id) return
    socket.emit("skip-song", { groupId: currentGroup.id, userName: user?.name })
  },

  reorderQueue: (socket, fromIndex, toIndex) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || fromIndex === toIndex) return
    socket.emit("reorder-queue", {
      groupId: currentGroup.id,
      fromIndex,
      toIndex,
    })
  },

  debouncedSearch: _.debounce(async (query) => {
    if (!query.trim()) {
      useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
      return
    }
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/search/songs?q=${query}`)
      useGroupSessionStore.setState({ searchResults: response.data?.data?.results || [] })
    } catch {
      toast.error("Search failed. Please try again.")
    } finally {
      useGroupSessionStore.setState({ isSearchLoading: false })
    }
  }, 400),

  handleGroupCreated: (group, user, setInviteSheetOpen) => {
    const { saveSession } = get()
    set({
      currentGroup: group,
      groupMembers: [
        {
          groupId: group.id,
          userId: user.userid,
          userName: user.name,
          profilePic: user.profilepic,
        },
      ],
      queue: [],
      currentQueueIndex: -1,
    })
    saveSession(group.id)
    toast.success(`Created group: ${group.name}`)
    setInviteSheetOpen(true)
  },

  handleGroupJoined: (data) => {
    const { group, members, queue: serverQueue, currentQueueIndex: serverQueueIndex } = data
    const { saveSession } = get()
    set({
      currentGroup: group,
      groupMembers: members,
      queue: serverQueue || [],
      currentQueueIndex: serverQueueIndex ?? -1,
    })
    saveSession(group.id)
    toast.success(`Joined group: ${group.name}`)
  },

  handleGroupRejoined: (data) => {
    const { group, members, queue: serverQueue, currentQueueIndex: serverQueueIndex } = data
    const { saveSession } = get()
    set({
      currentGroup: group,
      groupMembers: members,
      queue: serverQueue || [],
      currentQueueIndex: serverQueueIndex ?? -1,
      isRejoining: false,
    })
    saveSession(group.id)
    toast.success(`Rejoined group: ${group.name}`)
  },

  resetSession: (resetPlayback) => {
    const { clearSession } = get()
    resetPlayback()
    set({
      currentGroup: null,
      messages: [],
      groupMembers: [],
      queue: [],
      currentQueueIndex: -1,
    })
    clearSession()
  },
}))
