import { API_URL } from '@/constants';
import { User } from '@/types/user';
import useApi from '@/utils/hooks/useApi';
import * as Notifications from 'expo-notifications';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useUser } from './UserContext';
import { runAfterIdle } from '@/utils/runAfterIdle';

export interface ChatUser {
  chatid: number;
  otherUser: User;
  lastmessage?: string | null;
  lastMessageType?: string;
  isTyping?: boolean;
  createdat: string;
  participants: number[];
  isOnline?: boolean;
}

export interface Message {
  messageid?: number | string;
  tempId?: string | number;
  senderid?: number;
  senderName?: string;
  content?: string | null;
  chatid?: number;
  timestamp?: string;
  fileurl?: string | null;
  createdat: string;
  participants: number[];
  isread?: boolean;
  readat?: string | null;
  status?: 'pending' | 'sent' | 'failed';
}

interface ChatContextType {
  users: ChatUser[];
  setUsers: React.Dispatch<React.SetStateAction<ChatUser[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onlineStatuses: Record<string, boolean>;
  setOnlineStatuses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  currentChat: ChatUser | null;
  setCurrentChat: React.Dispatch<React.SetStateAction<ChatUser | null>>;
  socket: Socket | null;
  getAllExistingChats: () => Promise<void>;
  cleanUpSocket: () => void;
}

interface ChatProviderProps {
  children: ReactNode;
}

// Create context
export const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Create hook to use the chat context
export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Provider component
export const ChatProvider = ({ children }: ChatProviderProps) => {
  const api = useApi();
  const { user } = useUser();
  const userId = user?.userid;
  const userName = user?.name;

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [currentChat, setCurrentChat] = useState<ChatUser | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const currentChatRef = useRef<ChatUser | null>(null);
  const typingTimeouts = useRef<Record<string, any>>({});

  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  const updateCurrentChatStatus = useCallback((targetUserId: number, isOnline: boolean) => {
    setCurrentChat((prevChat) => {
      if (prevChat?.otherUser?.userid === targetUserId) {
        return { ...prevChat, isOnline };
      }
      return prevChat;
    });
  }, []);

  const showNotification = useCallback((message: Message) => {
    if (currentChatRef.current?.otherUser?.userid !== message.senderid) {
      if (Platform.OS !== 'web') {
        Notifications.scheduleNotificationAsync({
          content: {
            title: `New message from ${message.senderName}`,
            body: message?.content ? message.content : 'Sent an attachment',
          },
          trigger: null,
        });
      }
    }
  }, []);

  const handleMessageReceived = useCallback(
    (messageData: Message) => {
      const { senderid } = messageData;
      const lastMsg = messageData.content || (messageData.fileurl ? 'Sent an attachment' : '');

      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.otherUser.userid === senderid ? { ...u, lastmessage: lastMsg } : u))
      );

      showNotification(messageData);
    },
    [showNotification]
  );

  const getAllExistingChats = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/get/chatlist`);

      if (response.status === 200) {
        const updatedChatList = response.data.chatList.map((chat: any) => ({
          ...chat,
          isTyping: false,
        }));
        setUsers(updatedChatList);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, api]);

  const cleanUpSocket = useCallback(() => {
    Object.values(typingTimeouts.current).forEach(clearTimeout);
    typingTimeouts.current = {};
    setUsers([]);
    setOnlineStatuses({});
    setCurrentChat(null);

    const s = socketRef.current;
    if (s) {
      if (userId) {
        s.emit('user_offline', userId);
      }
      s.removeAllListeners();
      s.io.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    if (socketRef.current?.connected) return;

    const newSocket = io(API_URL!, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Socket event handlers
    const handleConnect = () => {
      newSocket.emit('setup', { userid: userId, name: userName });
      newSocket.emit('user_online', userId);
      newSocket.emit('get_initial_online_users');
    };

    const handleTypingStatus = ({
      userId: typingUserId,
      isTyping,
    }: {
      userId: number;
      isTyping: boolean;
    }) => {
      if (typingTimeouts.current[typingUserId]) {
        clearTimeout(typingTimeouts.current[typingUserId]);
      }

      const updateTypingStatus = (status: boolean) => {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u.otherUser.userid === typingUserId ? { ...u, isTyping: status } : u
          )
        );
        setCurrentChat((prevChat) =>
          prevChat && prevChat?.otherUser?.userid === typingUserId
            ? { ...prevChat, isTyping: status }
            : prevChat
        );
      };

      updateTypingStatus(isTyping);

      if (isTyping) {
        typingTimeouts.current[typingUserId] = setTimeout(() => updateTypingStatus(false), 3000);
      }
    };

    newSocket.on('connect', handleConnect);
    newSocket.io.on('reconnect', handleConnect);
    newSocket.on('typing_status', handleTypingStatus);
    newSocket.on('user_online', (onlineUserId: number) => {
      setOnlineStatuses((prev) => ({ ...prev, [onlineUserId]: true }));
      updateCurrentChatStatus(onlineUserId, true);
    });
    newSocket.on('user_offline', (offlineUserId: number) => {
      setOnlineStatuses((prev) => ({ ...prev, [offlineUserId]: false }));
      updateCurrentChatStatus(offlineUserId, false);
    });
    newSocket.on('initial_online_users', (onlineUserIds: number[]) => {
      setOnlineStatuses(onlineUserIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}));
    });
    newSocket.on('message-received', handleMessageReceived);

    const task = runAfterIdle(() => {
      void getAllExistingChats();
    });

    return () => {
      task.cancel();
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      typingTimeouts.current = {};
      if (userId) {
        newSocket.emit('user_offline', userId);
      }
      newSocket.removeAllListeners();
      newSocket.io.removeAllListeners();
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [userId, userName, updateCurrentChatStatus, handleMessageReceived, getAllExistingChats]);

  // Reconnect immediately on app foreground only if user is logged in
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        nextAppState === 'active' &&
        userId &&
        socketRef.current &&
        !socketRef.current.connected
      ) {
        socketRef.current.connect();
      }
    });
    return () => subscription.remove();
  }, [userId]);

  const contextValue = useMemo<ChatContextType>(
    () => ({
      users,
      setUsers,
      loading,
      setLoading,
      onlineStatuses,
      setOnlineStatuses,
      currentChat,
      setCurrentChat,
      socket,
      getAllExistingChats,
      cleanUpSocket,
    }),
    [users, loading, onlineStatuses, currentChat, socket, getAllExistingChats, cleanUpSocket]
  );

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};
