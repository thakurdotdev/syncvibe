import { create } from "zustand"
import { useShallow } from "zustand/react/shallow"
import { Alert } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Song } from "@/types/song"
import { searchSongs } from "@/utils/api/getSongs"
import { ensureHttpsForSongUrls } from "@/utils/getHttpsUrls"
import { Group, GroupMember, Message, QueueItem } from "./types"

interface GroupSessionState {
  currentGroup: Group | null
  groupMembers: GroupMember[]
  messages: Message[]

  queue: QueueItem[]
  currentQueueIndex: number
  isQueueOpen: boolean

  isGroupModalOpen: boolean
  isRejoining: boolean
  connectionState: "connected" | "disconnected" | "reconnecting"

  typingUsers: Record<string, string>
  floatingReactions: Array<{ id: string; emoji: string; userName: string }>
  quickPickRecs: Song[]

  searchResults: Song[]
  searchQuery: string
  isSearchLoading: boolean
}

interface GroupSessionActions {
  getCurrentQueueItem: () => QueueItem | null
  getUpcomingQueue: () => QueueItem[]
  getPlayedQueue: () => QueueItem[]

  saveSession: (groupId: string) => void
  clearSession: () => void
  getStoredSession: () => Promise<{ groupId: string; lastUpdate: number } | null>

  createGroup: (socket: any, user: any, groupName: string) => void
  joinGroup: (socket: any, user: any, groupId: string) => void
  rejoinGroup: (socket: any, user: any, groupId: string) => void
  leaveGroup: (socket: any, user: any, resetPlayback: () => void) => void
  sendMessage: (socket: any, user: any, message: string, messageType?: string) => void

  addToQueue: (socket: any, user: any, song: Song) => void
  playNow: (socket: any, user: any, song: Song) => void
  playNext: (socket: any, user: any, song: Song) => void
  skipSong: (socket: any, user: any) => void
  removeFromQueue: (socket: any, user: any, queueItemId: string) => void
  reorderQueue: (socket: any, fromIndex: number, toIndex: number) => void
  addPlaylistToQueue: (socket: any, user: any, songs: Song[]) => void

  performSearch: (query: string) => Promise<void>
  clearSearch: () => void

  handleGroupCreated: (group: Group, user: any, openInviteSheet?: () => void) => void
  handleGroupJoined: (data: {
    group: Group
    members: GroupMember[]
    queue?: QueueItem[]
    currentQueueIndex?: number
    playbackState?: any
  }) => void
  handleGroupRejoined: (data: {
    group: Group
    members: GroupMember[]
    queue?: QueueItem[]
    currentQueueIndex?: number
    playbackState?: any
  }) => void
  resetSession: (resetPlayback: () => void) => void
}

type GroupSessionStore = GroupSessionState & GroupSessionActions

let searchDebounceTimer: any = null
const SESSION_KEY = "@syncvibe_group_session"

const initialState: GroupSessionState = {
  currentGroup: null,
  groupMembers: [],
  messages: [],
  queue: [],
  currentQueueIndex: -1,
  isQueueOpen: false,
  isGroupModalOpen: false,
  isRejoining: false,
  connectionState: "disconnected",
  typingUsers: {},
  floatingReactions: [],
  quickPickRecs: [],
  searchResults: [],
  searchQuery: "",
  isSearchLoading: false,
}

