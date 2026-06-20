import ImageGallery from '@/components/ImageGallery';
import StartCall from '@/components/video/StartCall';
import SwipeableModal from '@/components/common/SwipeableModal';
import { Message, useChat } from '@/context/SocketContext';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';
import useApi from '@/utils/hooks/useApi';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '@/components/ui/input';

const MessageHeader = React.memo(
  ({
    onBack,
    user,
    isOnline,
    isTyping,
  }: {
    onBack: () => void;
    user: any;
    isOnline: boolean;
    isTyping: boolean | undefined;
  }) => {
    const { colors } = useTheme();

    return (
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backButton}>
          <Ionicons name='chevron-back' size={22} color={colors.foreground} />
        </Pressable>

        <View style={styles.userContainer}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: user?.profilepic }}
              style={[styles.avatar, { borderColor: colors.muted, backgroundColor: colors.muted }]}
            />
            {isOnline && (
              <View
                style={[
                  styles.onlineIndicator,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.userTextContainer}>
            <Text style={[styles.username, { color: colors.foreground }]}>{user?.name}</Text>
            {isTyping && (
              <Text style={[styles.typingText, { color: colors.primary }]}>typing...</Text>
            )}
          </View>
        </View>

        <StartCall />
      </View>
    );
  }
);

const DateSeparator = React.memo(({ date }: { date: string }) => (
  <View style={styles.dateSeparator}>
    <Text style={styles.dateText}>{date}</Text>
  </View>
));

