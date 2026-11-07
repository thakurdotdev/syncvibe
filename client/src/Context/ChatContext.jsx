import { bumpChat } from '@/Utils/ChatUtils';
import axios from 'axios';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Context } from './Context';
import { useVideoCallStore } from '../stores/videoCallStore';

export const ChatContext = createContext();

export const useSocket = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
  const { user } = useContext(Context);

  const [users, setUsers] = useState([]);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentChat, setCurrentChat] = useState(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const getAllExistingChats = async () => {
    if (!user?.userid) return;

    try {
      setLoading(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/get/chatlist`, {
        withCredentials: true,
      });

      if (response.status === 200) {
        const updatedChatList = (response.data.chatList || []).map((chat) => ({
          ...chat,
          isTyping: false,
        }));
        setUsers(updatedChatList);
        return updatedChatList;
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanUpSocket = () => {
    const videoCallStore = useVideoCallStore.getState();
    videoCallStore.removeCallSocketListeners(socketRef.current);
    videoCallStore.cleanupMediaStreams();

    setUsers([]);
    setOnlineStatuses({});
    setCurrentChat(null);

    if (socketRef.current) {
      socketRef.current.emit('user_offline');
      socketRef.current.removeAllListeners();
      socketRef.current.io.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    }
  };

  useEffect(() => {
    if (!user?.userid) {
      if (socketRef.current) {
        cleanUpSocket();
      }
      return;
    }

    if (socketRef.current?.connected) return;

    const newSocket = io(import.meta.env.VITE_API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = newSocket;

    const typingTimeouts = {};

    const updateCurrentChatStatus = (userId, isOnline) => {
      setCurrentChat((prevChat) => {
        if (prevChat?.otherUser?.userid === userId) {
          return { ...prevChat, isOnline };
        }
        return prevChat;
      });
    };

    const showNotification = (message) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (document.hasFocus()) return;

      const notification = new Notification(`${message?.senderName} sent you a message`, {
        body: message?.content ? message.content : 'Sent an attachment',
        icon: 'https://res.cloudinary.com/dr7lkelwl/image/upload/v1793889692/profiles/profiles_6_1793889690_21ee9015425b6812.jpg',
        tag: `msg-${message?.chatid}`,
      });

      notification.onclick = () => {
        window.focus();
        window.location.href = '/messages';
        notification.close();
      };
    };

    // Quietly, with no spinner over the list. A message arriving mid-fetch gets one more fetch.
    let refreshing = false;
    let refreshAgain = false;
    const refreshChatList = async () => {
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/get/chatlist`, {
          withCredentials: true,
        });
        setUsers((response.data.chatList || []).map((chat) => ({ ...chat, isTyping: false })));
      } catch (error) {
        console.error('Error fetching chats:', error);
      } finally {
        refreshing = false;
        if (refreshAgain) {
          refreshAgain = false;
          refreshChatList();
        }
      }
    };

    const handleMessageReceived = (messageData) => {
      const lastMsg = messageData.content || (messageData.fileurl ? 'Sent an attachment' : '');

      setUsers((prevUsers) => {
        const updated = bumpChat(prevUsers, messageData.chatid, lastMsg);
        if (updated) return updated;
        // Someone new: fetch the list to learn who they are. React may run this twice, which
        // the refresh already copes with.
        refreshChatList();
        return prevUsers;
      });

      showNotification(messageData);
    };

    const handleConnect = () => {
      newSocket.emit('setup', { userid: user.userid, name: user.name });
      newSocket.emit('user_online');
      newSocket.emit('get_initial_online_users');
    };

    const handleReconnect = () => {
      handleConnect();
      // Messages may have arrived while the connection was down, first ones included.
      refreshChatList();
      const videoCallStore = useVideoCallStore.getState();
      videoCallStore.setSocket(newSocket);
    };

    const handleTypingStatus = ({ userId: targetUserId, isTyping }) => {
      if (typingTimeouts[targetUserId]) {
        clearTimeout(typingTimeouts[targetUserId]);
      }

      const updateTypingStatus = (status) => {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u?.otherUser?.userid === targetUserId ? { ...u, isTyping: status } : u
          )
        );
        setCurrentChat((prevChat) =>
          prevChat && prevChat?.otherUser?.userid === targetUserId
            ? { ...prevChat, isTyping: status }
            : prevChat
        );
      };

      updateTypingStatus(isTyping);

      if (isTyping) {
        typingTimeouts[targetUserId] = setTimeout(() => updateTypingStatus(false), 3000);
      }
    };

    newSocket.on('connect', handleConnect);
    newSocket.io.on('reconnect', handleReconnect);
    newSocket.on('typing_status', handleTypingStatus);
    newSocket.on('user_online', (onlineUserId) => {
      setOnlineStatuses((prev) => ({ ...prev, [onlineUserId]: true }));
      updateCurrentChatStatus(onlineUserId, true);
    });
    newSocket.on('user_offline', (offlineUserId) => {
      setOnlineStatuses((prev) => ({ ...prev, [offlineUserId]: false }));
      updateCurrentChatStatus(offlineUserId, false);
    });
    newSocket.on('initial_online_users', (onlineUserIds) => {
      setOnlineStatuses(onlineUserIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}));
    });
    newSocket.on('message-received', handleMessageReceived);
    newSocket.on('call-log', (callMessage) => {
      const CALL_DISPLAY = {
        missed_call: 'Missed call',
        completed_call: 'Video call',
        rejected_call: 'Declined call',
      };
      const displayText = CALL_DISPLAY[callMessage.messagetype] || 'Call';
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u?.chatid === callMessage.chatid ? { ...u, lastmessage: displayText } : u
        )
      );
    });

    const videoCallStore = useVideoCallStore.getState();
    videoCallStore.setSocket(newSocket);
    videoCallStore.setUser(user);
    videoCallStore.setupCallSocketListeners(newSocket);

    setSocket(newSocket);

    return () => {
      Object.values(typingTimeouts).forEach(clearTimeout);
      videoCallStore.removeCallSocketListeners(newSocket);
      videoCallStore.cleanupMediaStreams();
      newSocket.removeAllListeners();
      newSocket.io.removeAllListeners();
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  useEffect(() => {
    if (!user?.userid) return;
    let ignore = false;

    setLoading(true);
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/get/chatlist`, {
        withCredentials: true,
      })
      .then((response) => {
        if (!ignore && response.status === 200) {
          const updatedChatList = (response.data.chatList || []).map((chat) => ({
            ...chat,
            isTyping: false,
          }));
          setUsers(updatedChatList);
        }
      })
      .catch((error) => {
        if (!ignore) {
          console.error('Error fetching chats:', error);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [user?.userid]);

  const contextValue = {
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