export const useGroupSessionStore = create<GroupSessionStore>()((set, get) => ({
  ...initialState,

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
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ groupId, lastUpdate: Date.now() })).catch(
      () => {},
    )
  },

  clearSession: () => {
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {})
  },

  getStoredSession: async () => {
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  },

  createGroup: (socket, user, groupName) => {
    if (!groupName.trim() || !user) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    socket?.emit("create-music-group", {
      name: groupName,
      createdBy: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    })
    set({ isGroupModalOpen: false })
  },

  joinGroup: (socket, user, groupId) => {
    if (!groupId.trim() || !user) return

    socket?.emit("join-music-group", {
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
    if (!currentGroup || !user) return

    socket?.emit("leave-group", {
      groupId: currentGroup.id,
      userId: user.userid,
    })

    resetPlayback()
    clearSession()
    set({ ...initialState })
  },

  sendMessage: (socket, user, message, messageType = "text") => {
    if (!message.trim()) return
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return

    const payload: any = {
      groupId: currentGroup.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      messageType,
    }
    if (messageType === "gif") {
      payload.gifUrl = message
      payload.message = ""
    } else {
      payload.message = message
    }
    socket?.emit("chat-message", payload)
  },

  addToQueue: (socket, user, song) => {
    const { currentGroup, queue } = get()
    if (!currentGroup?.id || !user) return

    if (queue.some((item) => item.song?.id === song?.id)) {
      Alert.alert("Info", "Song is already in the queue")
      return
    }

    const securedSong = ensureHttpsForSongUrls(song)
    socket?.emit("add-to-queue", {
      groupId: currentGroup.id,
      song: securedSong,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })
  },

  playNow: (socket, user, song) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return

    const securedSong = ensureHttpsForSongUrls(song)
    socket?.emit("music-change", {
      groupId: currentGroup.id,
      song: securedSong,
      currentTime: 0,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })
  },

  playNext: (socket, user, song) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return

    const securedSong = ensureHttpsForSongUrls(song)
    socket?.emit("play-next", {
      groupId: currentGroup.id,
      song: securedSong,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })
  },

  skipSong: (socket, user) => {
    const { currentGroup } = get()
    if (!currentGroup?.id) return

    socket?.emit("skip-song", {
      groupId: currentGroup.id,
      userName: user?.name,
    })
  },

  removeFromQueue: (socket, user, queueItemId) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user) return

    socket?.emit("remove-from-queue", {
      groupId: currentGroup.id,
      queueItemId,
      userId: user.userid,
    })
  },

  reorderQueue: (socket, fromIndex, toIndex) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || fromIndex === toIndex) return
    socket?.emit("reorder-queue", {
      groupId: currentGroup.id,
      fromIndex,
      toIndex,
    })
  },

  addPlaylistToQueue: (socket, user, songs) => {
    const { currentGroup } = get()
    if (!currentGroup?.id || !user || !songs?.length) return

    const securedSongs = songs.map(ensureHttpsForSongUrls)
    socket?.emit("add-playlist-to-queue", {
      groupId: currentGroup.id,
      songs: securedSongs,
      addedBy: {
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
      },
    })
  },

  performSearch: async (query: string) => {
    set({ searchQuery: query })

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)

    if (!query.trim()) {
      set({ searchResults: [], isSearchLoading: false })
      return
    }

    set({ isSearchLoading: true })

    searchDebounceTimer = setTimeout(async () => {
      try {
        const results = await searchSongs(query)
        set({ searchResults: results })
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        set({ isSearchLoading: false })
      }
    }, 400)
  },

  clearSearch: () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    set({ searchQuery: "", searchResults: [], isSearchLoading: false })
  },

  handleGroupCreated: (group, user, openInviteSheet) => {
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
    openInviteSheet?.()
  },

  handleGroupJoined: (data) => {
    const { group, members, queue: serverQueue, currentQueueIndex: serverIdx } = data
    const { saveSession } = get()
    set({
      currentGroup: group,
      groupMembers: members,
      queue: serverQueue || [],
      currentQueueIndex: serverIdx ?? -1,
    })
    saveSession(group.id)
  },

  handleGroupRejoined: (data) => {
    const { group, members, queue: serverQueue, currentQueueIndex: serverIdx } = data
    const { saveSession } = get()
    set({
      currentGroup: group,
      groupMembers: members,
      queue: serverQueue || [],
      currentQueueIndex: serverIdx ?? -1,
      isRejoining: false,
    })
    saveSession(group.id)
  },

  resetSession: (resetPlayback) => {
    const { clearSession } = get()
    resetPlayback()
    clearSession()
    set({ ...initialState })
  },
}))

export const useGroupSession = () =>
  useGroupSessionStore(
    useShallow((s) => ({
      currentGroup: s.currentGroup,
      groupMembers: s.groupMembers,
      queue: s.queue,
      currentQueueIndex: s.currentQueueIndex,
      isQueueOpen: s.isQueueOpen,
      isGroupModalOpen: s.isGroupModalOpen,
    })),
  )

export const useGroupQueue = () =>
  useGroupSessionStore(
    useShallow((s) => ({
      queue: s.queue,
      currentQueueIndex: s.currentQueueIndex,
      isQueueOpen: s.isQueueOpen,
      getCurrentQueueItem: s.getCurrentQueueItem,
      getUpcomingQueue: s.getUpcomingQueue,
    })),
  )

export const useGroupSearch = () =>
  useGroupSessionStore(
    useShallow((s) => ({
      searchResults: s.searchResults,
      searchQuery: s.searchQuery,
      isSearchLoading: s.isSearchLoading,
      performSearch: s.performSearch,
      clearSearch: s.clearSearch,
    })),
  )
