import { API_URL } from '@/constants';
import { User } from '@/types/user';
import useApi from '@/utils/hooks/useApi';
import * as Notifications from 'expo-notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useUser } from './UserContext';

export interface ChatUser {
  chatid: number;
  otherUser: User;
  lastmessage?: string;
  lastMessageType?: string;
  isTyping?: boolean;
  createdat: string;
  participants: number[];
  isOnline?: boolean;
}

export interface Message {
  messageid?: number;
  senderid?: number;
  senderName?: string;
  content: string;
  chatid?: number;
  timestamp?: string;
  fileurl?: string;
  createdat: string;
  participants: number[];
  isread?: boolean;
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

  const [users, setUsers] = useState<ChatUser[]>([]);
  const [onlineStatuses, setOnlineStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [currentChat, setCurrentChat] = useState<ChatUser | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const typingTimeouts: Record<string, NodeJS.Timeout> = {};

  const updateCurrentChatStatus = useCallback((userId: number, isOnline: boolean) => {
    setCurrentChat((prevChat) => {
      if (prevChat?.otherUser?.userid === userId) {
        return { ...prevChat, isOnline };
      }
      return prevChat;
    });
  }, []);

  const showNotification = (message: Message) => {
    if (currentChat?.otherUser.userid !== message.senderid) {
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
  };

  const handleMessageReceived = useCallback((messageData: Message) => {
    const { senderid } = messageData;

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.otherUser.userid === senderid ? { ...user, lastmessage: messageData.content } : user
      )
    );

    showNotification(messageData);
  }, []);

  const getAllExistingChats = useCallback(async () => {
    if (!user?.userid) return;

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
  }, [user?.userid]);

  const setupSocket = useCallback(() => {
    if (!user?.userid || socket?.connected) return;

    const newSocket = io(API_URL!, {
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    // Socket event handlers
    const handleConnect = () => {
      newSocket.emit('setup', { userid: user.userid, name: user.name });
      newSocket.emit('user_online', user.userid);
      newSocket.emit('get_initial_online_users');
    };

    const handleTypingStatus = ({ userId, isTyping }: { userId: number; isTyping: boolean }) => {
      if (typingTimeouts[userId]) {
        clearTimeout(typingTimeouts[userId]);
      }

      const updateTypingStatus = (status: boolean) => {
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.otherUser.userid === userId ? { ...user, isTyping: status } : user
          )
        );
        setCurrentChat((prevChat) =>
          prevChat && prevChat?.otherUser?.userid === userId
            ? { ...prevChat, isTyping: status }
            : prevChat
        );
      };

      updateTypingStatus(isTyping);

      if (isTyping) {
        typingTimeouts[userId] = setTimeout(() => updateTypingStatus(false), 3000);
      }
    };

    // Attach event listeners
    newSocket.on('connect', handleConnect);
    newSocket.on('typing_status', handleTypingStatus);
    newSocket.on('user_online', (userId: number) => {
      setOnlineStatuses((prev) => ({ ...prev, [userId]: true }));
      updateCurrentChatStatus(userId, true);
    });
    newSocket.on('user_offline', (userId: number) => {
      setOnlineStatuses((prev) => ({ ...prev, [userId]: false }));
      updateCurrentChatStatus(userId, false);
    });
    newSocket.on('initial_online_users', (onlineUserIds: number[]) => {
      setOnlineStatuses(onlineUserIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}));
    });

    newSocket.on('message-received', handleMessageReceived);

    setSocket(newSocket);

    return () => {
      Object.values(typingTimeouts).forEach(clearTimeout);
      newSocket.disconnect();
    };
  }, [user?.userid, updateCurrentChatStatus, handleMessageReceived]);

  const cleanUpSocket = () => {
    Object.values(typingTimeouts).forEach(clearTimeout);
    setUsers([]);
    setOnlineStatuses({});
    setCurrentChat(null);

    if (socket) {
      if (user?.userid) {
        socket.emit('user_offline', user.userid);
      }
      socket.off('connect');
      socket.off('typing_status');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('initial_online_users');
      socket.off('message-received');
      socket.disconnect();
      setSocket(null);
    }
  };

  useEffect(() => {
    if (user?.userid) {
      getAllExistingChats();
      setupSocket();
    }
  }, [user?.userid, getAllExistingChats, setupSocket]);

  const contextValue: ChatContextType = {
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
  };

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};
