import { bumpChat } from '@/utils/chatList';
import ImageGallery from '@/components/ImageGallery';
import SwipeableModal from '@/components/SwipeableModal';
import { Message, useChat } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { uploadToCloudinary } from '@/utils/Cloudinary';
import useApi from '@/utils/hooks/useApi';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import PressableScale from '@/components/ui/PressableScale';
import { toast } from '@/context/ToastContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, ROW_PRESS_SCALE } from '@/lib/motion';
import { saveImageToGallery } from '@/utils/saveImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import MessageHeader from '@/components/chat/MessageHeader';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import DateBubble from '@/components/chat/DateBubble';

const formatFullDateTime = (dateString?: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
};

/** A gap this long starts a new run of messages, even from the same person. */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** Scrolled this far back, a button appears to return to the latest message. */
const JUMP_BUTTON_AFTER = 400;
/** Time for one sheet to get out of the way before another opens. */
const SHEET_SWAP_MS = 200;

const JUMP_ENTER = FadeIn.duration(140).easing(EASE_OUT);
const JUMP_EXIT = FadeOut.duration(100).easing(EASE_OUT);

const ChatWithUser = () => {
  const api = useApi();
  const { user } = useUser();
  const { colors } = useTheme();
  const loggedInUserId = user?.userid;
  const { currentChat, setCurrentChat, setUsers, socket, onlineStatuses } = useChat();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<ImagePicker.ImagePickerSuccessResult | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const listRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!currentChat?.chatid) return;

    try {
      setLoading(true);
      const response = await api.get(`/api/get/messages/${currentChat.chatid}`);
      if (response.status === 200) {
        setMessages(response.data.chats);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [currentChat?.chatid, api]);

  const markAsRead = useCallback(
    (messageIds: number[]) => {
      if (!currentChat?.chatid || !currentChat?.otherUser?.userid || !messageIds.length) return;
      if (!socket?.connected) return;

      socket.emit('messages-read', {
        messageIds,
        chatid: currentChat.chatid,
        readerId: loggedInUserId,
        senderId: currentChat.otherUser.userid,
      });

      // Optimistic local update
      const now = new Date().toISOString();
      const idSet = new Set(messageIds);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid && idSet.has(Number(msg.messageid))
            ? { ...msg, isread: true, readat: now }
            : msg
        )
      );
    },
    [currentChat?.chatid, currentChat?.otherUser?.userid, socket, loggedInUserId]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const outboxQueueRef = useRef<Map<number, { tempId: number; payload: any }>>(new Map());
  const ackTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearAckTimer = useCallback((tempId: number) => {
    const timer = ackTimersRef.current.get(tempId);
    if (timer) {
      clearTimeout(timer);
      ackTimersRef.current.delete(tempId);
    }
    outboxQueueRef.current.delete(tempId);
  }, []);

  const sendQueuedMessage = useCallback(
    (payload: any) => {
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
    (failedMsg: Message) => {
      const tempId = typeof failedMsg.messageid === 'number' ? failedMsg.messageid : Date.now();

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

    const handleNewMessage = (newMessageReceived: Message) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prev) =>
          prev.some((m) => m.messageid === newMessageReceived.messageid)
            ? prev
            : [...prev, newMessageReceived]
        );
      }
    };

    const handleMessageDeleted = (data: {
      chatid?: number;
      messageid?: number;
      messageId?: number;
    }) => {
      if (data?.chatid !== currentChat.chatid) return;
      const id = data.messageid ?? data.messageId;
      setMessages((prev) => prev.filter((m) => m.messageid !== id));
    };

    const handleMessageEdited = (data: {
      chatid?: number;
      messageid?: number;
      content?: string;
    }) => {
      if (data?.chatid !== currentChat.chatid) return;
      setMessages((prev) =>
        prev.map((m) => (m.messageid === data.messageid ? { ...m, content: data.content } : m))
      );
    };

    const handleMessageAck = (data: { tempId: number; message: Message }) => {
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
                  // Keeps the same list key, so an image doesn't reload when it finishes sending.
                  tempId: data.tempId,
                }
              : msg
          )
        );
      }
    };

    const handleMessageError = (data: { tempId: number; error: string }) => {
      clearAckTimer(data.tempId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid === data.tempId || msg.tempId === data.tempId
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      console.error('Message send failed:', data.error);
    };

    const handleReadStatus = (data: {
      messageIds?: number[];
      chatid?: number;
      readat?: string;
    }) => {
      if (data?.chatid === currentChat.chatid && Array.isArray(data.messageIds)) {
        const idSet = new Set(data.messageIds.map(Number));
        const readTime = data.readat || new Date().toISOString();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid && idSet.has(Number(msg.messageid))
              ? { ...msg, isread: true, readat: readTime, status: 'sent' }
              : msg
          )
        );
      }
    };

    socket.on('connect', handleConnect);
    socket.on('message-received', handleNewMessage);
    socket.on('message-deleted', handleMessageDeleted);
    socket.on('message-edited', handleMessageEdited);
    socket.on('message-ack', handleMessageAck);
    socket.on('message-error', handleMessageError);
    socket.on('messages-read-status', handleReadStatus);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('message-received', handleNewMessage);
      socket.off('message-deleted', handleMessageDeleted);
      socket.off('message-edited', handleMessageEdited);
      socket.off('message-ack', handleMessageAck);
      socket.off('message-error', handleMessageError);
      socket.off('messages-read-status', handleReadStatus);
    };
  }, [
    socket,
    currentChat?.chatid,
    currentChat?.participants,
    user?.name,
    fetchMessages,
    clearAckTimer,
  ]);

  // Mark incoming unread messages as read
  useEffect(() => {
    if (
      !socket?.connected ||
      !currentChat?.chatid ||
      !loggedInUserId ||
      !currentChat?.otherUser?.userid
    )
      return;

    const otherUserId = currentChat.otherUser.userid;
    const unreadIncomingMessages = messages.filter(
      (msg) =>
        msg.chatid === currentChat.chatid &&
        String(msg.senderid) === String(otherUserId) &&
        !msg.isread
    );

    if (unreadIncomingMessages.length > 0) {
      const messageIds = unreadIncomingMessages
        .map((msg) => Number(msg.messageid))
        .filter((id): id is number => !isNaN(id) && id > 0);

      if (messageIds.length > 0) {
        markAsRead(messageIds);
      }
    }
  }, [
    currentChat?.chatid,
    currentChat?.otherUser?.userid,
    loggedInUserId,
    messages,
    socket?.connected,
    markAsRead,
  ]);

  const handleTyping = useCallback(
    (text: string) => {
      setMessage(text);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (socket && currentChat?.otherUser?.userid) {
        socket.emit('typing', {
          userId: loggedInUserId,
          recipientId: currentChat.otherUser.userid,
          isTyping: true,
        });

        typingTimeoutRef.current = setTimeout(() => {
          if (socket && currentChat?.otherUser?.userid) {
            socket.emit('typing', {
              userId: loggedInUserId,
              recipientId: currentChat.otherUser.userid,
              isTyping: false,
            });
          }
        }, 1500);
      }
    },
    [socket, loggedInUserId, currentChat?.otherUser?.userid]
  );

  const handleSendMessage = async () => {
    if (!message.trim() && !file) return;
    if (!currentChat?.chatid || !loggedInUserId) return;

    const currentMsgText = message.trim();
    const currentFile = file;
    const tempId = Date.now();

    const optimisticMessage: Message = {
      senderid: loggedInUserId,
      content: currentMsgText,
      createdat: new Date().toISOString(),
      messageid: tempId,
      tempId,
      participants: currentChat.participants || [],
      chatid: currentChat.chatid,
      fileurl: filePreview || undefined,
      senderName: user?.name,
      isread: false,
      status: 'pending',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setUsers(
      (prev) => bumpChat(prev, currentChat.chatid, currentMsgText || 'Sent an attachment') ?? prev
    );
    setMessage('');
    setFile(null);
    setFilePreview(null);

    if (socket?.connected && currentChat?.otherUser?.userid) {
      socket.emit('typing', {
        userId: loggedInUserId,
        recipientId: currentChat.otherUser.userid,
        isTyping: false,
      });
    }

    // Upload file first if present, then send via socket
    let uploadedUrl: string | undefined = undefined;
    if (currentFile && currentFile.assets?.[0]) {
      try {
        const fileAsset = currentFile.assets[0];
        uploadedUrl = await uploadToCloudinary(
          api,
          fileAsset.uri,
          fileAsset.fileName || 'image.jpg',
          fileAsset.mimeType || 'image/jpeg',
          'chat'
        );
      } catch (error) {
        console.error('Error uploading file:', error);
        setMessages((prev) =>
          prev.map((msg) => (msg.messageid === tempId ? { ...msg, status: 'failed' } : msg))
        );
        return;
      }
    }

    // Queue and send message
    sendQueuedMessage({
      tempId,
      chatid: currentChat.chatid,
      content: currentMsgText || null,
      fileurl: uploadedUrl || null,
      // The server works out the recipient itself, so a missing one must not stop the send.
      recipientId: currentChat.otherUser?.userid,
      senderName: user?.name,
      participants: currentChat.participants,
    });
  };

  const handleAttachment = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status === 'granted') {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          allowsMultipleSelection: false,
        });

        if (!result.canceled && result.assets?.[0]) {
          setFile(result);
          setFilePreview(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const isOwnMessage = useCallback(
    (msg: Message) => Boolean(loggedInUserId && String(msg.senderid) === String(loggedInUserId)),
    [loggedInUserId]
  );

  // Newest first, for the inverted list. Items keep the same message objects between renders, so
  // only rows whose message changed draw again.
  const listItems = useMemo(() => {
    const sameRun = (a?: Message, b?: Message) =>
      Boolean(
        a &&
        b &&
        a.senderid === b.senderid &&
        formatDate(a.createdat) === formatDate(b.createdat) &&
        Math.abs(new Date(a.createdat).getTime() - new Date(b.createdat).getTime()) < GROUP_GAP_MS
      );

    const result: any[] = [];
    messages.forEach((msg, i) => {
      const before = messages[i - 1];
      const date = formatDate(msg.createdat);
      if (!before || formatDate(before.createdat) !== date) {
        result.push({ type: 'date', id: `date-${msg.createdat}`, date });
      }
      result.push({
        type: 'message',
        message: msg,
        startsGroup: !sameRun(before, msg),
        endsGroup: !sameRun(msg, messages[i + 1]),
      });
    });
    return result.reverse();
  }, [messages]);

  const chatImages = useMemo(
    () => messages.filter((msg) => msg.fileurl).map((msg) => msg.fileurl || ''),
    [messages]
  );

  const findImageIndex = useCallback(
    (url: string) => chatImages.findIndex((imgUrl) => imgUrl === url),
    [chatImages]
  );

  const handleImagePress = useCallback(
    (imageUrl: string) => {
      const index = findImageIndex(imageUrl);
      if (index !== -1) {
        setSelectedImageIndex(index);
        setShowGallery(true);
      }
    },
    [findImageIndex]
  );

  const handleMessageLongPress = useCallback((msg: Message) => {
    Keyboard.dismiss();
    setSelectedMessage(msg);
    setShowMessageOptions(true);
  }, []);

  const handleEditMessage = useCallback(() => {
    if (selectedMessage) {
      setEditText(selectedMessage.content || '');
      setEditMode(true);
      setShowMessageOptions(false);
    }
  }, [selectedMessage]);

  const deleteMessage = useCallback(
    async (target: Message) => {
      const before = messages;
      setMessages((prev) => prev.filter((msg) => msg.messageid !== target.messageid));
      try {
        await api.delete(`/api/message/${target.messageid}`);
        socket?.emit('delete-message', {
          // Web reads messageId; both spellings keep it updating live.
          messageid: target.messageid,
          messageId: target.messageid,
          chatid: currentChat?.chatid,
          recipientId: currentChat?.otherUser?.userid,
        });
      } catch (error) {
        console.error('Error deleting message:', error);
        setMessages(before);
        toast("Couldn't delete the message. Try again.", { type: 'error' });
      }
    },
    [api, currentChat?.chatid, currentChat?.otherUser?.userid, messages, socket]
  );

  const handleDeleteMessage = useCallback(() => {
    const target = selectedMessage;
    setShowMessageOptions(false);
    if (!target) return;
    // Never reached the server, so there's nothing to delete there.
    if (target.status === 'failed') {
      setMessages((prev) => prev.filter((msg) => msg.messageid !== target.messageid));
      return;
    }
    Alert.alert('Delete this message?', 'It will be removed for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(target) },
    ]);
  }, [deleteMessage, selectedMessage]);

  const handleSaveEdit = useCallback(async () => {
    const target = selectedMessage;
    const content = editText.trim();
    setEditMode(false);
    setEditText('');
    if (!target?.messageid || !content || content === target.content) return;

    setMessages((prev) =>
      prev.map((msg) => (msg.messageid === target.messageid ? { ...msg, content } : msg))
    );
    try {
      await api.put(`/api/message/${target.messageid}`, { content });
      socket?.emit('edit-message', {
        messageid: target.messageid,
        chatid: currentChat?.chatid,
        recipientId: currentChat?.otherUser?.userid,
        content,
      });
    } catch (error) {
      console.error('Error updating message:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageid === target.messageid ? { ...msg, content: target.content } : msg
        )
      );
      toast("Couldn't save your edit. Try again.", { type: 'error' });
    }
  }, [selectedMessage, editText, api, socket, currentChat?.chatid, currentChat?.otherUser?.userid]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditText('');
  }, []);

  const handleCopyText = useCallback(async () => {
    setShowMessageOptions(false);
    if (!selectedMessage?.content) return;
    await Clipboard.setStringAsync(selectedMessage.content);
    toast('Copied');
  }, [selectedMessage]);

  const handleSavePhoto = useCallback(async () => {
    setShowMessageOptions(false);
    if (!selectedMessage?.fileurl) return;
    try {
      await saveImageToGallery(selectedMessage.fileurl);
      toast('Saved to gallery', { type: 'success' });
    } catch (error) {
      toast(
        error instanceof Error && error.message === 'permission'
          ? 'Allow SyncVibe to add photos in your phone settings'
          : "Couldn't save the photo",
        { type: 'error' }
      );
    }
  }, [selectedMessage]);

  const handleShowInfo = useCallback(() => {
    setShowMessageOptions(false);
    setTimeout(() => setShowMessageInfo(true), SHEET_SWAP_MS);
  }, []);

  const handleListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowJumpToLatest(e.nativeEvent.contentOffset.y > JUMP_BUTTON_AFTER);
  }, []);

  const jumpToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const renderItem = useCallback(
    ({ item }: any) => {
      if (item.type === 'date') {
        return <DateBubble date={item.date} />;
      }

      return (
        <MessageBubble
          message={item.message}
          isOwn={isOwnMessage(item.message)}
          startsGroup={item.startsGroup}
          endsGroup={item.endsGroup}
          onImagePress={handleImagePress}
          onMessageLongPress={handleMessageLongPress}
          onRetry={handleRetryMessage}
        />
      );
    },
    [isOwnMessage, handleImagePress, handleMessageLongPress, handleRetryMessage]
  );

  const keyExtractor = useCallback(
    (item: any) =>
      item.type === 'date' ? item.id : `msg-${item.message.tempId ?? item.message.messageid}`,
    []
  );

  const isOnline = onlineStatuses[currentChat?.otherUser?.userid || ''];

  const selectedIsOwn = selectedMessage ? isOwnMessage(selectedMessage) : false;
  const selectedOnServer =
    selectedMessage?.status !== 'pending' && selectedMessage?.status !== 'failed';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView behavior='padding' style={styles.container}>
        <MessageHeader
          onBack={() => {
            setCurrentChat(null);
            router.back();
          }}
          user={currentChat?.otherUser}
          isOnline={isOnline}
          isTyping={currentChat?.isTyping}
        />

        <View style={styles.container}>
          {/* Refetching after a reconnect keeps what's on screen: only a first load shows this. */}
          {loading && messages.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator size='large' color={colors.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Say hello to {currentChat?.otherUser?.name?.split(' ')[0] || 'them'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Your messages will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              inverted
              data={listItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.messageList}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={10}
              showsVerticalScrollIndicator={false}
              // Tapping a bubble's photo or retry works with the keyboard up; dragging puts it away.
              keyboardShouldPersistTaps='handled'
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onScroll={handleListScroll}
              scrollEventThrottle={100}
            />
          )}

          {showJumpToLatest ? (
            <Animated.View entering={JUMP_ENTER} exiting={JUMP_EXIT} style={styles.jump}>
              <PressableScale
                onPress={jumpToLatest}
                scaleTo={BUTTON_PRESS_SCALE}
                accessibilityRole='button'
                accessibilityLabel='Go to latest message'
                style={[
                  styles.jumpButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name='chevron-down' size={20} color={colors.foreground} />
              </PressableScale>
            </Animated.View>
          ) : null}
        </View>

        <ChatInput
          message={message}
          onChangeText={handleTyping}
          onSend={handleSendMessage}
          onAttach={handleAttachment}
          filePreview={filePreview}
          onRemoveAttachment={() => {
            setFile(null);
            setFilePreview(null);
          }}
          editMode={editMode}
          editText={editText}
          onEditTextChange={setEditText}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
        />

        {showGallery && chatImages.length > 0 && (
          <ImageGallery
            images={chatImages}
            initialIndex={selectedImageIndex}
            onClose={() => setShowGallery(false)}
          />
        )}

        <SwipeableModal
          isVisible={showMessageOptions}
          onClose={() => setShowMessageOptions(false)}
          dragAnywhere
        >
          <View style={styles.sheet}>
            {selectedMessage?.content ? (
              <OptionItem icon='copy-outline' text='Copy text' onPress={handleCopyText} />
            ) : null}
            {selectedMessage?.fileurl && selectedOnServer ? (
              <OptionItem icon='download-outline' text='Save photo' onPress={handleSavePhoto} />
            ) : null}
            {selectedIsOwn && selectedOnServer && selectedMessage?.content ? (
              <OptionItem icon='pencil-outline' text='Edit' onPress={handleEditMessage} />
            ) : null}
            {selectedIsOwn && selectedOnServer ? (
              <OptionItem
                icon='information-circle-outline'
                text='Message info'
                onPress={handleShowInfo}
              />
            ) : null}
            {selectedIsOwn && selectedMessage?.status !== 'pending' ? (
              <OptionItem
                icon='trash-outline'
                text='Delete'
                onPress={handleDeleteMessage}
                color={colors.destructive}
              />
            ) : null}
          </View>
        </SwipeableModal>

        <SwipeableModal
          isVisible={showMessageInfo}
          onClose={() => setShowMessageInfo(false)}
          dragAnywhere
        >
          <View style={styles.sheet}>
            <InfoRow
              icon='check'
              label='Sent'
              value={formatFullDateTime(selectedMessage?.createdat)}
            />
            <InfoRow
              icon='check-all'
              label='Read'
              value={
                selectedMessage?.isread
                  ? formatFullDateTime(selectedMessage.readat) || 'Read'
                  : 'Not read yet'
              }
            />
          </View>
        </SwipeableModal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const InfoRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.mutedForeground} />
      <View>
        <Text style={[styles.infoLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.mutedForeground }]}>{value}</Text>
      </View>
    </View>
  );
};

const OptionItem = React.memo(
  ({
    icon,
    text,
    onPress,
    color,
  }: {
    icon: any;
    text: string;
    onPress: () => void;
    color?: string;
  }) => {
    const { colors } = useTheme();
    const itemColor = color || colors.foreground;

    return (
      <PressableScale
        onPress={onPress}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        style={styles.optionItem}
      >
        <Ionicons name={icon} size={22} color={itemColor} />
        <Text style={[styles.optionText, { color: itemColor }]}>{text}</Text>
      </PressableScale>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  emptyText: { fontSize: 14, marginTop: 4 },
  messageList: { paddingHorizontal: 12, paddingVertical: 12 },
  jump: { position: 'absolute', right: 12, bottom: 10 },
  jumpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheet: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 52,
    paddingHorizontal: 12,
  },
  optionText: { fontSize: 16, fontWeight: '500' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 15, fontWeight: '600' },
  infoValue: { fontSize: 13, marginTop: 2 },
});

export default ChatWithUser;
