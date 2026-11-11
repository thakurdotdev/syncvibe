import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSocket } from '@/Context/ChatContext';
import { useProfile } from '@/Context/Context';
import InviteNotification from '@/components/InviteNotification';
import UpgradeDialog from '@/components/UpgradeDialog';
import { useGroupInviteStore } from '@/stores/groupMusic/inviteStore';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { soundEffectsManager } from '@/lib/soundEffectsManager';
import { seedClock } from '@/stores/groupMusic/roomClock';
import { fetchRoomSnapshot, pingRoom } from '@/stores/groupMusic/roomProtocol';

/** Pings come quickly at first so the clock is accurate early, then settle to a steady pace. */
const PING_BURST_MS = 1000;
const PING_BURST_COUNT = 5;
const PING_STEADY_MS = 5000;
const AUDIO_PROMPT_ID = 'room-audio-blocked';

export const GroupMusicContext = createContext(null);

/**
 * Stable group actions for components that only need to *do* something (add to queue, play
 * next). Unlike GroupMusicContext, its value never changes, so consumers don't re-render on
 * every playback tick.
 */
const GroupMusicActionsContext = createContext(null);

export function GroupMusicProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useProfile();
  const navigate = useNavigate();

  const audioRef = useRef(null);
  const hasAttemptedRejoinRef = useRef(false);

  const playback = useGroupPlaybackStore();
  const session = useGroupSessionStore();
  const invite = useGroupInviteStore();

  useEffect(() => {
    if (audioRef.current) {
      useGroupPlaybackStore.getState().setAudioRef(audioRef.current);
    }
  }, []);

  useEffect(() => {
    if (playback.currentSong) {
      playback.updateMediaSession(
        playback.currentSong,
        (force) => playback.handlePlayPause(socket, session.currentGroup?.id, force),
        () => session.skipSong(socket, user)
      );
    }
  }, [playback.currentSong]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (useGroupSessionStore.getState().currentGroup) {
        e.preventDefault();
        e.returnValue = 'You are in a music group. Your session will be restored when you return.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeGroup = useGroupSessionStore.getState().currentGroup;
      if (!activeGroup) return;
      // Typing, or moving the cursor, in a field must never control the room.
      const focused = document.activeElement;
      if (focused?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused?.tagName))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === ' ') {
        e.preventDefault();
        playback.handlePlayPause(socket, activeGroup.id);
      }
      if (e.key === 'ArrowRight') {
        session.skipSong(socket, user);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [socket, user, playback, session]);

  // The room's clock, and a check that nothing was missed. Each ping refines this tab's idea of
  // the server's time and brings back the room's revisions; a mismatch means an update never
  // arrived, so the whole room is fetched again. Nothing else is polled.
  useEffect(() => {
    const groupId = session.currentGroup?.id;
    if (!socket || !groupId) return;

    const pb = useGroupPlaybackStore;
    const ss = useGroupSessionStore;
    pb.getState().setTransport(socket, groupId);
    let stopped = false;
    let resyncing = false;

    const resync = async () => {
      if (resyncing) return;
      resyncing = true;
      const snapshot = await fetchRoomSnapshot(socket, groupId);
      resyncing = false;
      if (stopped || !snapshot || snapshot.error || ss.getState().currentGroup?.id !== groupId)
        return;
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
        ss.getState().rejoinGroup(socket, user, groupId);
      } else if (reply.error === 'gone') {
        ss.getState().resetSession(() => pb.getState().reset());
        toast.error('This room is no longer active');
      } else if (reply.revs) {
        const { queueRev, metaRev } = ss.getState();
        const behind =
          reply.revs.playback > pb.getState().getPlaybackRev() ||
          reply.revs.queue > queueRev ||
          reply.revs.meta > metaRev;
        if (behind) resync();
      }
    };

    let sent = 0;
    let timer = null;
    const loop = () => {
      ping();
      sent += 1;
      timer = setTimeout(loop, sent < PING_BURST_COUNT ? PING_BURST_MS : PING_STEADY_MS);
    };
    loop();

    // Timers are slowed in a background tab, so check as soon as it's looked at again.
    const onVisible = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [socket, user, session.currentGroup?.id]);

  // Browsers won't start sound until the page has been clicked, which a reload hasn't been.
  useEffect(() => {
    if (!playback.needsGesture) {
      toast.dismiss(AUDIO_PROMPT_ID);
      return;
    }
    toast('Your browser paused the room audio', {
      id: AUDIO_PROMPT_ID,
      description: 'Click to listen along with everyone.',
      duration: Infinity,
      action: {
        label: 'Listen',
        onClick: () => useGroupPlaybackStore.getState().resumeAudio(),
      },
    });
  }, [playback.needsGesture]);

  useEffect(() => {
    if (!socket || !user?.userid) return;

    const handleSetupComplete = () => {
      // Every reconnect is a new connection the server hasn't put in the room yet.
      const inRoom = useGroupSessionStore.getState().currentGroup?.id;
      if (inRoom) {
        useGroupSessionStore.getState().rejoinGroup(socket, user, inRoom);
      } else if (!hasAttemptedRejoinRef.current) {
        const stored = useGroupSessionStore.getState().getStoredSession();
        if (stored?.groupId) {
          hasAttemptedRejoinRef.current = true;
          useGroupSessionStore.getState().rejoinGroup(socket, user, stored.groupId);
        }
      }
      socket.emit('get-pending-invites');
    };

    // Music plays on while the connection is down, so show that it's out of step for now.
    const handleDisconnect = () => {
      if (useGroupSessionStore.getState().currentGroup) {
        useGroupSessionStore.setState({ isRejoining: true });
      }
    };

    socket.on('setup-complete', handleSetupComplete);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('setup-complete', handleSetupComplete);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!socket) return;

    const getGroupId = () => useGroupSessionStore.getState().currentGroup?.id;
    const pb = useGroupPlaybackStore;
    const ss = useGroupSessionStore;
    const inv = useGroupInviteStore;

    const inThisRoom = (data) => Boolean(data?.groupId) && data.groupId === getGroupId();

    // The room's three parts. Each message carries the whole part and its revision.
    socket.on('room:playback', (data) => {
      if (!inThisRoom(data)) return;
      seedClock(data.serverTime);
      if (!pb.getState().applyPlayback(data, data.kind)) return;
      ss.getState().applyCurrentItem(data.item);

      if (data.kind === 'track' && data.item) {
        const addedBy = data.item.addedBy;
        const credit =
          addedBy?.userName && addedBy.userId !== 'system' ? ` (added by ${addedBy.userName})` : '';
        toast.info(`Now playing: ${data.item.song?.name}${credit}`);
      } else if (data.kind === 'stop') {
        toast.info('Queue ended');
      }
    });

    socket.on('room:queue', (data) => {
      if (!inThisRoom(data) || !ss.getState().applyQueuePart(data)) return;
      pb.getState().preloadUpcoming(data.upcoming);

      const byOther = data.by && String(data.by.userId) !== String(user?.userid);
      if (data.action === 'remove') toast.info('Song removed from queue');
      else if (data.action === 'clear') toast.info('Upcoming queue cleared');
      else if (data.action === 'shuffle') toast.info('Queue shuffled');
      else if (data.action === 'skip') toast.info('Skipped to next song');
      else if (data.action === 'auto-recs')
        toast.success(`Auto-added ${data.addedCount || ''} recommended songs`);
      else if (byOther && data.action === 'add' && data.item)
        toast.info(`${data.by.userName} added ${data.item.song?.name}`);
    });

    socket.on('room:meta', (data) => {
      if (inThisRoom(data)) ss.getState().applyMetaPart(data);
    });

    /** Joining hands over the whole room; the audio then lines up with it. */
    const enterRoom = (sync) => {
      if (!sync) return;
      seedClock(sync.serverTime);
      pb.getState().applyPlayback(sync.playback, 'join', { force: true });
      pb.getState().preloadUpcoming(sync.queue?.upcoming);
    };

    socket.on('group-created', (group) => {
      ss.getState().handleGroupCreated(group, user, (v) => inv.setState({ isInviteSheetOpen: v }));
      enterRoom(group?.sync);
    });

    socket.on('group-joined', (data) => {
      ss.getState().handleGroupJoined(data);
      ss.getState().requestChatHistory(socket, data?.group?.id);
      enterRoom(data?.sync);
    });

    // The song already loaded keeps playing through a reconnect; only its position is corrected.
    socket.on('group-rejoined', (data) => {
      ss.getState().handleGroupRejoined(data);
      ss.getState().requestChatHistory(socket, data?.group?.id);
      enterRoom(data?.sync);
    });

    socket.on('group-not-found', () => {
      ss.setState({ isRejoining: false });
      ss.getState().clearSession();
      // Rejoining a room that ended while the connection was down: don't stay in a phantom one.
      if (ss.getState().currentGroup) ss.getState().resetSession(() => pb.getState().reset());
      toast.error('The group no longer exists');
    });

    // You moved to another device or tab, which now plays the room. Rejoining would just take it back.
    socket.on('device-replaced', ({ groupId }) => {
      const { currentGroup, isRejoining } = ss.getState();
      if (currentGroup && currentGroup.id !== groupId) return;
      ss.setState({ isRejoining: false });
      ss.getState().clearSession();
      if (currentGroup) ss.getState().resetSession(() => pb.getState().reset());
      if (currentGroup || isRejoining) {
        toast.info('Playing on your other device now. Choose Play here to bring it back.');
      }
    });

    // Left on another device, or a host removed you.
    socket.on('left-group', ({ groupId, removed }) => {
      if (groupId !== getGroupId()) return;
      ss.getState().resetSession(() => pb.getState().reset());
      if (removed) toast.info('A host removed you from the room');
    });

    socket.on('join-refused', ({ message }) => {
      ss.setState({ isRejoining: false });
      ss.getState().clearSession();
      if (ss.getState().currentGroup) ss.getState().resetSession(() => pb.getState().reset());
      toast.error(message || 'You can’t join this room');
    });

    socket.on('chat-blocked', ({ groupId, message }) => {
      if (groupId === getGroupId()) toast.error(message);
    });

    socket.on('member-presence', ({ userId, connected }) => {
      ss.setState((state) => ({
        groupMembers: state.groupMembers.map((m) =>
          String(m.userId) === String(userId) ? { ...m, connected } : m
        ),
      }));
    });

    socket.on('member-joined', (member) => {
      ss.setState((state) => {
        if (state.groupMembers.find((m) => String(m.userId) === String(member.userId)))
          return state;
        return { groupMembers: [...state.groupMembers, member] };
      });
      toast.info(`${member.userName} joined the group`);
    });

    socket.on('member-left', ({ userId }) => {
      if (!userId) return;
      const members = ss.getState().groupMembers;
      const member = members.find((m) => String(m.userId) === String(userId));
      if (member) toast.info(`${member.userName} left the group`);
      ss.setState({ groupMembers: members.filter((m) => String(m.userId) !== String(userId)) });
    });

    socket.on('group-disbanded', () => {
      ss.getState().resetSession(() => pb.getState().reset());
      toast.info('Group disbanded');
    });

    // Chat history for late joiners / rejoin (servers without this feature never reply).
    socket.on('chat-history', ({ groupId, messages } = {}) => {
      ss.getState().mergeChatHistory(groupId, messages);
    });

    socket.on('message-reaction', (data) => {
      if (data?.messageId) ss.getState().applyMessageReaction(data);
    });

    socket.on('new-message', (message) => {
      // Append incoming message to group chat messages store
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

        // Auto-play incoming sound effect if enabled by user
        const isSfxAutoPlay =
          typeof window !== 'undefined'
            ? localStorage.getItem('syncvibe_sfx_autoplay') !== 'false'
            : true;
        if (isSfxAutoPlay) {
          soundEffectsManager.playRoomEffect(message.soundUrl);
        }
      }

      // Notify only when user is not in this tab or is focused in another app
      const isTabInactive =
        typeof document !== 'undefined' &&
        (document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus()));

      if (
        isTabInactive &&
        message.type !== 'activity' &&
        message.senderId !== user?.userid &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const bodyText =
            message.messageType === 'gif'
              ? 'Sent a GIF / Media'
              : message.messageType === 'sound'
                ? `Sent sound effect: ${message.soundName || 'Sound Effect'}`
                : message.message || 'Sent a message';

          const notification = new Notification(message.userName || 'SyncVibe Group Chat', {
            body: bodyText,
            icon: message.profilePic || '/favicon.ico',
            tag: 'syncvibe-group-chat',
            renotify: true,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (err) {
          console.error('Error displaying notification:', err);
        }
      }
    });

    socket.on('group-full', ({ maxMembers, message }) => {
      ss.setState({
        upgradeDialog: {
          open: true,
          feature: 'groupMembers',
          message: message || `Group is full (${maxMembers} members max)`,
        },
      });
    });

    socket.on('feature-locked', ({ feature, message }) => {
      ss.setState({
        upgradeDialog: {
          open: true,
          feature: feature || 'default',
          message: message || 'This feature requires PRO plan',
        },
      });
    });

    socket.on('group-invite-received', (inviteData) => {
      if (ss.getState().currentGroup) return;
      inv.setState({ pendingInvite: inviteData });

      const isTabInactive =
        typeof document !== 'undefined' &&
        (document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus()));

      if (
        isTabInactive &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const notification = new Notification('SyncVibe Group Invite', {
            body: `${inviteData.inviterName || 'Someone'} invited you to join a music group`,
            icon: inviteData.inviterProfilePic || '/favicon.ico',
            tag: 'syncvibe-group-invite',
            renotify: true,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (err) {
          console.error('Error displaying invite notification:', err);
        }
      }
    });

    socket.on('invite-sent', () => toast.success('Invite sent!'));
    socket.on('invite-error', ({ error }) => toast.error(error));
    socket.on('invite-accepted', ({ userName }) =>
      toast.success(`${userName} accepted the invite!`)
    );
    socket.on('group-invite-declined', () => toast.info('Invite was declined'));

    socket.on('song-reaction', (data) => {
      ss.setState((state) => ({
        floatingReactions: [...state.floatingReactions.slice(-20), data],
      }));
    });

    const typingTimers = {};
    socket.on('user-typing', (data) => {
      const { userId: typingUserId, userName, isTyping } = data;
      if (!isTyping) {
        ss.setState((state) => {
          const next = { ...state.typingUsers };
          delete next[typingUserId];
          return { typingUsers: next };
        });
        if (typingTimers[typingUserId]) {
          clearTimeout(typingTimers[typingUserId]);
          delete typingTimers[typingUserId];
        }
        return;
      }
      ss.setState((state) => ({
        typingUsers: { ...state.typingUsers, [typingUserId]: userName },
      }));
      if (typingTimers[typingUserId]) clearTimeout(typingTimers[typingUserId]);
      typingTimers[typingUserId] = setTimeout(() => {
        ss.setState((state) => {
          const next = { ...state.typingUsers };
          delete next[typingUserId];
          return { typingUsers: next };
        });
        delete typingTimers[typingUserId];
      }, 3000);
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
        'left-group',
        'join-refused',
        'chat-blocked',
        'device-replaced',
        'member-presence',
        'member-joined',
        'member-left',
        'group-disbanded',
        'new-message',
        'chat-history',
        'message-reaction',
        'group-full',
        'feature-locked',
        'group-invite-received',
        'invite-sent',
        'invite-error',
        'invite-accepted',
        'group-invite-declined',
        'song-reaction',
        'user-typing',
      ];
      events.forEach((e) => socket.off(e));
      Object.values(typingTimers).forEach(clearTimeout);
    };
  }, [socket, user]);

  const currentQueueItem = useMemo(
    () => session.getCurrentQueueItem(),
    [session.queue, session.currentQueueIndex]
  );
  const upcomingQueue = useMemo(
    () => session.getUpcomingQueue(),
    [session.queue, session.currentQueueIndex]
  );
  const playedQueue = useMemo(
    () => session.getPlayedQueue(),
    [session.queue, session.currentQueueIndex]
  );

  const wrappedHandlePlayPause = useCallback(
    (forceState) => playback.handlePlayPause(socket, session.currentGroup?.id, forceState),
    [socket, session.currentGroup?.id]
  );

  const wrappedHandleSeek = useCallback(
    (value) => playback.handleSeek(socket, session.currentGroup?.id, value),
    [socket, session.currentGroup?.id]
  );

  const wrappedCreateGroup = useCallback(
    (name) => session.createGroup(socket, user, name),
    [socket, user]
  );

  const wrappedJoinGroup = useCallback(
    (groupId) => session.joinGroup(socket, user, groupId),
    [socket, user]
  );

  const wrappedRejoinGroup = useCallback(
    (groupId) => session.rejoinGroup(socket, user, groupId),
    [socket, user]
  );

  const wrappedLeaveGroup = useCallback(
    () => session.leaveGroup(socket, user, () => useGroupPlaybackStore.getState().reset()),
    [socket, user]
  );

  const wrappedSendMessage = useCallback(
    (msg, messageType, extra) => session.sendMessage(socket, user, msg, messageType, extra),
    [socket, user, session]
  );

  const wrappedSendMessageReaction = useCallback(
    (messageId, emoji) => session.sendMessageReaction(socket, messageId, emoji),
    [socket]
  );

  const wrappedAddToQueue = useCallback(
    (song) => session.addToQueue(socket, user, song),
    [socket, user]
  );

  const wrappedPlayNow = useCallback((song) => session.playNow(socket, user, song), [socket, user]);

  const wrappedPlayNext = useCallback(
    (song) => session.playNext(socket, user, song),
    [socket, user]
  );

  const wrappedRemoveFromQueue = useCallback(
    (id) => session.removeFromQueue(socket, user, id),
    [socket, user]
  );

  const wrappedSkipSong = useCallback(() => session.skipSong(socket, user), [socket, user]);

  const wrappedPlayQueueItem = useCallback(
    (itemId) => useGroupSessionStore.getState().playQueueItem(socket, itemId),
    [socket]
  );

  const wrappedShuffleQueue = useCallback(
    () => useGroupSessionStore.getState().shuffleQueue(socket),
    [socket]
  );

  const wrappedSetControlMode = useCallback(
    (mode) => useGroupSessionStore.getState().setControlMode(socket, mode),
    [socket]
  );

  const wrappedTransferHost = useCallback(
    (userId) => useGroupSessionStore.getState().transferHost(socket, userId),
    [socket]
  );

  const wrappedSetCoHost = useCallback(
    (userId, enabled) => useGroupSessionStore.getState().setCoHost(socket, userId, enabled),
    [socket]
  );

  const wrappedMuteMember = useCallback(
    (userId, enabled) => useGroupSessionStore.getState().muteMember(socket, userId, enabled),
    [socket]
  );

  const wrappedRemoveMember = useCallback(
    (userId) => useGroupSessionStore.getState().removeMember(socket, userId),
    [socket]
  );

  const wrappedVoteSkip = useCallback(
    () => useGroupSessionStore.getState().voteSkip(socket),
    [socket]
  );

  const myId = user?.userid != null ? String(user.userid) : null;
  /** The owner: changes the room's settings and makes co-hosts. */
  const isHost = myId != null && String(session.currentGroup?.createdBy) === myId;
  const coHosts = session.currentGroup?.coHosts;
  const isCoHost = myId != null && Boolean(coHosts?.includes(myId));
  /** The host or a co-host. */
  const canManage = isHost || isCoHost;
  const isMuted = myId != null && Boolean(session.currentGroup?.mutedIds?.includes(myId));
  const controlMode = session.currentGroup?.settings?.controlMode || 'everyone';
  /** Whether this person may play, pause, seek, skip and rearrange. Anyone can add songs. */
  const canControl = controlMode !== 'host' || canManage;
  const rawSkipVotes = session.currentGroup?.skipVotes;
  const currentItemId = session.currentItem?.id;
  /** Votes to skip the song playing, for people who can't skip it themselves. */
  const skipVote = useMemo(() => {
    const live = rawSkipVotes?.itemId === currentItemId ? rawSkipVotes : null;
    return {
      count: live?.userIds?.length ?? 0,
      needed: live?.needed ?? null,
      voted: Boolean(myId && live?.userIds?.includes(myId)),
    };
  }, [rawSkipVotes, currentItemId, myId]);

  const wrappedReorderQueue = useCallback(
    (from, to) => session.reorderQueue(socket, from, to),
    [socket]
  );

  const wrappedClearQueue = useCallback(() => session.clearQueue(socket, user), [socket, user]);

  const wrappedToggleAutoRecommendations = useCallback(
    (enabled) => session.toggleAutoRecommendations(socket, enabled),
    [socket]
  );

  const wrappedAddPlaylistToQueue = useCallback(
    (songs) => session.addPlaylistToQueue(socket, user, songs),
    [socket, user]
  );

  const wrappedAcceptInvite = useCallback(
    (inv) => invite.acceptInvite(socket, user, inv, navigate),
    [socket, user, navigate]
  );

  const wrappedDeclineInvite = useCallback((inv) => invite.declineInvite(socket, inv), [socket]);

  const wrappedSendInvite = useCallback(
    (userId) => invite.sendInvite(socket, user, session.currentGroup, userId),
    [socket, user, session.currentGroup]
  );

  const wrappedSendReaction = useCallback(
    (emoji) => {
      if (!socket || !session.currentGroup?.id || !user) return;
      if (isMuted) {
        toast.error('A host has muted you in this room');
        return;
      }
      const reactionData = {
        groupId: session.currentGroup.id,
        emoji,
        userName: user.name,
      };
      socket.emit('song-reaction', reactionData);
      useGroupSessionStore.setState((state) => ({
        floatingReactions: [
          ...state.floatingReactions.slice(-20),
          {
            ...reactionData,
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          },
        ],
      }));
    },
    [socket, session.currentGroup?.id, user, isMuted]
  );

  const latestActionsRef = useRef(null);
  useLayoutEffect(() => {
    latestActionsRef.current = {
      addToQueue: wrappedAddToQueue,
      playNext: wrappedPlayNext,
      addPlaylistToQueue: wrappedAddPlaylistToQueue,
    };
  });
  const stableActions = useMemo(
    () => ({
      addToQueue: (...args) => latestActionsRef.current.addToQueue(...args),
      playNext: (...args) => latestActionsRef.current.playNext(...args),
      addPlaylistToQueue: (...args) => latestActionsRef.current.addPlaylistToQueue(...args),
    }),
    []
  );

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

    connectionQuality: playback.connectionQuality,
    syncStatus: playback.syncStatus,
    outputOffsetMs: playback.outputOffsetMs,
    setOutputOffset: playback.setOutputOffset,
    isHost,
    isCoHost,
    canManage,
    isMuted,
    canControl,
    controlMode,
    skipVote,
    voteSkip: wrappedVoteSkip,
    setControlMode: wrappedSetControlMode,
    transferHost: wrappedTransferHost,
    setCoHost: wrappedSetCoHost,
    muteMember: wrappedMuteMember,
    removeMember: wrappedRemoveMember,

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
    playQueueItem: wrappedPlayQueueItem,
    shuffleQueue: wrappedShuffleQueue,
    reorderQueue: wrappedReorderQueue,
    clearQueue: wrappedClearQueue,
    addPlaylistToQueue: wrappedAddPlaylistToQueue,
    toggleAutoRecommendations: wrappedToggleAutoRecommendations,
    autoPlayRecommendations: session.currentGroup?.settings?.autoPlayRecommendations !== false,

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
    sendMessageReaction: wrappedSendMessageReaction,
    typingUsers: session.typingUsers,
    onTypingStart: () => {
      if (!socket || !session.currentGroup?.id) return;
      socket.emit('typing-start', { groupId: session.currentGroup.id, userName: user?.name });
    },
    onTypingStop: () => {
      if (!socket || !session.currentGroup?.id) return;
      socket.emit('typing-stop', { groupId: session.currentGroup.id });
    },
  };

  return (
    <GroupMusicContext.Provider value={contextValue}>
      <GroupMusicActionsContext.Provider value={stableActions}>
        {children}
      </GroupMusicActionsContext.Provider>
      <audio ref={audioRef} />
      <UpgradeDialog
        open={session?.upgradeDialog?.open}
        onOpenChange={(open) =>
          useGroupSessionStore.setState((s) => ({ upgradeDialog: { ...s.upgradeDialog, open } }))
        }
        feature={session?.upgradeDialog?.feature}
        customMessage={session?.upgradeDialog?.message}
      />
      <InviteNotification
        invite={invite.pendingInvite}
        onAccept={wrappedAcceptInvite}
        onDecline={wrappedDeclineInvite}
      />
    </GroupMusicContext.Provider>
  );
}

/** Stable `{ addToQueue, playNext, addPlaylistToQueue }` — safe to use in long lists. */
export const useGroupMusicActions = () => {
  const actions = useContext(GroupMusicActionsContext);
  if (!actions) {
    throw new Error('useGroupMusicActions must be used within a GroupMusicProvider');
  }
  return actions;
};

/** Narrow, re-render-friendly reads of the current room. */
export const useCurrentGroup = () => useGroupSessionStore((s) => s.currentGroup);

export const useGroupMusic = () => {
  const context = useContext(GroupMusicContext);
  if (!context) {
    throw new Error('useGroupMusic must be used within a GroupMusicProvider');
  }
  return context;
};
