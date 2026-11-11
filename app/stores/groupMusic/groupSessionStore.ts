import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Song } from '@/types/song';
import { searchSongs } from '@/utils/api/getSongs';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { getDeviceId } from '@/utils/deviceId';
import { toast } from '@/context/ToastContext';
import {
  queueViewOf,
  ROOM_PROTOCOL,
  sendRoomCommand,
  type RoomMetaPart,
  type RoomQueuePart,
  type RoomSnapshot,
} from './roomProtocol';
import { Group, GroupMember, Message, QueueItem, ActiveSoundEffect } from './types';

interface GroupSessionState {
  currentGroup: Group | null;
  groupMembers: GroupMember[];
  messages: Message[];

  // `queue` is what the screens read: the current song, then what's coming up. The room sends
  // those as two parts, each with a revision so a late or repeated message can be told apart.
  queue: QueueItem[];
  currentQueueIndex: number;
  currentItem: QueueItem | null;
  upcoming: QueueItem[];
  queueRev: number;
  metaRev: number;
  isQueueOpen: boolean;

  isGroupModalOpen: boolean;
  isRejoining: boolean;
  connectionState: 'connected' | 'disconnected' | 'reconnecting';

  typingUsers: Record<string, string>;
  floatingReactions: Array<{ id: string; emoji: string; userName: string }>;
  activeSoundEffect: ActiveSoundEffect | null;
  quickPickRecs: Song[];

  searchResults: Song[];
  searchQuery: string;
  isSearchLoading: boolean;
}

interface GroupSessionActions {
  getCurrentQueueItem: () => QueueItem | null;
  getUpcomingQueue: () => QueueItem[];
  getPlayedQueue: () => QueueItem[];

  saveSession: (groupId: string) => void;
  clearSession: () => void;
  getStoredSession: () => Promise<{ groupId: string; lastUpdate: number } | null>;

  triggerSoundEffectAnimation: (sfx: ActiveSoundEffect) => void;
  clearActiveSoundEffect: () => void;

  createGroup: (socket: any, user: any, groupName: string) => void;
  joinGroup: (socket: any, user: any, groupId: string) => void;
  rejoinGroup: (socket: any, user: any, groupId: string) => void;
  leaveGroup: (socket: any, user: any, resetPlayback: () => void) => void;
  sendMessage: (
    socket: any,
    user: any,
    message: string,
    messageType?: string,
    extra?: Record<string, any>
  ) => void;

  /** The song that's on changed (it travels with playback, not with the queue). */
  applyCurrentItem: (item: QueueItem | null | undefined) => void;
  applyQueuePart: (part: RoomQueuePart | undefined, options?: { force?: boolean }) => boolean;
  applyMetaPart: (part: RoomMetaPart | undefined, options?: { force?: boolean }) => boolean;
  /** The whole room at once: on joining, and whenever this phone finds it missed something. */
  applySnapshot: (snapshot: RoomSnapshot | null | undefined) => void;

  addToQueue: (socket: any, user: any, song: Song) => void;
  playNow: (socket: any, user: any, song: Song) => void;
  /** Jumps to a song that's already coming up. The ones before it stay queued. */
  playQueueItem: (socket: any, itemId: string) => void;
  playNext: (socket: any, user: any, song: Song) => void;
  skipSong: (socket: any, user: any) => void;
  removeFromQueue: (socket: any, user: any, queueItemId: string) => void;
  /** Positions are those of `queue`, as the list shows them. */
  reorderQueue: (socket: any, fromIndex: number, toIndex: number) => void;
  addPlaylistToQueue: (socket: any, user: any, songs: Song[]) => void;
  clearQueue: (socket: any, user: any) => void;
  shuffleQueue: (socket: any) => void;
  toggleAutoRecommendations: (socket: any, enabled?: boolean) => void;
  /** Who may control playback. Only the host can change it. */
  setControlMode: (socket: any, mode: 'everyone' | 'host') => void;
  transferHost: (socket: any, userId: number | string) => void;
  /** Only the host makes co-hosts. */
  setCoHost: (socket: any, userId: number | string, enabled: boolean) => void;
  /** A muted person still listens but can't chat or react. */
  muteMember: (socket: any, userId: number | string, enabled: boolean) => void;
  /** Takes someone out of the room; an invite from a host lets them back. */
  removeMember: (socket: any, userId: number | string) => void;
  /** Lets someone a host removed back in, or says no to them. */
  answerRejoin: (socket: any, userId: string, accept: boolean) => void;
  /** Votes to skip the song playing, or takes the vote back. */
  voteSkip: (socket: any) => void;

