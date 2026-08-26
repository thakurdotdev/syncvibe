import { useIsMobile } from '@/hooks/use-mobile';
import axios from 'axios';
import { ImageIcon } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChatContext } from '../../Context/ChatContext';
import { Context } from '../../Context/Context';
import { useVideoCallStore } from '../../stores/videoCallStore';
import { getAllMessages } from '../../Utils/ChatUtils';
import { uploadToCloudinary } from '../../Utils/cloudinaryUpload';
import ChatHeader from './ChatHeader';
import ImageGallery from './ImageGallery';
import MessageInfoModal from './MessageInfoModal';
import MessageInput from './MessageInput';
import MessageList from './MessageList';

const ChatWithUser = ({ setCurrentChat, currentChat, loggedInUserId, socket }) => {
  const { user } = useContext(Context);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { setUsers } = useContext(ChatContext);
  const { isInCall, incomingCall, startCall } = useVideoCallStore();

  // State
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [infoModalMessage, setInfoModalMessage] = useState(null);

  // Refs
  const messageEndRef = useRef(null);
  const outboxQueueRef = useRef(new Map());
  const ackTimersRef = useRef(new Map());

  const clearAckTimer = useCallback((tempId) => {
    const timer = ackTimersRef.current.get(tempId);
    if (timer) {
      clearTimeout(timer);
      ackTimersRef.current.delete(tempId);
    }
    outboxQueueRef.current.delete(tempId);
  }, []);

  const sendQueuedMessage = useCallback(
    (payload) => {
      const { tempId } = payload;
      outboxQueueRef.current.set(tempId, { tempId, payload });

      // 10s ACK timeout
      const timer = setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === tempId || msg.tempId === tempId ? { ...msg, status: 'failed' } : msg
          )
        );
        ackTimersRef.current.delete(tempId);
      }, 10000);

      ackTimersRef.current.set(tempId, timer);

      if (socket?.connected) {
        socket.emit('send-message', payload);
      }
    },
    [socket]
  );

  const handleRetryMessage = useCallback(
    (failedMsg) => {
      const tempId = failedMsg.tempId || failedMsg.messageid;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid === failedMsg.messageid ? { ...msg, status: 'pending' } : msg
        )
      );

      const queuedItem = outboxQueueRef.current.get(tempId);
      if (queuedItem) {
        sendQueuedMessage(queuedItem.payload);
      } else if (currentChat?.chatid && currentChat?.otherUser?.userid) {
        sendQueuedMessage({
          tempId,
          chatid: currentChat.chatid,
          content: failedMsg.content || null,
          fileurl: failedMsg.fileurl || null,
          recipientId: currentChat.otherUser.userid,
          senderName: user?.name,
          participants: currentChat.participants,
        });
      }
    },
    [currentChat, user?.name, sendQueuedMessage]
  );

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    if (!currentChat?.chatid) return;

    try {
      setLoading(true);
      const data = await getAllMessages(currentChat.chatid);
      if (data) {
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [currentChat?.chatid]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !currentChat?.chatid) return;

    const handleConnect = () => {
      // Re-sync messages and drain outbox queue
      fetchMessages();

      outboxQueueRef.current.forEach(({ payload }) => {
        socket.emit('send-message', payload);
      });
    };

    const handleNewMessage = (newMessageReceived) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prevMessages) => [...prevMessages, newMessageReceived]);
      }
    };

    const handleMessageDeleted = (messageData) => {
      if (messageData.chatid === currentChat.chatid) {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.messageid !== messageData.messageId)
        );
      }
    };

    const handleMessageAck = (data) => {
      clearAckTimer(data.tempId);

      if (data?.message?.chatid === currentChat.chatid) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === data.tempId || msg.tempId === data.tempId
              ? {
                  ...data.message,
                  participants: currentChat.participants,
                  senderName: user?.name,
                  isread: false,
                  status: 'sent',
                }
              : msg
          )
        );
      }
    };

    const handleMessageError = (data) => {
      clearAckTimer(data.tempId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid === data.tempId || msg.tempId === data.tempId
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      toast.error(data?.error || 'Failed to send message');
    };

    const handleReadStatus = (data) => {
      if (data?.chatid === currentChat.chatid && Array.isArray(data.messageIds)) {
        const idSet = new Set(data.messageIds.map(Number));
        const readTime = data.readat || new Date().toISOString();
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            idSet.has(Number(msg.messageid))
              ? { ...msg, isread: true, readat: readTime, status: 'sent' }
              : msg
          )
        );
      }
    };

    const handleCallLog = (callMessage) => {
      if (callMessage.chatid === currentChat.chatid) {
        setMessages((prevMessages) => [...prevMessages, callMessage]);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('message-received', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('message-ack', handleMessageAck);
    socket.on('message-error', handleMessageError);
    socket.on('messages-read-status', handleReadStatus);
    socket.on('call-log', handleCallLog);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('message-received', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('message-ack', handleMessageAck);
      socket.off('message-error', handleMessageError);
      socket.off('messages-read-status', handleReadStatus);
      socket.off('call-log', handleCallLog);
    };
  }, [
    socket,
    currentChat?.chatid,
    currentChat?.participants,
    user?.name,
    fetchMessages,
    clearAckTimer,
  ]);

  // Send message handler
  const handleSendMessage = useCallback(
    async (messageContent) => {
      if ((!messageContent?.trim() && !file) || !currentChat?.chatid) return;

      const tempId = `temp-${Date.now()}`;
      const contentText = messageContent?.trim() || '';

      const optimisticMessage = {
        senderid: loggedInUserId,
        content: contentText,
        createdat: new Date().toISOString(),
        messageid: tempId,
        tempId,
        participants: currentChat.participants,
        chatid: currentChat.chatid,
        fileurl: file ? URL.createObjectURL(file) : null,
        senderName: user?.name,
        isread: false,
        status: 'pending',
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Update last message in chat list
      setUsers((prevUsers) =>
        prevUsers.map((chat) =>
          chat.chatid === currentChat.chatid
            ? { ...chat, lastmessage: contentText || 'Sent an image' }
            : chat
        )
      );

      // Upload file via Cloudinary presigned URL (same flow as posts)
      let uploadedFileUrl = null;
      if (file) {
        try {
          const result = await uploadToCloudinary(file, 'chat');
          uploadedFileUrl = result.image;
          setFile(null);
          setFilePreview(null);
        } catch (error) {
          console.error('Error uploading file:', error);
          toast.error('Failed to upload file');
          setMessages((prev) =>
            prev.map((msg) => (msg.messageid === tempId ? { ...msg, status: 'failed' } : msg))
          );
          return;
        }
      }

      // Queue and send message via socket
      sendQueuedMessage({
        tempId,
        chatid: currentChat.chatid,
        content: contentText || null,
        fileurl: uploadedFileUrl,
        recipientId: currentChat.otherUser.userid,
        senderName: user?.name,
        participants: currentChat.participants,
      });
    },
    [file, loggedInUserId, currentChat, user?.name, setUsers, sendQueuedMessage]
  );

  // Delete message handler
  const deleteMessage = useCallback(
    async (messageId) => {
      try {
        const response = await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/delete/message/${messageId}`,
          { withCredentials: true }
        );

        if (response.status === 200) {
          socket.emit('delete-message', {
            chatid: currentChat.chatid,
            messageId,
            recipientId: currentChat.otherUser.userid,
          });

          setMessages((prev) => prev.filter((msg) => msg.messageid !== messageId));
          toast.success('Message deleted');
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        toast.error('Failed to delete message');
      }
    },
    [socket, currentChat?.chatid, currentChat?.otherUser?.userid]
  );

  // Typing indicator handler for socket emission
  const handleTypingEvent = useCallback(
    (typingData) => {
      if (socket) {
        socket.emit('typing', typingData);
      }
    },
    [socket]
  );

  // Mark messages as read — socket-only, server handles DB persistence
  useEffect(() => {
    if (
      !messages.length ||
      !socket?.connected ||
      !loggedInUserId ||
      !currentChat?.otherUser?.userid
    ) {
      return;
    }

    const otherUserId = currentChat.otherUser.userid;
    const unreadMessages = messages.filter(
      (msg) => String(msg.senderid) === String(otherUserId) && !msg.isread
    );

    if (unreadMessages.length === 0) return;

    const messageIds = unreadMessages
      .map((msg) => msg.messageid)
      .filter(
        (id) => typeof id === 'number' || (typeof id === 'string' && !id.startsWith('temp-'))
      );

    if (messageIds.length === 0) return;

    const markMessagesAsRead = () => {
      socket.emit('messages-read', {
        messageIds,
        chatid: currentChat.chatid,
        readerId: loggedInUserId,
        senderId: otherUserId,
      });

      // Optimistic local update
      const now = new Date().toISOString();
      const idSet = new Set(messageIds.map(Number));
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          idSet.has(Number(msg.messageid)) ? { ...msg, isread: true, readat: now } : msg
        )
      );
    };

    const timeoutId = setTimeout(markMessagesAsRead, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, socket, loggedInUserId, currentChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      messageEndRef.current?.scrollIntoView({ behavior: 'instant' });
    };

    scrollToBottom();

    // Also scroll when images load
    const handleImageLoad = () => scrollToBottom();
    const chatContainer = messageEndRef.current?.parentElement;

    if (chatContainer) {
      const images = chatContainer.querySelectorAll('img');
      images.forEach((img) => {
        img.addEventListener('load', handleImageLoad);
      });

      return () => {
        images.forEach((img) => {
          img.removeEventListener('load', handleImageLoad);
        });
      };
    }
  }, [messages]);

  // Utility function to copy message text
  const handleCopy = useCallback((text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('Copied to clipboard'))
      .catch(() => toast.error('Failed to copy'));
  }, []);

  // Helper to remove file preview
  const removeImage = () => {
    setFile(null);
    setFilePreview(null);
  };

  // Handle file selection
  const handleFileSelect = useCallback((selectedFile) => {
    setFile(selectedFile);
    setFilePreview(URL.createObjectURL(selectedFile));
  }, []);

  // Collect chat images for image gallery
  const chatImages = useMemo(() => {
    return messages.filter((message) => message.fileurl).map((message) => message.fileurl);
  }, [messages]);

  // If no current chat is selected
  if (!currentChat) {
    return (
      <div className='flex flex-col h-[calc(100vh-60px)] justify-center items-center bg-card'>
        <div className='text-center p-4'>
          <div className='mb-4'>
            <ImageIcon className='h-12 w-12 mx-auto text-muted-foreground/50' />
          </div>
          <h3 className='text-xl font-semibold text-foreground mb-2'>Select a conversation</h3>
          <p className='text-muted-foreground'>Choose a chat from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className='relative flex flex-col h-[calc(100vh-60px)]'>
        <ChatHeader
          currentChat={currentChat}
          setCurrentChat={setCurrentChat}
          isMobile={isMobile}
          navigate={navigate}
          incomingCall={incomingCall}
          isInCall={isInCall}
          startCall={startCall}
        />

        <MessageList
          messages={messages}
          loading={loading}
          loggedInUserId={loggedInUserId}
          handleCopy={handleCopy}
          deleteMessage={deleteMessage}
          onRetry={handleRetryMessage}
          onShowInfo={setInfoModalMessage}
          chatImages={chatImages}
          setSelectedImageIndex={setSelectedImageIndex}
          setShowGallery={setShowGallery}
          currentChat={currentChat}
          messageEndRef={messageEndRef}
        />

        <MessageInput
          onSendMessage={handleSendMessage}
          filePreview={filePreview}
          removeImage={removeImage}
          onTyping={handleTypingEvent}
          currentChat={currentChat}
          loggedInUserId={loggedInUserId}
          onFileSelect={handleFileSelect}
        />
      </div>

      {showGallery && chatImages.length > 0 && (
        <ImageGallery
          images={chatImages}
          initialIndex={selectedImageIndex}
          onClose={() => setShowGallery(false)}
        />
      )}

      <MessageInfoModal message={infoModalMessage} onClose={() => setInfoModalMessage(null)} />
    </>
  );
};

export default ChatWithUser;
