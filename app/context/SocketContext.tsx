import { API_URL } from '@/constants';
import { getAuthHeaders } from '@/lib/auth-client';
import { bindChatSocket, resetChat } from '@/lib/chat';
import { conversationOnScreen } from '@/lib/chatScreen';
import { bindPlayerSocket } from '@/lib/player';
import { showMessageBanner } from '@/components/chat/MessageBanner';
import { clearMessageNotification, showMessageNotification } from '@/lib/messageNotifications';
import { previewOf, useChatStore, type ChatMessage, type Receipt } from '@/stores/chatStore';
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

/**
 * A message from someone else arrived over the socket. With the app open it shows as a banner
 * inside the app (unless its conversation is on screen); with the app in the background it goes
 * into that conversation's phone notification.
 */
const notify = (message: ChatMessage) => {
  if (Platform.OS === 'web' || message.id == null) return;
  const { conversations, meId } = useChatStore.getState();
  const sender = conversations.find((c) => c.id === message.conversationId)?.peer;

  if (AppState.currentState === 'active') {
    if (conversationOnScreen() === message.conversationId) return;
    showMessageBanner({
      conversationId: message.conversationId,
      name: sender?.name || 'New message',
      profilepic: sender?.profilepic ?? null,
      text: previewOf(message, meId),
    });
    return;
  }

  void showMessageNotification({
    conversationId: message.conversationId,
    messageId: message.id,
    senderName: sender?.name,
    preview: previewOf(message, meId),
    imageUrl: message.attachment?.url,
  }).catch(() => {});
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
    // "Online" means the app is open, so the server hears whether it is in front.
    const reportActive = () =>
      newSocket.emit('presence:active', { active: AppState.currentState === 'active' });
    newSocket.on('connect', () => {
      newSocket.emit('setup', { userid: userId });
      reportActive();
    });

    const unbindChat = bindChatSocket(newSocket, { userId: Number(userId), onIncoming: notify });
    const unbindPlayer = bindPlayerSocket(newSocket);

    // Read here or on another device: the conversation's notification has nothing left to say.
    const onReceipt = (receipt?: Receipt) => {
      if (receipt?.userId === Number(userId) && Platform.OS !== 'web') {
        void clearMessageNotification(receipt.conversationId);
      }
    };
    newSocket.on('chat:receipt', onReceipt);
    setSocket(newSocket);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !newSocket.connected) newSocket.connect();
      else if (newSocket.connected) reportActive();
    });

    return () => {
      subscription.remove();
      unbindChat();
      unbindPlayer();
      closeSocket();
    };
  }, [userId, cleanUpSocket, closeSocket]);

  const value = useMemo(() => ({ socket, cleanUpSocket }), [socket, cleanUpSocket]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