  performSearch: (query: string) => Promise<void>;
  clearSearch: () => void;

  handleGroupCreated: (
    created: Group & { sync?: RoomSnapshot },
    user: any,
    openInviteSheet?: () => void
  ) => void;
  handleGroupJoined: (data: JoinedRoom) => void;
  handleGroupRejoined: (data: JoinedRoom) => void;
  resetSession: (resetPlayback: () => void) => void;
}

interface JoinedRoom {
  group: Group;
  members: GroupMember[];
  sync?: RoomSnapshot;
}

type GroupSessionStore = GroupSessionState & GroupSessionActions;

const FRESH_ROOM = {
  queue: [] as QueueItem[],
  currentQueueIndex: -1,
  currentItem: null as QueueItem | null,
  upcoming: [] as QueueItem[],
  queueRev: 0,
  metaRev: 0,
};

/** Sends a request to the room and shows why if it was turned down. */
const command = async (
  socket: any,
  groupId: string,
  type: string,
  payload?: Record<string, unknown>
) => {
  const result = await sendRoomCommand(socket, groupId, type, payload);
  if (!result.ok) toast(result.error, { type: 'error' });
  return result;
};

let searchDebounceTimer: any = null;
const SESSION_KEY = '@syncvibe_group_session';

const initialState: GroupSessionState = {
  currentGroup: null,
  groupMembers: [],
  messages: [],
  ...FRESH_ROOM,
  isQueueOpen: false,
  isGroupModalOpen: false,
  isRejoining: false,
  connectionState: 'disconnected',
  typingUsers: {},
  floatingReactions: [],
  activeSoundEffect: null,
  quickPickRecs: [],
  searchResults: [],
  searchQuery: '',
  isSearchLoading: false,
};

