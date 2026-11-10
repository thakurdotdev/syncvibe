import { API_URL } from '@/constants';
import { getAuthHeaders } from '@/lib/auth-client';
import { bindChatSocket, resetChat } from '@/lib/chat';
import { previewOf, useChatStore, type ChatMessage } from '@/stores/chatStore';
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

interface ChatContextType {
  socket: Socket | null;
  /** On sign-out: drops the connection and everything held for the user who left. */
  cleanUpSocket: () => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

/** A notification for a message in a conversation that isn't the one on screen. */
const notify = (message: ChatMessage) => {
  if (Platform.OS === 'web') return;
  const { activeId, conversations, meId } = useChatStore.getState();
  if (activeId === message.conversationId && AppState.currentState === 'active') return;

  const sender = conversations.find((c) => c.id === message.conversationId)?.peer;
  void Notifications.scheduleNotificationAsync({
    content: {
      title: sender?.name || 'New message',
      body: previewOf(message, meId),
      data: {
        type: 'message',
        conversationId: message.conversationId,
        senderId: message.senderId,
      },
      categoryIdentifier: 'chat_message',
    },
    trigger: null,
  });
};

/**
 * Owns the one socket the signed-in app uses: messages and music rooms share it. The server
 * knows who the socket belongs to from the session cookie, which the app passes when connecting
 * because it has no cookie jar of its own.
 */
export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const userId = user?.userid;

  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const closeSocket = useCallback(() => {
    const current = socketRef.current;
    if (!current) return;
    current.removeAllListeners();
    current.io.removeAllListeners();
    current.disconnect();
    socketRef.current = null;
    setSocket(null);
  }, []);

  const cleanUpSocket = useCallback(() => {
    closeSocket();
    resetChat();
  }, [closeSocket]);

  useEffect(() => {
    if (!userId) {
      cleanUpSocket();
      return;
    }

    const newSocket = io(API_URL!, {
      transports: ['websocket', 'polling'],
      // Asked again on every reconnect, so a session that was refreshed meanwhile is the one sent.
      auth: (send) => {
        getAuthHeaders()
          .then((headers) => send({ cookie: headers.Cookie }))
          .catch(() => send({}));
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = newSocket;

    // Music rooms wait for the answer to this before they join.
    newSocket.on('connect', () => newSocket.emit('setup', { userid: userId }));

    const unbindChat = bindChatSocket(newSocket, { userId: Number(userId), onIncoming: notify });
    setSocket(newSocket);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !newSocket.connected) newSocket.connect();
    });

    return () => {
      subscription.remove();
      unbindChat();
      closeSocket();
    };
  }, [userId, cleanUpSocket, closeSocket]);

  const value = useMemo(() => ({ socket, cleanUpSocket }), [socket, cleanUpSocket]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
