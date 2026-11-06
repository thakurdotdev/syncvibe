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
import {
  isNaturalGroupSongEnd,
  useGroupPlaybackStore,
  ROOM_ACTION_SETTLE_MS,
  ROOM_SYNC_INTERVAL_MS,
  noteRoomPlaybackStarted,
} from '@/stores/groupMusic/groupPlaybackStore';
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

export function GroupMusicProvider({ children }: { children: ReactNode }) {
  const { socket } = useChat();
  const { user } = useUser();
  const syncIntervalRef = useRef<any>(null);
  const hasAttemptedRejoin = useRef(false);

  const pb = useGroupPlaybackStore;
  const ss = useGroupSessionStore;
  const inv = useGroupInviteStore;

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
          // Sound has only just started, after however long it took to buffer: measure that now
          // rather than leaving this phone behind until the next regular check.
          const groupId = ss.getState().currentGroup?.id;
          if (groupId && socket) {
            setTimeout(() => socket.emit('request-sync', { groupId }), ROOM_ACTION_SETTLE_MS + 100);
          }
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

          // Only a genuine end-of-song advances the room (see isNaturalGroupSongEnd).
          if (state === PlaybackState.Ended && isNaturalGroupSongEnd()) {
            const currentGroup = ss.getState().currentGroup;
            if (currentGroup && socket && user) {
              ss.getState().skipSong(socket, user);
            }
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
  }, [socket]);

  // --- Time sync (only active when in a group session) ---
  useEffect(() => {
    if (!socket || !currentGroupId) return;

    // A disconnected socket queues what it's given and sends it all on reconnecting, by which
    // time these would be stale.
    const syncClock = () => {
      if (!socket.connected) return;
      socket.emit('time-sync-request', { clientTime: Date.now() });
    };
    const checkDrift = () => {
      if (!socket.connected) return;
      socket.emit('request-sync', { groupId: currentGroupId });
    };

    socket.on('time-sync-response', (data: { clientTime: number; serverTime: number }) => {
      pb.getState().processTimeSyncResponse(data.clientTime, data.serverTime);
    });

    // A quick burst on joining so the clock is accurate early, then a steady pace.
    syncClock();
    const burst = setInterval(syncClock, 1000);
    const settle = setTimeout(() => {
      clearInterval(burst);
      syncIntervalRef.current = setInterval(syncClock, 5000);
    }, 5000);
    const driftTimer = setInterval(checkDrift, ROOM_SYNC_INTERVAL_MS);
    // Timers can stall while the phone is in a pocket, so check as soon as it's back in hand.
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDrift();
    });

    return () => {
      clearInterval(burst);
      clearTimeout(settle);
      clearInterval(driftTimer);
      foreground.remove();
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      socket.off('time-sync-response');
    };
  }, [socket, currentGroupId]);

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

    socket.on('playback-update', async (data: any) => {
      await pb.getState().handlePlaybackUpdate(data);
    });

    socket.on('music-update', async (data: any) => {
      await pb.getState().handleMusicUpdate(data);
    });

    socket.on('queue-updated', (data: any) => {
      const { queue, currentQueueIndex } = data;
      ss.setState({ queue, currentQueueIndex });
    });

    socket.on('queue-error', ({ error }: { error: string }) => {
      Alert.alert('Queue Error', error);
    });

    socket.on('queue-ended', () => {
      pb.setState({ isPlaying: false });
      pb.getState().stopProgressPolling();
    });

    socket.on('sync-state', async (data: any) => {
      // This arrives every few seconds: only touch the queue if an update was actually missed,
      // so screens showing it don't re-render for nothing.
      const { queue, currentQueueIndex } = ss.getState();
      const sameQueue =
        data.currentQueueIndex === currentQueueIndex &&
        data.queue?.length === queue.length &&
        data.queue?.every((item: any, i: number) => item.id === queue[i]?.id);
      if (data.queue && !sameQueue) {
        ss.setState({ queue: data.queue, currentQueueIndex: data.currentQueueIndex });
      }
      await pb.getState().handleSyncState(data);
    });

    socket.on('group-created', (group: any) => {
      if (!user) return;
      ss.getState().handleGroupCreated(group, user, () => {
        inv.setState({ isInviteSheetOpen: true });
      });
    });

    const requestHistory = () => {
      const id = ss.getState().currentGroup?.id;
      if (id) socket.emit('get-chat-history', { groupId: id });
    };

    socket.on('group-joined', async (data: any) => {
      ss.getState().handleGroupJoined(data);
      requestHistory();
      if (data.playbackState) {
        await pb
          .getState()
          .syncPlaybackFromServer(
            data.playbackState,
            data.queue || [],
            data.currentQueueIndex ?? -1
          );
      }
    });

    socket.on('group-rejoined', async (data: any) => {
      ss.getState().handleGroupRejoined(data);
      requestHistory();
      if (data.playbackState) {
        await pb
          .getState()
          .syncPlaybackFromServer(
            data.playbackState,
            data.queue || [],
            data.currentQueueIndex ?? -1
          );
      }
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

    socket.on('sync-lost', (data: { groupId: string; reason: string }) => {
      if (!user || data.groupId !== ss.getState().currentGroup?.id) return;
      if (data.reason === 'not-in-room') {
        ss.getState().rejoinGroup(socket, user, data.groupId);
      } else {
        endRoomHere();
        Alert.alert('Room Ended', 'This room is no longer active.');
      }
    });

    // Left on another device.
    socket.on('left-group', (data: { groupId: string }) => {
      if (data.groupId === ss.getState().currentGroup?.id) endRoomHere();
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

    socket.on('invite-error', ({ message }: { message: string }) => {
      Alert.alert('Invite Error', message);
    });

    socket.on('invite-accepted', ({ userName }: { userName: string }) => {
      Alert.alert('Invite Accepted', `${userName} has joined the group!`);
    });

    socket.on('group-invite-declined', ({ userName }: { userName: string }) => {
      Alert.alert('Invite Declined', `${userName} declined the invite.`);
    });

    return () => {
      const events = [
        'playback-update',
        'music-update',
        'queue-updated',
        'queue-error',
        'queue-ended',
        'sync-state',
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
        'sync-lost',
        'left-group',
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
