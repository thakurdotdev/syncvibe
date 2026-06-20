import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import TrackPlayer, { Event, State, useTrackPlayerEvents } from 'react-native-track-player';
import { Song } from '@/types/song';
import { useChat } from './SocketContext';
import { useUser } from './UserContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';

interface GroupMusicContextType {
  socket: any;
  user: any;

  handlePlayPause: (forceState?: boolean) => Promise<void>;
  handleSeek: (value: number) => Promise<void>;
  createGroup: (groupName: string) => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: () => void;
  sendMessage: (message: string) => void;
  addToQueue: (song: Song) => void;
  playNow: (song: Song) => void;
  skipSong: () => void;
  removeFromQueue: (queueItemId: string) => void;
}

const GroupMusicContext = createContext<GroupMusicContextType | null>(null);

export function GroupMusicProvider({ children }: { children: ReactNode }) {
  const { socket } = useChat();
  const { user } = useUser();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pb = useGroupPlaybackStore;
  const ss = useGroupSessionStore;

  useEffect(() => {
    pb.getState().initTrackPlayer();
    return () => {
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

  useTrackPlayerEvents(
    [Event.PlaybackState, Event.PlaybackError, Event.PlaybackQueueEnded],
    async (event) => {
      try {
        switch (event.type) {
          case Event.PlaybackState: {
            const state = event.state;
            if (state === State.Playing) {
              pb.setState({ isPlaying: true });
              pb.getState().startProgressPolling();
            } else if (state === State.Paused || state === State.Stopped) {
              pb.setState({ isPlaying: false });
              pb.getState().stopProgressPolling();
            }
            break;
          }

          case Event.PlaybackError:
            console.error('Playback error:', event.message);
            Alert.alert('Playback Error', 'An error occurred during playback.');
            pb.setState({ isPlaying: false });
            pb.getState().stopProgressPolling();
            break;

          case Event.PlaybackQueueEnded: {
            const groupId = ss.getState().currentGroup?.id;
            const currentItem = ss.getState().getCurrentQueueItem();

            if (groupId && currentItem) {
              socket?.emit('song-ended', {
                groupId,
                songId: currentItem.id,
              });
            }

            pb.setState({ isPlaying: false });
            pb.getState().stopProgressPolling();
            break;
          }
        }
      } catch (error) {
        console.error('Error handling TrackPlayer event:', error);
      }
    }
  );

  useEffect(() => {
    if (!socket) return;

    const syncWithServer = () => {
      socket.emit('time-sync-request', { clientTime: Date.now() });
    };

    socket.on('time-sync-response', (data: { clientTime: number; serverTime: number }) => {
      pb.getState().processTimeSyncResponse(data.clientTime, data.serverTime);
    });

    syncWithServer();
    syncIntervalRef.current = setInterval(syncWithServer, 5000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      socket.off('time-sync-response');
    };
  }, [socket]);

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
      if (data.queue) {
        ss.setState({ queue: data.queue, currentQueueIndex: data.currentQueueIndex });
      }
      if (data.playbackState?.currentTrack) {
        await pb.getState().handleMusicUpdate({
          song: data.playbackState.currentTrack,
          currentTime: data.playbackState.currentTime,
          serverTime: data.playbackState.serverTime,
        });
      }
    });

    socket.on('group-created', (group: any) => {
      if (!user) return;
      ss.getState().handleGroupCreated(group, user);
    });

    socket.on('group-joined', async (data: any) => {
      ss.getState().handleGroupJoined(data);
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

    socket.on('member-joined', (member: any) => {
      ss.setState((state) => {
        if (state.groupMembers.find((m) => m.userId === member.userId)) return state;
        return { groupMembers: [...state.groupMembers, member] };
      });
    });

    socket.on('member-left', ({ userId }: { userId: number }) => {
      if (!userId) return;
      ss.setState((state) => ({
        groupMembers: state.groupMembers.filter((m) => m.userId !== userId),
      }));
    });

    socket.on('group-disbanded', () => {
      ss.getState().resetSession(() => pb.getState().reset());
      Alert.alert('Info', 'Group disbanded');
    });

    socket.on('new-message', (message: any) => {
      ss.setState((state) => ({ messages: [...state.messages, message] }));
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
        'member-joined',
        'member-left',
        'group-disbanded',
        'new-message',
      ];
      events.forEach((e) => socket.off(e));
    };
  }, [socket, user]);

  const groupId = ss((s) => s.currentGroup?.id);

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
    (message: string) => ss.getState().sendMessage(socket, user, message),
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

  const skipSong = useCallback(
    () => ss.getState().skipSong(socket, user),
    [socket, user]
  );

  const removeFromQueue = useCallback(
    (queueItemId: string) => ss.getState().removeFromQueue(socket, user, queueItemId),
    [socket, user]
  );

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
      skipSong,
      removeFromQueue,
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
      skipSong,
      removeFromQueue,
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