const ChatMessage = React.memo(
  ({
    message,
    isOwn,
    onImagePress,
    onMessageLongPress,
  }: {
    message: Message;
    isOwn: boolean;
    onImagePress: (url: string) => void;
    onMessageLongPress: (message: Message) => void;
  }) => {
    const { colors } = useTheme();

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isOwn ? styles.ownMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {message.fileurl && (
          <Pressable
            onPress={() => message.fileurl && onImagePress(message.fileurl)}
            style={styles.imageContainer}
          >
            <Image
              source={{
                uri: getOptimizedImageUrl(message.fileurl, { thumbnail: true }),
              }}
              style={styles.messageImage}
              resizeMode='cover'
            />
          </Pressable>
        )}

        {message.content && (
          <Pressable
            onLongPress={() => {
              if (isOwn) {
                onMessageLongPress(message);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
            style={[
              styles.messageBubble,
              isOwn
                ? [styles.ownMessageBubble, { backgroundColor: colors.muted }]
                : [styles.otherMessageBubble, { backgroundColor: colors.muted }],
            ]}
          >
            <Text style={[styles.messageText, { color: colors.foreground }]}>
              {message.content}
            </Text>
          </Pressable>
        )}

        <View style={styles.messageFooter}>
          <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
            {formatTime(message.createdat)}
          </Text>

          {isOwn && (
            <View style={styles.readStatus}>
              {message.isread ? (
                <MaterialCommunityIcons name='check-all' size={14} color={colors.primary} />
              ) : (
                <MaterialCommunityIcons name='check' size={14} color={colors.mutedForeground} />
              )}
            </View>
          )}
        </View>
      </View>
    );
  }
);

const InputToolbar = React.memo(
  ({
    message,
    onChangeText,
    onSend,
    onAttach,
    filePreview,
    onRemoveAttachment,
  }: {
    message: string;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onAttach: () => void;
    filePreview: string | null;
    onRemoveAttachment: () => void;
  }) => {
    const { colors } = useTheme();

    return (
      <View style={[styles.inputToolbar, { borderTopColor: colors.border }]}>
        {filePreview ? (
          <View style={styles.attachmentPreview}>
            <Image source={{ uri: filePreview }} style={styles.previewImage} />
            <Pressable
              style={[styles.removeAttachmentButton, { backgroundColor: colors.secondary }]}
              onPress={onRemoveAttachment}
            >
              <Ionicons name='close-circle' size={20} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <Pressable style={styles.attachButton} onPress={onAttach}>
            <Ionicons name='image-outline' size={22} color={colors.primary} />
          </Pressable>

          <Input
            value={message}
            onChangeText={onChangeText}
            placeholder='Message...'
            variant='filled'
            size='lg'
            multiline
            maxLength={500}
            containerStyle={{ flex: 1, marginRight: 8 }}
          />

          <Pressable
            style={[
              styles.sendButton,
              {
                backgroundColor: message.trim() || filePreview ? colors.primary : colors.muted,
              },
            ]}
            onPress={onSend}
            disabled={!message.trim() && !filePreview}
          >
            <Ionicons
              name='send'
              size={18}
              color={
                message.trim() || filePreview ? colors.primaryForeground : colors.mutedForeground
              }
            />
          </Pressable>
        </View>
      </View>
    );
  }
);

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

const MessageOptionItem = React.memo(
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
      <Pressable
        style={styles.optionItem}
        onPress={() => {
          onPress();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Ionicons name={icon} size={22} color={itemColor} />
        <Text style={[styles.optionText, { color: itemColor }]}>{text}</Text>
      </Pressable>
    );
  }
);

const ChatWithUser = () => {
  const api = useApi();
  const { user } = useUser();
  const { colors, theme } = useTheme();
  const loggedInUserId = user?.userid;
  const { currentChat, setCurrentChat, socket, onlineStatuses } = useChat();

  // State
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<ImagePicker.ImagePickerSuccessResult | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const didMountRef = useRef(false); // Track if component has mounted

  // Load messages
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
    async (messageIds: number[]) => {
      if (!currentChat?.chatid || !socket) return;

      try {
        const response = await api.post(`/api/read/messages`, {
          messageIds,
        });

        if (response.status === 200) {
          socket.emit('messages-read', {
            messageIds,
            chatid: currentChat.chatid,
            readerId: loggedInUserId,
            senderId: currentChat.otherUser.userid,
          });
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    },
    [currentChat?.chatid, api]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!socket || !currentChat?.chatid) return;

    const handleNewMessage = (newMessageReceived: Message) => {
      if (newMessageReceived.chatid === currentChat.chatid) {
        setMessages((prev) => [...prev, newMessageReceived]);
      }
    };

    const handleReadStatus = (data: Message) => {
      if (data.chatid === currentChat.chatid) {
        setMessages((prev) => prev.map((msg) => ({ ...msg, isread: true })));
      }
    };

    socket.on('message-received', handleNewMessage);
    socket.on('messages-read-status', handleReadStatus);

    return () => {
      socket.off('message-received', handleNewMessage);
      socket.off('messages-read-status', handleReadStatus);
    };
  }, [socket, currentChat?.chatid]);

  // Mark messages as read when the chat is opened
  useEffect(() => {
    if (currentChat?.chatid && loggedInUserId) {
      const unreadMessages = messages.filter(
        (msg) => msg.chatid === currentChat.chatid && !msg.isread
      );

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages
          .map((msg) => msg.messageid)
          .filter((id): id is number => id !== undefined);

        if (messageIds.length > 0) {
          markAsRead(messageIds);
        }
      }
    }
  }, [currentChat?.chatid, loggedInUserId, messages, markAsRead]);

  // Handle typing status
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

  // Send message function
  const handleSendMessage = async () => {
    if (!message.trim() && !file) return;
    if (!currentChat?.chatid) return;

    try {
      const newMessage = {
        senderid: loggedInUserId,
        content: message,
        createdat: new Date().toISOString(),
        messageid: Date.now(),
        participants: currentChat?.participants,
        chatid: currentChat?.chatid,
        fileurl: filePreview || undefined,
        senderName: user?.name,
      };

      // Add to UI immediately for responsiveness
      setMessages((prev) => [...prev, newMessage]);

      // Clear input fields
      setMessage('');
      setFile(null);
      setFilePreview(null);

      // Provide feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Send to socket if no file (will be sent after upload otherwise)
      if (!file) {
        socket?.emit('new-message', newMessage);
      }

      // Cancel typing indicator
      socket?.emit('typing', {
        userId: loggedInUserId,
        recipientId: currentChat?.otherUser.userid,
        isTyping: false,
      });

      // Scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      if (!loggedInUserId) return;

      // API call to save message
      const formData = new FormData();
      formData.append('chatid', currentChat.chatid.toString());
      formData.append('senderid', loggedInUserId.toString());
      formData.append('content', message);

      if (file && file.assets?.[0]) {
        const fileAsset = file.assets[0];
        formData.append('file', {
          uri: fileAsset.uri,
          type: fileAsset.mimeType,
          name: fileAsset.fileName || 'image.jpg',
        } as any);
      }

      const response = await api.post('/api/send/message', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // If we had a file, now we can notify via socket with server data
      if (file && response?.data?.message) {
        let serverMessage = response.data.message;
        serverMessage.participants = currentChat.participants;
        socket?.emit('new-message', serverMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Image picker
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  // Process messages with date separators
  const processedMessages = useCallback(() => {
    const result: any[] = [];
    let currentDate = '';

    messages.forEach((msg) => {
      const messageDate = formatDate(msg.createdat);

      if (messageDate !== currentDate) {
        result.push({
          id: `date-${messageDate}`,
          type: 'date',
          date: messageDate,
        });
        currentDate = messageDate;
      }

      result.push({
        ...msg,
        type: 'message',
      });
    });

    return result;
  }, [messages]);

  // Get all image URLs for gallery view
  const chatImages = messages.filter((msg) => msg.fileurl).map((msg) => msg.fileurl || '');

  // Find image index by URL
  const findImageIndex = useCallback(
    (url: string) => {
      return chatImages.findIndex((imgUrl) => imgUrl === url);
    },
    [chatImages]
  );

  // Handle image press to open gallery
  const handleImagePress = useCallback(
    (imageUrl: string) => {
      const index = findImageIndex(imageUrl);
      if (index !== -1) {
        setSelectedImageIndex(index);
        setShowGallery(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [findImageIndex]
  );

  // Handle message long press
  const handleMessageLongPress = useCallback((msg: Message) => {
    setSelectedMessage(msg);
    setShowMessageOptions(true);
  }, []);

  // Handle edit message
  const handleEditMessage = useCallback(() => {
    if (selectedMessage) {
      setEditText(selectedMessage.content || '');
      setEditMode(true);
      setShowMessageOptions(false);
    }
  }, [selectedMessage]);

  // Handle delete message
  const handleDeleteMessage = useCallback(async () => {
    if (!selectedMessage?.messageid) {
      setShowMessageOptions(false);
      return;
    }

    try {
      const response = await api.delete(`/api/message/${selectedMessage.messageid}`);

      if (response.status === 200) {
        // Remove message from local state
        setMessages((prev) => prev.filter((msg) => msg.messageid !== selectedMessage.messageid));

        // Notify other users through socket
        socket?.emit('message-deleted', {
          messageid: selectedMessage.messageid,
          chatid: currentChat?.chatid,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setShowMessageOptions(false);
    }
  }, [selectedMessage, api, socket, currentChat?.chatid]);

  // Handle save edited message
  const handleSaveEdit = useCallback(async () => {
    if (!selectedMessage?.messageid || !editText.trim()) {
      setEditMode(false);
      return;
    }

    try {
      const response = await api.put(`/api/message/${selectedMessage.messageid}`, {
        content: editText,
      });

      if (response.status === 200) {
        // Update message in local state
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageid === selectedMessage.messageid
              ? { ...msg, content: editText, edited: true }
              : msg
          )
        );

        // Notify other users through socket
        socket?.emit('message-edited', {
          messageid: selectedMessage.messageid,
          chatid: currentChat?.chatid,
          content: editText,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error updating message:', error);
    } finally {
      setEditMode(false);
      setEditText('');
    }
  }, [selectedMessage, editText, api, socket, currentChat?.chatid]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditText('');
  }, []);

  // Handle copy message text
  const handleCopyText = useCallback(() => {
    if (selectedMessage?.content) {
      // Using Clipboard.setStringAsync from expo-clipboard would be ideal here
      // But for now, just close the modal
      setShowMessageOptions(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [selectedMessage]);

  // Render list items
  const renderItem = useCallback(
    ({ item }: any) => {
      if (item.type === 'date') {
        return <DateSeparator date={item.date} />;
      }

      const isOwn = item.senderid === loggedInUserId;

      return (
        <ChatMessage
          message={item}
          isOwn={isOwn}
          onImagePress={handleImagePress}
          onMessageLongPress={handleMessageLongPress}
        />
      );
    },
    [loggedInUserId, handleImagePress, handleMessageLongPress]
  );

  // List key extractor
  const keyExtractor = useCallback(
    (item: any) => (item.type === 'date' ? item.id : `msg-${item.messageid}`),
    []
  );

  // Check if other user is online
  const isOnline = onlineStatuses[currentChat?.otherUser?.userid || ''];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <MessageHeader
          onBack={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentChat(null);
            router.back();
          }}
          user={currentChat?.otherUser}
          isOnline={isOnline}
          isTyping={currentChat?.isTyping}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color='#60a5fa' />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={processedMessages()}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messageList}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            showsVerticalScrollIndicator={false}
            onLayout={() => {
              // Scroll immediately without animation when layout completes
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onContentSizeChange={() => {
              // Scroll immediately without animation when content size changes
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />
        )}

        {editMode ? (
          <View style={styles.editContainer}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit message</Text>
              <Pressable onPress={handleCancelEdit}>
                <Ionicons name='close' size={22} color='#9ca3af' />
              </Pressable>
            </View>
            <View style={styles.editInputContainer}>
              <Input
                value={editText}
                onChangeText={setEditText}
                placeholder='Edit message...'
                variant='filled'
                size='md'
                multiline
                maxLength={500}
              />
              <Pressable
                style={[styles.sendButton, editText.trim() ? styles.sendButtonActive : null]}
                onPress={handleSaveEdit}
                disabled={!editText.trim()}
              >
                <Ionicons
                  name='checkmark'
                  size={22}
                  color={editText.trim() ? '#FFFFFF' : '#9ca3af'}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <InputToolbar
            message={message}
            onChangeText={handleTyping}
            onSend={handleSendMessage}
            onAttach={handleAttachment}
            filePreview={filePreview}
            onRemoveAttachment={() => {
              setFile(null);
              setFilePreview(null);
            }}
          />
        )}

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
          maxHeight='25%'
        >
          <View style={styles.modalContent}>
            <MessageOptionItem icon='pencil' text='Edit' onPress={handleEditMessage} />
            <MessageOptionItem icon='copy-outline' text='Copy' onPress={handleCopyText} />
            <MessageOptionItem
              icon='trash-outline'
              text='Delete'
              onPress={handleDeleteMessage}
              color='#ef4444'
            />
          </View>
        </SwipeableModal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  userContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  userTextContainer: {
    marginLeft: 10,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
  },
  typingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageBubbleContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ownMessageBubble: {
    // Background color applied dynamically
  },
  otherMessageBubble: {
    // Background color applied dynamically
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  imageContainer: {
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  timeText: {
    fontSize: 11,
    marginRight: 4,
  },
  readStatus: {
    marginLeft: 2,
  },
  inputToolbar: {
    padding: 10,
    borderTopWidth: 1,
  },
  attachmentPreview: {
    marginBottom: 8,
    position: 'relative',
    width: 80,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    // Background color applied dynamically
  },
  modalContent: {
    padding: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  editContainer: {
    padding: 10,
    borderTopWidth: 1,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  editTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  editInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});

export default ChatWithUser;