export const useGroupSessionStore = create<GroupSessionStore>()((set, get) => ({
  ...initialState,

  triggerSoundEffectAnimation: (sfx) => {
    set({ activeSoundEffect: sfx });
  },

  clearActiveSoundEffect: () => {
    set({ activeSoundEffect: null });
  },

  getCurrentQueueItem: () => {
    const { queue, currentQueueIndex } = get();
    return currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null;
  },

  getUpcomingQueue: () => {
    const { queue, currentQueueIndex } = get();
    return queue.filter((_, idx) => idx > currentQueueIndex);
  },

  getPlayedQueue: () => {
    const { queue, currentQueueIndex } = get();
    return queue.filter((_, idx) => idx < currentQueueIndex);
  },

  saveSession: (groupId) => {
    AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ groupId, lastUpdate: Date.now() })).catch(
      () => {}
    );
  },

  clearSession: () => {
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  },

  getStoredSession: async () => {
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  createGroup: (socket, user, groupName) => {
    if (!groupName.trim() || !user) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    void getDeviceId().then((deviceId) => {
      socket?.emit('create-music-group', {
        name: groupName,
        createdBy: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
        deviceId,
        protocol: ROOM_PROTOCOL,
      });
    });
    set({ isGroupModalOpen: false });
  },

  joinGroup: (socket, user, groupId) => {
    if (!groupId.trim() || !user) return;

    void getDeviceId().then((deviceId) => {
      socket?.emit('join-music-group', {
        groupId,
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
        deviceId,
        protocol: ROOM_PROTOCOL,
      });
    });
    set({ isGroupModalOpen: false });
  },

  rejoinGroup: (socket, user, groupId) => {
    if (!groupId || !user?.userid || !socket) return;
    set({ isRejoining: true });
    void getDeviceId().then((deviceId) => {
      socket.emit('rejoin-music-group', {
        groupId,
        userId: user.userid,
        userName: user.name,
        profilePic: user.profilepic,
        deviceId,
        protocol: ROOM_PROTOCOL,
      });
    });
  },

  leaveGroup: (socket, user, resetPlayback) => {
    const { currentGroup, clearSession } = get();
    if (!currentGroup || !user) return;

    socket?.emit('leave-group', {
      groupId: currentGroup.id,
      userId: user.userid,
    });

    resetPlayback();
    clearSession();
    set({ ...initialState });
  },

  sendMessage: (socket, user, message, messageType = 'text', extra = {}) => {
    if (!message?.trim() && !extra?.soundUrl) return;
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;

    const payload: any = {
      groupId: currentGroup.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      messageType,
      ...extra,
    };
    if (messageType === 'gif') {
      payload.gifUrl = message;
      payload.message = '';
    } else if (messageType === 'sound') {
      payload.soundUrl = extra.soundUrl || message;
      payload.soundName = extra.soundName || 'Sound Effect';
      payload.soundId = extra.soundId || '';
      payload.message = extra.soundName || 'Sound Effect';
    } else {
      payload.message = message;
    }
    socket?.emit('chat-message', payload);
  },

  // --- What the room sends ---

  applyCurrentItem: (item) => {
    const currentItem = item || null;
    if (get().currentItem?.id === currentItem?.id) return;
    set({ currentItem, ...queueViewOf(currentItem, get().upcoming) });
  },

  applyQueuePart: (part, options) => {
    if (!part || typeof part.rev !== 'number') return false;
    if (!options?.force && part.rev <= get().queueRev) return false;
    const upcoming = part.upcoming || [];
    set({ upcoming, queueRev: part.rev, ...queueViewOf(get().currentItem, upcoming) });
    return true;
  },

  applyMetaPart: (part, options) => {
    const { currentGroup, metaRev } = get();
    if (!part || typeof part.rev !== 'number' || !currentGroup) return false;
    if (!options?.force && part.rev <= metaRev) return false;
    set({
      metaRev: part.rev,
      currentGroup: {
        ...currentGroup,
        createdBy: part.hostId ?? currentGroup.createdBy,
        coHosts: part.coHosts ?? currentGroup.coHosts ?? [],
        mutedIds: part.mutedIds ?? currentGroup.mutedIds ?? [],
        skipVotes: part.skipVotes ?? null,
        rejoinRequests: part.rejoinRequests ?? [],
        settings: { ...currentGroup.settings, ...part.settings },
        maxMembers: part.maxMembers ?? currentGroup.maxMembers,
        features: { ...currentGroup.features, ...part.features },
      },
    });
    return true;
  },

  applySnapshot: (snapshot) => {
    if (!snapshot || snapshot.groupId !== get().currentGroup?.id) return;
    get().applyCurrentItem(snapshot.playback?.item);
    get().applyQueuePart(snapshot.queue, { force: true });
    get().applyMetaPart(snapshot.meta, { force: true });
    if (Array.isArray(snapshot.members)) set({ groupMembers: snapshot.members });
  },

  // --- What this phone asks of the room ---

  addToQueue: (socket, user, song) => {
    const { currentGroup, queue } = get();
    if (!currentGroup?.id || !user) return;

    if (queue.some((item) => item.song?.id === song?.id)) {
      toast('Song is already in the queue', { type: 'info' });
      return;
    }

    void command(socket, currentGroup.id, 'add', { song: ensureHttpsForSongUrls(song) });
  },

  playNow: (socket, user, song) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    void command(socket, currentGroup.id, 'play-now', { song: ensureHttpsForSongUrls(song) });
  },

  playQueueItem: (socket, itemId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !itemId) return;
    void command(socket, currentGroup.id, 'play-item', { itemId });
  },

  playNext: (socket, user, song) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    void command(socket, currentGroup.id, 'add-next', { song: ensureHttpsForSongUrls(song) });
  },

  skipSong: (socket) => {
    const { currentGroup, currentItem } = get();
    if (!currentGroup?.id || !currentItem) return;
    // Naming the song means a double press can't skip two.
    void command(socket, currentGroup.id, 'skip', { itemId: currentItem.id });
  },

  removeFromQueue: (socket, user, queueItemId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    void command(socket, currentGroup.id, 'remove', { itemId: queueItemId });
  },

  reorderQueue: (socket, fromIndex, toIndex) => {
    const { currentGroup, queue, currentItem, upcoming } = get();
    if (!currentGroup?.id || fromIndex === toIndex) return;
    const item = queue[fromIndex];
    const target = toIndex - (currentItem ? 1 : 0);
    if (!item || target < 0 || !upcoming.some((entry) => entry.id === item.id)) return;

    // Shown where it was dropped straight away; the room's answer then confirms or corrects it.
    const reordered = upcoming.filter((entry) => entry.id !== item.id);
    reordered.splice(target, 0, item);
    set({ upcoming: reordered, ...queueViewOf(currentItem, reordered) });

    void command(socket, currentGroup.id, 'move', { itemId: item.id, toIndex: target }).then(
      (result) => {
        if (!result.ok) set({ upcoming, ...queueViewOf(get().currentItem, upcoming) });
      }
    );
  },

  addPlaylistToQueue: (socket, user, songs) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user || !songs?.length) return;
    const limit = currentGroup.settings?.maxQueueSize || 50;
    void command(socket, currentGroup.id, 'add-many', {
      songs: songs.slice(0, limit).map(ensureHttpsForSongUrls),
    });
  },

  clearQueue: (socket, user) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    void command(socket, currentGroup.id, 'clear');
  },

  shuffleQueue: (socket) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    void command(socket, currentGroup.id, 'shuffle');
  },

  toggleAutoRecommendations: (socket, enabled) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    const nextState =
      enabled !== undefined ? enabled : !(currentGroup.settings?.autoPlayRecommendations ?? true);
    void command(socket, currentGroup.id, 'set-autoplay', { enabled: nextState });
  },

  setControlMode: (socket, mode) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    void command(socket, currentGroup.id, 'set-control-mode', { mode });
  },

  transferHost: (socket, userId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || userId == null) return;
    void command(socket, currentGroup.id, 'transfer-host', { userId });
  },

  setCoHost: (socket, userId, enabled) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || userId == null) return;
    void command(socket, currentGroup.id, 'set-cohost', { userId, enabled });
  },

  muteMember: (socket, userId, enabled) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || userId == null) return;
    void command(socket, currentGroup.id, 'mute', { userId, enabled });
  },

  removeMember: (socket, userId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || userId == null) return;
    void command(socket, currentGroup.id, 'remove-member', { userId });
  },

  answerRejoin: (socket, userId, accept) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    void command(socket, currentGroup.id, 'answer-rejoin', { userId, enabled: accept });
  },

  voteSkip: (socket) => {
    const { currentGroup, currentItem } = get();
    if (!currentGroup?.id || !currentItem) return;
    void command(socket, currentGroup.id, 'vote-skip', { itemId: currentItem.id });
  },

  performSearch: async (query: string) => {
    set({ searchQuery: query });

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    if (!query.trim()) {
      set({ searchResults: [], isSearchLoading: false });
      return;
    }

    set({ isSearchLoading: true });

    searchDebounceTimer = setTimeout(async () => {
      try {
        const results = await searchSongs(query);
        set({ searchResults: results });
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        set({ isSearchLoading: false });
      }
    }, 400);
  },

  clearSearch: () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    set({ searchQuery: '', searchResults: [], isSearchLoading: false });
  },

  handleGroupCreated: (created, user, openInviteSheet) => {
    const { sync, ...group } = created;
    const { saveSession } = get();
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
      ...FRESH_ROOM,
    });
    get().applySnapshot(sync);
    saveSession(group.id);
    openInviteSheet?.();
  },

  handleGroupJoined: (data) => {
    const { group, members } = data || {};
    if (!group) return;
    const { saveSession } = get();
    set({
      currentGroup: group,
      groupMembers: members || group.members || [],
      ...FRESH_ROOM,
      isRejoining: false,
    });
    get().applySnapshot(data.sync);
    saveSession(group.id);
  },

  handleGroupRejoined: (data) => {
    const { group, members } = data || {};
    if (!group) return;
    const { saveSession } = get();
    // The queue stays on screen as it was until the snapshot replaces it, so nothing flickers.
    set({
      currentGroup: group,
      groupMembers: members || group.members || [],
      isRejoining: false,
    });
    get().applySnapshot(data.sync);
    saveSession(group.id);
  },

  resetSession: (resetPlayback) => {
    const { clearSession } = get();
    resetPlayback();
    clearSession();
    set({ ...initialState });
  },
}));

export const useGroupSession = () =>
  useGroupSessionStore(
    useShallow((s) => ({
      currentGroup: s.currentGroup,
      groupMembers: s.groupMembers,
      queue: s.queue,
      currentQueueIndex: s.currentQueueIndex,
      isQueueOpen: s.isQueueOpen,
      isGroupModalOpen: s.isGroupModalOpen,
    }))
  );

export const useGroupQueue = () =>
  useGroupSessionStore(
    useShallow((s) => ({
      queue: s.queue,
      currentQueueIndex: s.currentQueueIndex,
      isQueueOpen: s.isQueueOpen,
      getCurrentQueueItem: s.getCurrentQueueItem,
      getUpcomingQueue: s.getUpcomingQueue,
    }))
  );

export const useGroupSearch = () =>
  useGroupSessionStore(
    useShallow((s) => ({
      searchResults: s.searchResults,
      searchQuery: s.searchQuery,
      isSearchLoading: s.isSearchLoading,
      performSearch: s.performSearch,
      clearSearch: s.clearSearch,
    }))
  );
