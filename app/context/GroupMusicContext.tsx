import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { AppState, Alert } from 'react-native';
import TrackPlayer, { Event, PlaybackState } from '@rntp/player';
import { Song } from '@/types/song';
import type { Message, MessageReactions } from '@/stores/groupMusic/types';
import { useChat } from './SocketContext';
import { useUser } from './UserContext';
import { toast } from './ToastContext';
import {
  isNaturalGroupSongEnd,
  useGroupPlaybackStore,
  ROOM_ACTION_SETTLE_MS,
  noteRoomPlaybackStarted,
} from '@/stores/groupMusic/groupPlaybackStore';
import { seedClock } from '@/stores/groupMusic/roomClock';
import {
  fetchRoomSnapshot,
  pingRoom,
  type RoomMetaPart,
  type RoomQueuePart,
  type RoomSnapshot,
} from '@/stores/groupMusic/roomProtocol';
import type { RoomPlayback } from '@/stores/groupMusic/roomSync';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupInviteStore } from '@/stores/groupMusic/groupInviteStore';
import { usePlayerStore } from '@/stores/playerStore';
import { runAfterIdle } from '@/utils/runAfterIdle';
import { soundEffectsManager } from '@/utils/soundEffectsManager';

interface GroupMusicContextType {
  socket: any;
  user: any;

  handlePlayPause: (forceState?: boolean) => Promise<void>;
  handleSeek: (value: number) => Promise<void>;
  createGroup: (groupName: string) => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: () => void;
  sendMessage: (message: string, messageType?: string, extra?: Record<string, any>) => void;
  addToQueue: (song: Song) => void;
  playNow: (song: Song) => void;
  playNext: (song: Song) => void;
  skipSong: () => void;
  /** Jumps to a song that's already coming up. */
  playQueueItem: (itemId: string) => void;
  shuffleQueue: () => void;
  /** Who may control playback: everyone, or only the host. Only the host can change it. */
  setControlMode: (mode: 'everyone' | 'host') => void;
  transferHost: (userId: number | string) => void;
  setCoHost: (userId: number | string, enabled: boolean) => void;
  muteMember: (userId: number | string, enabled: boolean) => void;
  removeMember: (userId: number | string) => void;
  voteSkip: () => void;
  removeFromQueue: (queueItemId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  addPlaylistToQueue: (songs: Song[]) => void;
  clearQueue: () => void;
  toggleAutoRecommendations: (enabled?: boolean) => void;
  sendReaction: (emoji: string) => void;
  /** Toggle an emoji reaction on a chat message (server broadcasts the result). */
  reactToMessage: (messageId: string, emoji: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  sendInvite: (inviteeUserId: number) => void;
  acceptInvite: () => void;
  declineInvite: () => void;
}

const FLOATING_REACTION_MS = 1000;
/** Pings come quickly at first so the clock is accurate early, then settle to a steady pace. */
const PING_BURST_MS = 1000;
const PING_BURST_COUNT = 5;
const PING_STEADY_MS = 5000;

/** Floats an emoji over the player, for just as long as its animation runs. */
const showFloatingReaction = (emoji: string, userName: string) => {
  const id = `${Date.now()}-${Math.random()}`;
  useGroupSessionStore.setState((state) => ({
    floatingReactions: [...state.floatingReactions, { id, emoji, userName }],
  }));
  setTimeout(() => {
    useGroupSessionStore.setState((state) => ({
      floatingReactions: state.floatingReactions.filter((r) => r.id !== id),
    }));
  }, FLOATING_REACTION_MS);
};

const GroupMusicContext = createContext<GroupMusicContextType | null>(null);

const pb = useGroupPlaybackStore;
const ss = useGroupSessionStore;
const inv = useGroupInviteStore;

export function GroupMusicProvider({ children }: { children: ReactNode }) {
  const { socket } = useChat();
  const { user } = useUser();
  const hasAttemptedRejoin = useRef(false);

  const currentGroupId = ss((s) => s.currentGroup?.id);

  // --- TrackPlayer lifecycle ---
  useEffect(() => {
    let cancelled = false;
    const task = runAfterIdle(() => {
      if (!cancelled) void pb.getState().initTrackPlayer();
    });

    return () => {
      cancelled = true;
      task.cancel();
      pb.getState().reset();
    };
  }, []);

  useEffect(() => {
    const { isPlaying } = pb.getState();
    if (isPlaying) {
      pb.getState().startProgressPolling();
    } else {
      pb.getState().stopProgressPolling();
    }
  }, [pb((s) => s.isPlaying)]);

  // --- TrackPlayer event listeners ---
  useEffect(() => {
    const subIsPlaying = TrackPlayer.addEventListener(Event.IsPlayingChanged, ({ playing }) => {
      try {
        const activePlayerMode = usePlayerStore.getState().activePlayerMode;
        if (activePlayerMode !== 'group') return;

        pb.setState({ isPlaying: playing });
        if (playing) {
          pb.getState().startProgressPolling();
          noteRoomPlaybackStarted();
          // Sound has only just started, after however long it took to buffer: measure that as
          // soon as the player has settled rather than waiting for the next regular check.
          setTimeout(() => pb.getState().checkDrift(), ROOM_ACTION_SETTLE_MS + 100);
        } else {
          pb.getState().stopProgressPolling();
        }
      } catch (err) {
        console.error('Error handling playback state:', err);
      }
    });

    const subPlaybackState = TrackPlayer.addEventListener(
      Event.PlaybackStateChanged,
      ({ state }) => {
        try {
          const activePlayerMode = usePlayerStore.getState().activePlayerMode;
          if (activePlayerMode !== 'group') return;

          // Only a genuine end-of-song is reported (see isNaturalGroupSongEnd). The room moves
          // on by itself either way; this lets it do so the moment the sound stops.
          if (state === PlaybackState.Ended && isNaturalGroupSongEnd()) {
            pb.getState().reportSongEnded();
          }
        } catch (err) {
          console.error('Error handling playback state:', err);
        }
      }
    );

    const subPlaybackError = TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
      console.error('TrackPlayer error:', error);
    });

    return () => {
      subIsPlaying.remove();
      subPlaybackState.remove();
      subPlaybackError.remove();
    };
  }, []);

