import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { bindCallSocket } from '@/lib/call';
import { bindChatSocket, resetChat } from '@/lib/chat';
import { paths } from '@/lib/paths';
import { previewOf, useChatStore } from '@/stores/chatStore';
import { Context } from './Context';

export const ChatContext = createContext();

export const useSocket = () => useContext(ChatContext);

/** A browser notification for a message that arrived while the tab wasn't being looked at. */
const notify = (message) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  const { conversations, meId } = useChatStore.getState();
  const sender = conversations.find((c) => c.id === message.conversationId)?.peer;
  const notification = new Notification(sender?.name || 'New message', {
    body: previewOf(message, meId),
    tag: `msg-${message.conversationId}`,
  });
  notification.onclick = () => {
    window.focus();
    window.location.href = paths.messages;
    notification.close();
  };
};

/**
 * Owns the one socket the signed-in app uses: messages, calls and music rooms all share it.
 * The server knows who the socket belongs to from the session cookie sent when it connects.
 */
export const ChatProvider = ({ children }) => {
  const { user } = useContext(Context);
  const userId = user?.userid;

  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const closeSocket = useCallback(() => {
    const current = socketRef.current;
    if (!current) return;
    current.removeAllListeners();
    current.io.removeAllListeners();
    current.disconnect();
    socketRef.current = null;
    setSocket(null);
  }, []);

  /** On sign-out: drop the connection and everything held for the user who left. */
  const cleanUpSocket = useCallback(() => {
    closeSocket();
    resetChat();
  }, [closeSocket]);

  useEffect(() => {
    if (!userId) {
      cleanUpSocket();
      return;
    }

    const newSocket = io(import.meta.env.VITE_API_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = newSocket;

    // Music rooms wait for the answer to this before they join.
    newSocket.on('connect', () => newSocket.emit('setup', { userid: userId }));

    const unbindChat = bindChatSocket(newSocket, { userId, onIncoming: notify });
    const unbindCalls = bindCallSocket(newSocket);

    setSocket(newSocket);

    return () => {
      unbindChat();
      // Before the socket closes, so a call in progress can still be hung up.
      unbindCalls();
      closeSocket();
    };
  }, [userId, cleanUpSocket, closeSocket]);

  const value = useMemo(() => ({ socket, cleanUpSocket }), [socket, cleanUpSocket]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
