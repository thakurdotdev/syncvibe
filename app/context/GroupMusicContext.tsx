import { searchSongs } from '@/utils/api/getSongs';
import { useDebounce } from '@/utils/hooks/useDebounce';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import TrackPlayer, { Event, State, useTrackPlayerEvents } from 'react-native-track-player';
import { Song } from '../types/song';
import { setupPlayer } from '../utils/playerSetup';
import { useChat } from './SocketContext';
import { useUser } from './UserContext';

interface GroupMember {
  groupId: string;
  userId: number;
  userName: string;
  profilePic: string;
}

interface Group {
  id: string;
  name: string;
  createdBy: number;
  qrCode?: string;
}

interface Message {
  id: string;
  groupId: string;
  senderId: number;
  profilePic: string;
  userName: string;
  message: string;
  timestamp: number;
}

interface GroupMusicContextType {
  // States
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  isPlaying: boolean;
  groupMembers: GroupMember[];
  setGroupMembers: (members: GroupMember[]) => void;
  searchResults: Song[];
  setSearchResults: (results: Song[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentSong: Song | null;
  setCurrentSong: (song: Song | null) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (isOpen: boolean) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  serverTimeOffset: number;
  setServerTimeOffset: (offset: number) => void;
  lastSync: number;
  setLastSync: (time: number) => void;
  isGroupModalOpen: boolean;
  setIsGroupModalOpen: (isOpen: boolean) => void;
  isSearchLoading: boolean;
  setIsSearchLoading: (isLoading: boolean) => void;

  // Functions
  handlePlayPause: (forceState?: boolean) => Promise<void>;
  handleSeek: (value: number) => void;
  selectSong: (song: Song) => Promise<void>;
  debouncedSearch: (query: string) => void;
  createGroup: (groupName: string) => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: () => void;
  sendMessage: (message: string) => void;
}

export const GroupMusicContext = createContext<GroupMusicContextType | null>(null);

interface GroupMusicProviderProps {
  children: ReactNode;
}

export function GroupMusicProvider({ children }: GroupMusicProviderProps) {
  const { socket } = useChat();
  const { user } = useUser();
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [lastSync, setLastSync] = useState(0);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlaybackUpdateRef = useRef<number | null>(null);
  const trackPlayerInitialized = useRef(false);

  useEffect(() => {
    const initPlayer = async () => {
      try {
        const isSetup = await setupPlayer();
        trackPlayerInitialized.current = isSetup;
        console.log('TrackPlayer initialization status:', isSetup);
      } catch (error) {
        console.error('Error initializing TrackPlayer:', error);
      }
    };

    initPlayer();

    return () => {
      if (trackPlayerInitialized.current) {
        TrackPlayer.reset();
      }
    };
  }, []);

  const getServerTime = useCallback(() => {
    return Date.now() + serverTimeOffset;
  }, [serverTimeOffset]);

  const updateMediaSession = useCallback((song: Song) => {
    if (!song) return;

    // Setup metadata for notification controls
    TrackPlayer.updateNowPlayingMetadata({
      title: song.name,
      artist:
        song?.artist_map?.artists
          ?.slice(0, 3)
          ?.map((artist: any) => artist.name)
          .join(', ') || 'Unknown Artist',
      album: song?.album || 'Unknown Album',
      artwork: song.image?.[2]?.link || '',
    });
  }, []);

  useEffect(() => {
    if (currentSong) {
      updateMediaSession(currentSong);
    }
  }, [currentSong, updateMediaSession]);

  // Track Player Events
  useTrackPlayerEvents(
    [
      Event.PlaybackState,
      Event.PlaybackError,
      Event.PlaybackActiveTrackChanged,
      Event.PlaybackQueueEnded,
    ],
    async (event) => {
      try {
        switch (event.type) {
          case Event.PlaybackState:
            const state = event.state;
            if (state === State.Playing) {
              setIsPlaying(true);
            } else if (state === State.Paused || state === State.Stopped) {
              setIsPlaying(false);
            }
            break;

          case Event.PlaybackError:
            console.error('Playback error:', event.message);
            Alert.alert('Playback Error', 'An error occurred during playback.');
            setIsPlaying(false);
            break;

          case Event.PlaybackQueueEnded:
            setIsPlaying(false);
            if (currentGroup?.id) {
              socket?.emit('music-playback', {
                groupId: currentGroup.id,
                isPlaying: false,
                currentTime: 0,
                scheduledTime: getServerTime() + 100,
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error handling TrackPlayer event:', error);
      }
    }
  );

  const convertSongToTrack = (song: Song) => {
    return {
      id: song.id,
      url: song.download_url?.find((url) => url.quality === '320kbps')?.link || '',
      title: song.name || 'Unknown Title',
      artist: song?.artist_map?.artists?.[0]?.name || 'Unknown Artist',
      album: song.album || 'Unknown Album',
      artwork: song.image?.[2]?.link || song.image?.[1]?.link || '',
      duration: song.duration || 0,
    };
  };

  const handlePlayPause = async (forceState?: boolean) => {
    if (!trackPlayerInitialized.current || !currentSong) return;

    const newIsPlaying = typeof forceState === 'boolean' ? forceState : !isPlaying;
    const currentAudioTime = await TrackPlayer.getProgress().then((progress) => progress.position);

    try {
      const scheduledTime = getServerTime() + 300;

      socket?.emit('music-playback', {
        groupId: currentGroup?.id,
        isPlaying: newIsPlaying,
        currentTime: currentAudioTime,
        scheduledTime,
      });

      const executePlayback = async () => {
        if (newIsPlaying) {
          try {
            await TrackPlayer.play();
          } catch (err) {
            console.error('Error playing audio:', err);
          }
        } else {
          await TrackPlayer.pause();
        }
        setIsPlaying(newIsPlaying);
      };

      const delay = Math.max(0, scheduledTime - getServerTime());
      setTimeout(executePlayback, delay);
    } catch (error) {
      console.error('Playback control error:', error);
    }
  };

  const handleSeek = async (value: number) => {
    if (!trackPlayerInitialized.current) return;

    const scheduledTime = getServerTime() + 300;

    socket?.emit('music-seek', {
      groupId: currentGroup?.id,
      currentTime: value,
      scheduledTime,
      isPlaying,
    });

    await TrackPlayer.seekTo(value);
  };

  const selectSong = async (song: Song) => {
    try {
      setIsLoading(true);
      setCurrentSong(song);
      setIsPlaying(false);

      if (trackPlayerInitialized.current) {
        await TrackPlayer.reset();

        const track = convertSongToTrack(song);
        await TrackPlayer.add([track]);
      }

      socket?.emit('music-change', {
        groupId: currentGroup?.id,
        song,
        currentTime: 0,
        scheduledTime: Date.now() + serverTimeOffset + 300,
      });

      setIsSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to load song:', error);
      Alert.alert('Error', 'Failed to load song');
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    useDebounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearchLoading(true);
        const response = await searchSongs(query);
        setSearchResults(response);
      } catch (error) {
        console.error('Search failed:', error);
        Alert.alert('Error', 'Search failed. Please try again.');
      } finally {
        setIsSearchLoading(false);
      }
    }, 500),
    []
  );

  const createGroup = (groupName: string) => {
    if (!groupName.trim() || !user) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    socket?.emit('create-music-group', {
      name: groupName,
      createdBy: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
    setIsGroupModalOpen(false);
  };

  const joinGroup = (groupId: string) => {
    if (!groupId.trim() || !user) return;

    socket?.emit('join-music-group', {
      groupId,
      userId: user.userid,
      userName: user.name,
      profilePic: user.profilepic,
    });
    setIsGroupModalOpen(false);
  };

  const leaveGroup = () => {
    if (!currentGroup || !user) return;

    socket?.emit('leave-group', {
      groupId: currentGroup.id,
      userId: user.userid,
    });

    if (trackPlayerInitialized.current) {
      TrackPlayer.reset();
    }

    setCurrentGroup(null);
    setCurrentSong(null);
    setIsPlaying(false);
    setMessages([]);
    setGroupMembers([]);
    Alert.alert('Info', `Left group ${currentGroup.name}`);
  };

  const sendMessage = (message: string) => {
    if (!message.trim() || !currentGroup?.id || !user) return;

    socket?.emit('chat-message', {
      groupId: currentGroup.id,
      senderId: user.userid,
      profilePic: user.profilepic,
      userName: user.name,
      message,
    });
  };

  // Socket listeners for time synchronization
  useEffect(() => {
    if (socket) {
      const syncWithServer = () => {
        const startTime = Date.now();
        socket.emit('time-sync-request', { clientTime: startTime });
      };

      socket.on('time-sync-response', (data) => {
        const endTime = Date.now();
        const roundTripTime = endTime - data.clientTime;
        const serverTime = data.serverTime + roundTripTime / 2;
        setServerTimeOffset(serverTime - endTime);
        setLastSync(endTime);
      });

      // Sync every 5 seconds
      syncWithServer();
      syncIntervalRef.current = setInterval(syncWithServer, 5000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [socket]);

  // Socket listeners for music synchronization
  useEffect(() => {
    if (!socket) return;

    socket.on('playback-update', async (data) => {
      const serverNow = getServerTime();
      lastPlaybackUpdateRef.current = serverNow;
      const { isPlaying: newIsPlaying, currentTime: newTime, scheduledTime } = data;
      const timeUntilPlay = Math.max(0, scheduledTime - serverNow);

      if (trackPlayerInitialized.current) {
        await TrackPlayer.seekTo(newTime);

        if (newIsPlaying) {
          setTimeout(async () => {
            await TrackPlayer.play();
            setIsPlaying(true);
          }, timeUntilPlay);
        } else {
          await TrackPlayer.pause();
          setIsPlaying(false);
        }
      }

      setLastSync(serverNow);
    });

    socket.on('music-update', async ({ song, currentTime, scheduledTime }) => {
      setCurrentSong(song);
      setIsLoading(true);

      try {
        if (trackPlayerInitialized.current) {
          await TrackPlayer.reset();
          const track = convertSongToTrack(song);
          await TrackPlayer.add([track]);

          const timeUntilPlay = scheduledTime - getServerTime();

          setTimeout(
            async () => {
              await TrackPlayer.seekTo(currentTime);
              if (isPlaying) {
                await TrackPlayer.play();
              }
              setIsLoading(false);
            },
            Math.max(0, timeUntilPlay)
          );
        }
      } catch (error) {
        console.error('Error loading song:', error);
        setIsLoading(false);
      }
    });

    socket.on('group-created', (group) => {
      if (!group || !user) return;
      setCurrentGroup(group);
      setGroupMembers([
        {
          groupId: group.id,
          userId: user.userid,
          userName: user.name,
          profilePic: user.profilepic,
        },
      ]);
    });

    socket.on('group-joined', (data) => {
      const { group, members, playbackState } = data;
      setCurrentGroup(group);
      setGroupMembers(members);

      if (playbackState.currentTrack) {
        setCurrentSong(playbackState.currentTrack);

        // Set up the track
        if (trackPlayerInitialized.current) {
          (async () => {
            try {
              await TrackPlayer.reset();
              const track = convertSongToTrack(playbackState.currentTrack);
              await TrackPlayer.add([track]);

              // Sync playback position
              const serverNow = getServerTime();
              const timePassed = (serverNow - playbackState.lastUpdate) / 1000;
              const syncedTime = playbackState.currentTime + timePassed;

              await TrackPlayer.seekTo(syncedTime);

              if (playbackState.isPlaying) {
                await TrackPlayer.play();
                setIsPlaying(true);
              }
            } catch (error) {
              console.error('Error syncing playback:', error);
            }
          })();
        }
      }
    });

    socket.on('member-joined', (member) => {
      setGroupMembers((prev) => {
        if (prev.find((m) => m.userId === member.userId)) return prev;
        return [...prev, member];
      });
    });

    socket.on('member-left', ({ userId }) => {
      if (userId) {
        setGroupMembers((prev) => prev.filter((member) => member.userId !== userId));
      }
    });

    socket.on('group-disbanded', () => {
      if (trackPlayerInitialized.current) {
        TrackPlayer.reset();
      }

      setCurrentGroup(null);
      setCurrentSong(null);
      setIsPlaying(false);
      setMessages([]);
      setGroupMembers([]);
      Alert.alert('Info', 'Group disbanded');
    });

    socket.on('new-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off('playback-update');
      socket.off('music-update');
      socket.off('group-created');
      socket.off('group-joined');
      socket.off('member-joined');
      socket.off('member-left');
      socket.off('group-disbanded');
      socket.off('new-message');
    };
  }, [socket, isPlaying, serverTimeOffset, user, getServerTime]);

  const contextValue: GroupMusicContextType = {
    // States
    currentGroup,
    setCurrentGroup,
    isPlaying,
    groupMembers,
    setGroupMembers,
    searchResults,
    setSearchResults,
    searchQuery,
    setSearchQuery,
    currentSong,
    setCurrentSong,
    isSearchOpen,
    setIsSearchOpen,
    isLoading,
    setIsLoading,
    messages,
    setMessages,
    serverTimeOffset,
    setServerTimeOffset,
    lastSync,
    setLastSync,
    isGroupModalOpen,
    setIsGroupModalOpen,
    isSearchLoading,
    setIsSearchLoading,

    // Functions
    handlePlayPause,
    handleSeek,
    selectSong,
    debouncedSearch,
    createGroup,
    joinGroup,
    leaveGroup,
    sendMessage,
  };

  return <GroupMusicContext.Provider value={contextValue}>{children}</GroupMusicContext.Provider>;
}

export const useGroupMusic = () => {
  const context = useContext(GroupMusicContext);
  if (!context) {
    throw new Error('useGroupMusic must be used within a GroupMusicProvider');
  }
  return context;
};
