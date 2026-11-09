import { create } from 'zustand';
import { ensureHttpsForDownloadUrls } from '@/Pages/Music/Common';
import { toast } from 'sonner';
import { getDeviceId } from './deviceId';
import { queueViewOf, ROOM_PROTOCOL, sendRoomCommand } from './roomProtocol';
import axios from 'axios';
import _ from 'lodash';

const SESSION_KEY = 'syncvibe_group_session';

const FRESH_ROOM = {
  queue: [],
  currentQueueIndex: -1,
  currentItem: null,
  upcoming: [],
  queueRev: 0,
  metaRev: 0,
};

/** Sends a request to the room and shows why if it was turned down. */
const command = async (socket, groupId, type, payload) => {
  const result = await sendRoomCommand(socket, groupId, type, payload);
  if (!result.ok) {
    if (result.code === 'queue-full') {
      useGroupSessionStore.setState({
        upgradeDialog: { open: true, feature: 'queueLimit', message: result.error },
      });
    } else toast.error(result.error);
  }
  return result;
};

export const useGroupSessionStore = create((set, get) => ({
  currentGroup: null,
  groupMembers: [],
  messages: [],

  // `queue` is what the screens read: the current song, then what's coming up. The room sends
  // those as two parts, each with a revision so a late or repeated message can be told apart.
  ...FRESH_ROOM,

  isGroupModalOpen: false,
  connectionState: 'disconnected',
  isRejoining: false,
  floatingReactions: [],
  activeSoundEffect: null,
  typingUsers: {},

  triggerSoundEffectAnimation: (sfx) => {
    set({ activeSoundEffect: sfx });
  },

  clearActiveSoundEffect: () => {
    set({ activeSoundEffect: null });
  },

  searchResults: [],
  searchQuery: '',
  isSearchOpen: false,
  isSearchLoading: false,
  quickPickRecs: [],

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
    if (groupId) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ groupId, lastUpdate: Date.now() }));
    }
  },

  clearSession: () => {
    sessionStorage.removeItem(SESSION_KEY);
  },

  getStoredSession: () => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Error reading session:', e);
      return null;
    }
  },

  createGroup: (socket, user, groupName) => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }
    socket.emit('create-music-group', {
      name: groupName,
      createdBy: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
      deviceId: getDeviceId(),
      protocol: ROOM_PROTOCOL,
    });
    set({ isGroupModalOpen: false });
  },

  joinGroup: (socket, user, groupId) => {
    if (!groupId.trim()) return;
    socket.emit('join-music-group', {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
      deviceId: getDeviceId(),
      protocol: ROOM_PROTOCOL,
    });
    set({ isGroupModalOpen: false });
  },

  rejoinGroup: (socket, user, groupId) => {
    if (!groupId || !user?.userid || !socket) return;
    set({ isRejoining: true });
    socket.emit('rejoin-music-group', {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
      deviceId: getDeviceId(),
      protocol: ROOM_PROTOCOL,
    });
  },

  leaveGroup: (socket, user, resetPlayback) => {
    const { currentGroup, clearSession } = get();
    if (!currentGroup) return;

    socket.emit('leave-group', {
      groupId: currentGroup.id,
      userId: user.userid,
    });

    resetPlayback();

    set({
      currentGroup: null,
      currentSong: null,
      messages: [],
      groupMembers: [],
      ...FRESH_ROOM,
    });
    clearSession();
    toast.info(`Left group ${currentGroup.name}`);
  },

  sendMessage: (socket, user, message, messageType = 'text', extra = {}) => {
    if (!message?.trim() && !extra?.soundUrl) return;
    const { currentGroup } = get();
    const payload = {
      groupId: currentGroup?.id,
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
    socket.emit('chat-message', payload);
  },

  /** Toggle the current user's reaction on a chat message (server owns the state). */
  sendMessageReaction: (socket, messageId, emoji) => {
    const { currentGroup } = get();
    if (!socket || !currentGroup?.id || !messageId || !emoji) return;
    socket.emit('message-reaction', { groupId: currentGroup.id, messageId, emoji });
  },

  requestChatHistory: (socket, groupId) => {
    if (!socket || !groupId) return;
    socket.emit('get-chat-history', { groupId });
  },

  /** Merge server history with any live messages already received, de-duplicated by id. */
  mergeChatHistory: (groupId, history) => {
    const { currentGroup, messages } = get();
    if (!Array.isArray(history) || currentGroup?.id !== groupId) return;
    const byId = new Map(history.map((m) => [m.id, m]));
    messages.forEach((m) => {
      if (!m.id || !byId.has(m.id)) byId.set(m.id ?? `${m.timestamp}-${byId.size}`, m);
    });
    set({
      messages: [...byId.values()].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
    });
  },

  applyMessageReaction: ({ groupId, messageId, reactions }) => {
    const { currentGroup, messages } = get();
    if (currentGroup?.id !== groupId) return;
    set({
      messages: messages.map((m) =>
        m.id === messageId ? { ...m, reactions: reactions || {} } : m
      ),
    });
  },

  // --- What the room sends ---

  /** The song that's on changed (it travels with playback, not with the queue). */
  applyCurrentItem: (item) => {
    const currentItem = item || null;
    if (get().currentItem?.id === currentItem?.id) return;
    set({ currentItem, ...queueViewOf(currentItem, get().upcoming) });
  },

  applyQueuePart: (part, { force = false } = {}) => {
    if (!part || typeof part.rev !== 'number') return false;
    if (!force && part.rev <= get().queueRev) return false;
    const upcoming = part.upcoming || [];
    set({ upcoming, queueRev: part.rev, ...queueViewOf(get().currentItem, upcoming) });
    return true;
  },

  applyMetaPart: (part, { force = false } = {}) => {
    const { currentGroup, metaRev } = get();
    if (!part || typeof part.rev !== 'number' || !currentGroup) return false;
    if (!force && part.rev <= metaRev) return false;
    set({
      metaRev: part.rev,
      currentGroup: {
        ...currentGroup,
        createdBy: part.hostId ?? currentGroup.createdBy,
        settings: { ...currentGroup.settings, ...part.settings },
        maxMembers: part.maxMembers ?? currentGroup.maxMembers,
        features: { ...currentGroup.features, ...part.features },
      },
    });
    return true;
  },

  /** The whole room at once: on joining, and whenever this tab finds it missed something. */
  applySnapshot: (snapshot) => {
    if (!snapshot || snapshot.groupId !== get().currentGroup?.id) return;
    get().applyCurrentItem(snapshot.playback?.item);
    get().applyQueuePart(snapshot.queue, { force: true });
    get().applyMetaPart(snapshot.meta, { force: true });
    if (Array.isArray(snapshot.members)) set({ groupMembers: snapshot.members });
  },

  // --- What this tab asks of the room ---

  addToQueue: async (socket, user, song) => {
    const { currentGroup, queue } = get();
    if (!currentGroup?.id || !user) return;

    const maxQueueSize = currentGroup?.settings?.maxQueueSize || 3;
    if (queue.length >= maxQueueSize) {
      set({
        upgradeDialog: {
          open: true,
          feature: 'queueLimit',
          message: `Free plan allows only ${maxQueueSize} songs in queue. Upgrade to PRO for up to 50.`,
        },
      });
      return;
    }

    if (queue.some((item) => item.song?.id === song?.id)) {
      toast.info('Song is already in the queue');
      return;
    }

    set({ isSearchOpen: false, searchQuery: '', searchResults: [] });
    const result = await command(socket, currentGroup.id, 'add', {
      song: ensureHttpsForDownloadUrls(song),
    });
    if (result.ok) toast.success('Added to queue');
  },

  playNow: (socket, user, song) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    set({ isSearchOpen: false, searchQuery: '', searchResults: [] });
    command(socket, currentGroup.id, 'play-now', { song: ensureHttpsForDownloadUrls(song) });
  },

  /** Jumps to a song that's already coming up. The ones before it stay queued. */
  playQueueItem: (socket, itemId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !itemId) return;
    command(socket, currentGroup.id, 'play-item', { itemId });
  },

  playNext: async (socket, user, song) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    set({ isSearchOpen: false, searchQuery: '', searchResults: [] });
    const result = await command(socket, currentGroup.id, 'add-next', {
      song: ensureHttpsForDownloadUrls(song),
    });
    if (result.ok) toast.success('Playing next');
  },

  addPlaylistToQueue: async (socket, user, songs) => {
    const { currentGroup, queue } = get();
    if (!currentGroup?.id || !user || !songs?.length) return;

    const maxQueueSize = currentGroup?.settings?.maxQueueSize || 3;
    if (queue.length >= maxQueueSize) {
      set({
        upgradeDialog: {
          open: true,
          feature: 'queueLimit',
          message: `Free plan allows only ${maxQueueSize} songs in queue. Upgrade to PRO for up to 50.`,
        },
      });
      return;
    }

    const result = await command(socket, currentGroup.id, 'add-many', {
      songs: songs.slice(0, maxQueueSize).map(ensureHttpsForDownloadUrls),
    });
    if (result.ok) {
      const count = result.addedCount ?? songs.length;
      toast.success(`Added ${count} ${count === 1 ? 'song' : 'songs'} to the queue`);
    }
  },

  removeFromQueue: (socket, user, queueItemId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    command(socket, currentGroup.id, 'remove', { itemId: queueItemId });
  },

  skipSong: (socket) => {
    const { currentGroup, currentItem } = get();
    if (!currentGroup?.id || !currentItem) return;
    // Naming the song means a double press can't skip two.
    command(socket, currentGroup.id, 'skip', { itemId: currentItem.id });
  },

  clearQueue: (socket, user) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || !user) return;
    command(socket, currentGroup.id, 'clear');
  },

  shuffleQueue: (socket) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    command(socket, currentGroup.id, 'shuffle');
  },

  toggleAutoRecommendations: (socket, enabled) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    command(socket, currentGroup.id, 'set-autoplay', { enabled });
  },

  /** Who may control playback: 'everyone' or 'host'. Only the host can change it. */
  setControlMode: (socket, mode) => {
    const { currentGroup } = get();
    if (!currentGroup?.id) return;
    command(socket, currentGroup.id, 'set-control-mode', { mode });
  },

  transferHost: (socket, userId) => {
    const { currentGroup } = get();
    if (!currentGroup?.id || userId == null) return;
    command(socket, currentGroup.id, 'transfer-host', { userId });
  },

  /** Positions are those of `queue`, as the list shows them. */
  reorderQueue: (socket, fromIndex, toIndex) => {
    const { currentGroup, queue, currentItem, upcoming } = get();
    if (!currentGroup?.id || fromIndex === toIndex) return;
    const item = queue[fromIndex];
    const shift = currentItem ? 1 : 0;
    const target = toIndex - shift;
    if (!item || target < 0 || !upcoming.some((entry) => entry.id === item.id)) return;

    // Shown where it was dropped straight away; the room's answer then confirms or corrects it.
    const reordered = upcoming.filter((entry) => entry.id !== item.id);
    reordered.splice(target, 0, item);
    set({ upcoming: reordered, ...queueViewOf(currentItem, reordered) });

    command(socket, currentGroup.id, 'move', { itemId: item.id, toIndex: target }).then(
      (result) => {
        if (!result.ok) set({ upcoming, ...queueViewOf(get().currentItem, upcoming) });
      }
    );
  },

  debouncedSearch: _.debounce(async (query) => {
    if (!query.trim()) {
      useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false });
      return;
    }
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/search/songs?q=${query}`);
      useGroupSessionStore.setState({ searchResults: response.data?.data?.results || [] });
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      useGroupSessionStore.setState({ isSearchLoading: false });
    }
  }, 400),

  handleGroupCreated: (created, user, setInviteSheetOpen) => {
    if (!created) return;
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
      isRejoining: false,
    });
    get().applySnapshot(sync);
    saveSession(group.id);
    toast.success(`Created group: ${group.name}`);
    setInviteSheetOpen(true);
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
    toast.success(`Joined group: ${group.name}`);
  },

  handleGroupRejoined: (data) => {
    const { group, members } = data || {};
    if (!group) return;
    const { saveSession } = get();
    // The queue stays on screen as it was until the snapshot replaces it, so nothing flickers.
    set({ currentGroup: group, groupMembers: members || [], isRejoining: false });
    get().applySnapshot(data.sync);
    saveSession(group.id);
    toast.success(`Rejoined group: ${group.name}`);
  },

  resetSession: (resetPlayback) => {
    const { clearSession } = get();
    resetPlayback();
    set({
      currentGroup: null,
      messages: [],
      groupMembers: [],
      ...FRESH_ROOM,
    });
    clearSession();
  },
}));