  // --- The room's clock, and a check that nothing was missed ---
  // Each ping refines this phone's idea of the server's time and brings back the room's
  // revisions; a mismatch means an update never arrived, so the whole room is fetched again.
  // Nothing else is polled: staying in step is worked out on the phone (see groupPlaybackStore).
  useEffect(() => {
    if (!socket || !currentGroupId) return;
    const groupId = currentGroupId;
    pb.getState().setTransport(socket, groupId);
    let stopped = false;
    let resyncing = false;

    const resync = async () => {
      if (resyncing) return;
      resyncing = true;
      const snapshot = await fetchRoomSnapshot(socket, groupId);
      resyncing = false;
      if (stopped || !snapshot || snapshot.error || ss.getState().currentGroup?.id !== groupId) {
        return;
      }
      seedClock(snapshot.serverTime);
      ss.getState().applySnapshot(snapshot);
      pb.getState().applyPlayback(snapshot.playback, 'sync', { force: true });
    };

    const ping = async () => {
      const reply = await pingRoom(socket, groupId);
      if (stopped || !reply || ss.getState().currentGroup?.id !== groupId) return;
      pb.getState().noteClockUpdate();

      if (reply.error === 'not-in-room') {
        // This connection never got back into the room after a reconnect.
        if (user) ss.getState().rejoinGroup(socket, user, groupId);
      } else if (reply.error === 'gone') {
        ss.getState().resetSession(() => pb.getState().reset());
        Alert.alert('Room Ended', 'This room is no longer active.');
      } else if (reply.revs) {
        const { queueRev, metaRev } = ss.getState();
        const behind =
          reply.revs.playback > pb.getState().getPlaybackRev() ||
          reply.revs.queue > queueRev ||
          reply.revs.meta > metaRev;
        if (behind) void resync();
      }
    };

    let sent = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = () => {
      void ping();
      sent += 1;
      timer = setTimeout(loop, sent < PING_BURST_COUNT ? PING_BURST_MS : PING_STEADY_MS);
    };
    loop();

    // Timers can stall while the phone is in a pocket, so check as soon as it's back in hand.
    const foreground = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void ping();
      pb.getState().checkDrift();
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      foreground.remove();
    };
  }, [socket, user, currentGroupId]);

  // --- Session rejoin on socket connect ---
  useEffect(() => {
    if (!socket || !user) return;

    const handleSetupComplete = async () => {
      // Every reconnect is a new connection the server hasn't put in the room yet.
      const inRoom = ss.getState().currentGroup?.id;
      if (inRoom) {
        ss.getState().rejoinGroup(socket, user, inRoom);
        return;
      }
      if (hasAttemptedRejoin.current) return;

      const stored = await ss.getState().getStoredSession();
      if (stored?.groupId) {
        hasAttemptedRejoin.current = true;
        ss.getState().rejoinGroup(socket, user, stored.groupId);
      }
    };

    // Music plays on while the connection is down, so show that it's out of step for now.
    const handleDisconnect = () => {
      if (ss.getState().currentGroup) ss.setState({ isRejoining: true });
    };

    socket.on('setup-complete', handleSetupComplete);
    socket.on('disconnect', handleDisconnect);
    // Also try immediately if socket is already connected
    if (socket.connected) {
      handleSetupComplete();
    }

    return () => {
      socket.off('setup-complete', handleSetupComplete);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, user]);

  // --- All group socket events ---
  useEffect(() => {
    if (!socket) return;

    const inThisRoom = (data: { groupId?: string } | undefined) =>
      Boolean(data?.groupId) && data?.groupId === ss.getState().currentGroup?.id;

    // The room's three parts. Each message carries the whole part and its revision.
    socket.on(
      'room:playback',
      (data: RoomPlayback & { groupId: string; kind: any; serverTime: number }) => {
        if (!inThisRoom(data)) return;
        seedClock(data.serverTime);
        if (!pb.getState().applyPlayback(data, data.kind)) return;
        ss.getState().applyCurrentItem(data.item);
      }
    );

    socket.on('room:queue', (data: RoomQueuePart & { groupId: string }) => {
      if (inThisRoom(data)) ss.getState().applyQueuePart(data);
    });

    socket.on('room:meta', (data: RoomMetaPart & { groupId: string }) => {
      if (inThisRoom(data)) ss.getState().applyMetaPart(data);
    });

    /** Joining hands over the whole room; the audio then lines up with it. */
    const enterRoom = (sync?: RoomSnapshot) => {
      if (!sync) return;
      seedClock(sync.serverTime);
      pb.getState().applyPlayback(sync.playback, 'join', { force: true });
    };

    socket.on('group-created', (group: any) => {
      if (!user) return;
      ss.getState().handleGroupCreated(group, user, () => {
        inv.setState({ isInviteSheetOpen: true });
      });
      enterRoom(group?.sync);
    });

    const requestHistory = () => {
      const id = ss.getState().currentGroup?.id;
      if (id) socket.emit('get-chat-history', { groupId: id });
    };

    socket.on('group-joined', (data: any) => {
      ss.getState().handleGroupJoined(data);
      requestHistory();
      enterRoom(data?.sync);
    });

    // The song already loaded keeps playing through a reconnect; only its position is corrected.
    socket.on('group-rejoined', (data: any) => {
      ss.getState().handleGroupRejoined(data);
      requestHistory();
      enterRoom(data?.sync);
    });

    const endRoomHere = () => {
      ss.getState().resetSession(() => pb.getState().reset());
    };

    socket.on('group-not-found', () => {
      ss.setState({ isRejoining: false });
      ss.getState().clearSession();
      // Rejoining a room that ended while the connection was down: don't stay in a phantom one.
      if (ss.getState().currentGroup) endRoomHere();
      Alert.alert('Group Not Found', 'The group no longer exists.');
    });

    // You moved to another device, which now plays the room. Rejoining would just take it back.
    socket.on('device-replaced', (data: { groupId: string }) => {
      const { currentGroup, isRejoining } = ss.getState();
      if (currentGroup && currentGroup.id !== data.groupId) return;
      ss.setState({ isRejoining: false });
      ss.getState().clearSession();
      if (currentGroup) endRoomHere();
      if (currentGroup || isRejoining) {
        toast('Playing on your other device now. Tap Play here to bring it back.', {
          type: 'info',
        });
      }
    });

    // The answer to asking to be let back into a room a host removed you from.
    socket.on('room:rejoin-answer', (data: { name: string; accepted: boolean }) => {
      if (data.accepted) {
        toast(`A host let you back into ${data.name}. You can rejoin it now.`, { type: 'success' });
      } else toast(`A host declined your request to rejoin ${data.name}`, { type: 'info' });
    });

    // Left on another device, or a host removed you.
    socket.on('left-group', (data: { groupId: string; removed?: boolean }) => {
      if (data.groupId !== ss.getState().currentGroup?.id) return;
      endRoomHere();
      if (data.removed) toast('A host removed you from the room', { type: 'info' });
    });

    socket.on('join-refused', (data: { message?: string }) => {
      ss.setState({ isRejoining: false });
      ss.getState().clearSession();
      if (ss.getState().currentGroup) endRoomHere();
      toast(data?.message || 'You can’t join this room', { type: 'error' });
    });

    socket.on('chat-blocked', (data: { groupId?: string; message?: string }) => {
      if (data?.groupId === ss.getState().currentGroup?.id && data.message) {
        toast(data.message, { type: 'error' });
      }
    });

    socket.on('member-presence', (data: { userId: number | string; connected: boolean }) => {
      ss.setState((state) => ({
        groupMembers: state.groupMembers.map((m) =>
          String(m.userId) === String(data.userId) ? { ...m, connected: data.connected } : m
        ),
      }));
    });

    socket.on('group-full', () => {
      Alert.alert('Group Full', 'This group has reached its member limit.');
    });

    socket.on('feature-locked', ({ message }: { message: string }) => {
      Alert.alert('Feature Locked', message);
    });

    socket.on('member-joined', (member: any) => {
      ss.setState((state) => {
        if (state.groupMembers.find((m) => String(m.userId) === String(member.userId)))
          return state;
        return { groupMembers: [...state.groupMembers, member] };
      });
    });

    socket.on('member-left', ({ userId }: { userId: number | string }) => {
      if (!userId) return;
      ss.setState((state) => ({
        groupMembers: state.groupMembers.filter((m) => String(m.userId) !== String(userId)),
      }));
    });

    socket.on('group-disbanded', () => {
      ss.getState().resetSession(() => pb.getState().reset());
      Alert.alert('Info', 'Group disbanded');
    });

    socket.on('new-message', (message: any) => {
      ss.setState((state) => ({ messages: [...state.messages, message] }));

      // When a sound effect arrives
      if (message.messageType === 'sound' && message.soundUrl) {
        ss.getState().triggerSoundEffectAnimation({
          id: message.id || String(Date.now()),
          soundName: message.soundName || message.message || 'Sound Effect',
          soundUrl: message.soundUrl,
          userName: message.userName || 'Someone',
          profilePic: message.profilePic,
          senderId: message.senderId,
          timestamp: Date.now(),
        });

        // Auto-play incoming sound effect if enabled
        if (soundEffectsManager.getAutoPlay()) {
          soundEffectsManager.playRoomEffect(message.soundUrl);
        }
      }
    });

    // Chat history arrives after join/rejoin. Merge by id so messages that landed while the
    // request was in flight are kept, and keep everything in timestamp order.
    socket.on('chat-history', (data: { groupId: string; messages: Message[] }) => {
      if (!data?.messages || data.groupId !== ss.getState().currentGroup?.id) return;
      ss.setState((state) => {
        const byId = new Map<string, Message>();
        for (const m of data.messages) if (m?.id) byId.set(m.id, m);
        for (const m of state.messages) if (m?.id && !byId.has(m.id)) byId.set(m.id, m);
        const merged = [...byId.values()].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        return { messages: merged };
      });
    });

    // The server owns reaction state and sends the message's full reactions each time.
    socket.on(
      'message-reaction',
      (data: { groupId: string; messageId: string; reactions: MessageReactions }) => {
        if (data?.groupId !== ss.getState().currentGroup?.id) return;
        ss.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === data.messageId ? { ...m, reactions: data.reactions || {} } : m
          ),
        }));
      }
    );

    socket.on('song-reaction', (data: { emoji: string; userName: string }) => {
      showFloatingReaction(data.emoji, data.userName);
    });

    socket.on('user-typing', (data: { userId: string; userName: string; isTyping: boolean }) => {
      ss.setState((state) => {
        const updated = { ...state.typingUsers };
        if (data.isTyping) {
          updated[data.userId] = data.userName;
        } else {
          delete updated[data.userId];
        }
        return { typingUsers: updated };
      });
    });

    // Invite events
    socket.on(
      'group-invite-received',
      (data: {
        groupId: string;
        groupName: string;
        inviterName: string;
        inviterPic: string;
        inviterId: number;
      }) => {
        inv.setState({ pendingInvite: data });
      }
    );

    socket.on('invite-sent', () => {
      Alert.alert('Invite Sent', 'Your invite has been sent.');
    });

    socket.on('invite-error', ({ error, message }: { error?: string; message?: string }) => {
      Alert.alert('Invite Error', error || message || 'Could not send the invite.');
    });

    socket.on('invite-accepted', ({ userName }: { userName: string }) => {
      Alert.alert('Invite Accepted', `${userName} has joined the group!`);
    });

    socket.on('group-invite-declined', ({ userName }: { userName: string }) => {
      Alert.alert('Invite Declined', `${userName} declined the invite.`);
    });

    return () => {
      const events = [
        'room:playback',
        'room:queue',
        'room:meta',
        'group-created',
        'group-joined',
        'group-rejoined',
        'group-not-found',
        'group-full',
        'feature-locked',
        'member-joined',
        'member-left',
        'group-disbanded',
        'new-message',
        'chat-history',
        'message-reaction',
        'song-reaction',
        'left-group',
        'join-refused',
        'chat-blocked',
        'device-replaced',
        'room:rejoin-answer',
        'member-presence',
        'user-typing',
        'group-invite-received',
        'invite-sent',
        'invite-error',
        'invite-accepted',
        'group-invite-declined',
      ];
      events.forEach((e) => socket.off(e));
    };
  }, [socket, user]);

  const groupId = ss((s) => s.currentGroup?.id);

  // --- Wrapped actions ---
  const handlePlayPause = useCallback(
    (forceState?: boolean) => pb.getState().handlePlayPause(socket, groupId, forceState),
    [socket, groupId]
  );

  const handleSeek = useCallback(
    (value: number) => pb.getState().handleSeek(socket, groupId, value),
    [socket, groupId]
  );

  const createGroup = useCallback(
    (groupName: string) => ss.getState().createGroup(socket, user, groupName),
    [socket, user]
  );

  const joinGroup = useCallback(
    (groupId: string) => ss.getState().joinGroup(socket, user, groupId),
    [socket, user]
  );

  const leaveGroup = useCallback(
    () => ss.getState().leaveGroup(socket, user, () => pb.getState().reset()),
    [socket, user]
  );

  const sendMessage = useCallback(
    (message: string, messageType?: string, extra?: Record<string, any>) =>
      ss.getState().sendMessage(socket, user, message, messageType, extra),
    [socket, user]
  );

  const addToQueue = useCallback(
    (song: Song) => ss.getState().addToQueue(socket, user, song),
    [socket, user]
  );

  const playNow = useCallback(
    (song: Song) => ss.getState().playNow(socket, user, song),
    [socket, user]
  );

  const playNext = useCallback(
    (song: Song) => ss.getState().playNext(socket, user, song),
    [socket, user]
  );

  const skipSong = useCallback(() => ss.getState().skipSong(socket, user), [socket, user]);

  const playQueueItem = useCallback(
    (itemId: string) => ss.getState().playQueueItem(socket, itemId),
    [socket]
  );

  const shuffleQueue = useCallback(() => ss.getState().shuffleQueue(socket), [socket]);

  const setControlMode = useCallback(
    (mode: 'everyone' | 'host') => ss.getState().setControlMode(socket, mode),
    [socket]
  );

  const transferHost = useCallback(
    (userId: number | string) => ss.getState().transferHost(socket, userId),
    [socket]
  );

  const setCoHost = useCallback(
    (userId: number | string, enabled: boolean) => ss.getState().setCoHost(socket, userId, enabled),
    [socket]
  );

  const muteMember = useCallback(
    (userId: number | string, enabled: boolean) =>
      ss.getState().muteMember(socket, userId, enabled),
    [socket]
  );

  const removeMember = useCallback(
    (userId: number | string) => ss.getState().removeMember(socket, userId),
    [socket]
  );

  const voteSkip = useCallback(() => ss.getState().voteSkip(socket), [socket]);

  const removeFromQueue = useCallback(
    (queueItemId: string) => ss.getState().removeFromQueue(socket, user, queueItemId),
    [socket, user]
  );

  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => ss.getState().reorderQueue(socket, fromIndex, toIndex),
    [socket]
  );

  const addPlaylistToQueue = useCallback(
    (songs: Song[]) => ss.getState().addPlaylistToQueue(socket, user, songs),
    [socket, user]
  );

  const clearQueue = useCallback(() => {
    ss.getState().clearQueue(socket, user);
  }, [socket, user]);

  const toggleAutoRecommendations = useCallback(
    (enabled?: boolean) => {
      ss.getState().toggleAutoRecommendations(socket, enabled);
    },
    [socket]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!groupId || !user) return;
      // The server sends reactions to everyone else in the room, so yours shows from here.
      showFloatingReaction(emoji, '');
      socket?.emit('song-reaction', {
        groupId,
        emoji,
        userId: user.userid,
        userName: user.name,
      });
    },
    [socket, groupId, user]
  );

  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      if (!groupId || !user || !messageId) return;
      socket?.emit('message-reaction', {
        groupId,
        messageId,
        emoji,
        userId: user.userid,
        userName: user.name,
      });
    },
    [socket, groupId, user]
  );

  const startTyping = useCallback(() => {
    if (!groupId || !user) return;
    socket?.emit('typing-start', { groupId, userId: user.userid, userName: user.name });
  }, [socket, groupId, user]);

  const stopTyping = useCallback(() => {
    if (!groupId || !user) return;
    socket?.emit('typing-stop', { groupId, userId: user.userid });
  }, [socket, groupId, user]);

  const sendInvite = useCallback(
    (inviteeUserId: number) => {
      const currentGroup = ss.getState().currentGroup;
      inv.getState().sendInvite(socket, user, currentGroup, inviteeUserId);
    },
    [socket, user]
  );

  const acceptInvite = useCallback(() => {
    const invite = inv.getState().pendingInvite;
    if (invite) {
      inv.getState().acceptInvite(socket, user, invite);
    }
  }, [socket, user]);

  const declineInvite = useCallback(() => {
    const invite = inv.getState().pendingInvite;
    if (invite) {
      inv.getState().declineInvite(socket, invite);
    }
  }, [socket]);

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
      playQueueItem,
      shuffleQueue,
      setControlMode,
      transferHost,
      setCoHost,
      muteMember,
      removeMember,
      voteSkip,
      removeFromQueue,
      reorderQueue,
      addPlaylistToQueue,
      clearQueue,
      toggleAutoRecommendations,
      sendReaction,
      reactToMessage,
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
      playQueueItem,
      shuffleQueue,
      setControlMode,
      transferHost,
      setCoHost,
      muteMember,
      removeMember,
      voteSkip,
      removeFromQueue,
      reorderQueue,
      addPlaylistToQueue,
      clearQueue,
      toggleAutoRecommendations,
      sendReaction,
      reactToMessage,
      startTyping,
      stopTyping,
      sendInvite,
      acceptInvite,
      declineInvite,
    ]
  );

  return <GroupMusicContext.Provider value={contextValue}>{children}</GroupMusicContext.Provider>;
}

export const useGroupMusic = () => {
  const context = useContext(GroupMusicContext);
  if (!context) {
    throw new Error('useGroupMusic must be used within a GroupMusicProvider');
  }
  return context;
};
