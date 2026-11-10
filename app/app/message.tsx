import ImageGallery from '@/components/ImageGallery';
import SwipeableModal from '@/components/SwipeableModal';
import ChatInput from '@/components/chat/ChatInput';
import DateBubble from '@/components/chat/DateBubble';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageHeader from '@/components/chat/MessageHeader';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import {
  deleteMessage,
  discardMessage,
  editMessage,
  loadOlder,
  loadThread,
  markRead,
  retryMessage,
  sendMessage,
  setTyping,
  toggleReaction,
  type PickedPhoto,
} from '@/lib/chat';
import { BUTTON_PRESS_SCALE, EASE_OUT, ROW_PRESS_SCALE } from '@/lib/motion';
import {
  messageStatus,
  selectConversation,
  selectThread,
  useChatStore,
  type ChatMessage,
} from '@/stores/chatStore';
import { saveImageToGallery } from '@/utils/saveImage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import { SafeAreaView } from 'react-native-safe-area-context';

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢'];

const formatFullDateTime = (dateString?: string | null) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString(undefined, {
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

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};

/** A gap this long starts a new run of messages, even from the same person. */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** Scrolled this far back, a button appears to return to the latest message. */
const JUMP_BUTTON_AFTER = 400;
/** Time for one sheet to get out of the way before another opens. */
const SHEET_SWAP_MS = 200;

const JUMP_ENTER = FadeIn.duration(140).easing(EASE_OUT);
const JUMP_EXIT = FadeOut.duration(100).easing(EASE_OUT);

type Row =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; message: ChatMessage; startsGroup: boolean; endsGroup: boolean };

const ChatWithUser = () => {
  const { colors } = useTheme();

  const activeId = useChatStore((s) => s.activeId);
  const meId = useChatStore((s) => s.meId);
  const conversation = useChatStore(selectConversation(activeId));
  const thread = useChatStore(selectThread(activeId));
  const isOnline = useChatStore((s) =>
    Boolean(conversation && s.presence[conversation.peer.userid])
  );
  const isTyping = useChatStore((s) => Boolean(activeId && s.typing[activeId]));

  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [sheet, setSheet] = useState<'options' | 'confirm-delete' | 'info' | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const listRef = useRef<FlatList<Row>>(null);
  const { messages } = thread;
  const peerName = conversation?.peer.name ?? '';

  useEffect(() => {
    if (activeId) void loadThread(activeId);
  }, [activeId]);

  // Leaving the screen closes the conversation, so new messages count as unread again.
  useEffect(
    () => () => {
      const { activeId: current, setActive } = useChatStore.getState();
      if (current) setTyping(current, false);
      setActive(null);
    },
    []
  );

  // Read receipts go out only while the conversation is on screen with the app in front.
  const lastId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].id != null) return messages[i].id;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    if (!activeId || thread.status !== 'ready') return;
    if (AppState.currentState === 'active') markRead(activeId);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') markRead(activeId);
    });
    return () => subscription.remove();
  }, [activeId, thread.status, lastId]);

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value);
      if (activeId) setTyping(activeId, value.trim().length > 0);
    },
    [activeId]
  );

  const handleSend = useCallback(() => {
    if (!activeId || (!text.trim() && !photo)) return;
    sendMessage(activeId, { body: text, photo, replyTo });
    setText('');
    setPhoto(null);
    setReplyTo(null);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [activeId, text, photo, replyTo]);

  const handleAttachment = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast('Allow SyncVibe to see your photos in your phone settings', { type: 'error' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        allowsMultipleSelection: false,
      });
      const asset = result.canceled ? null : result.assets?.[0];
      if (asset) {
        setPhoto({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  }, []);

  // Newest first, for the inverted list. Items keep the same message objects between renders, so
  // only rows whose message changed draw again.
  const rows = useMemo(() => {
    const sameRun = (a?: ChatMessage, b?: ChatMessage) =>
      Boolean(
        a &&
        b &&
        a.type !== 'call' &&
        b.type !== 'call' &&
        a.senderId === b.senderId &&
        formatDate(a.createdAt) === formatDate(b.createdAt) &&
        Math.abs(Date.parse(a.createdAt) - Date.parse(b.createdAt)) < GROUP_GAP_MS
      );

    const result: Row[] = [];
    messages.forEach((message, i) => {
      const before = messages[i - 1];
      const date = formatDate(message.createdAt);
      if (!before || formatDate(before.createdAt) !== date) {
        result.push({ type: 'date', id: `date-${message.clientId}`, date });
      }
      result.push({
        type: 'message',
        message,
        startsGroup: !sameRun(before, message),
        endsGroup: !sameRun(message, messages[i + 1]),
      });
    });
    return result.reverse();
  }, [messages]);

  const images = useMemo(
    () =>
      messages
        .filter((m) => m.attachment?.url && m.id != null)
        .map((m) => ({ id: m.id, url: m.attachment!.url })),
    [messages]
  );

  const handleImagePress = useCallback(
    (message: ChatMessage) => {
      const index = images.findIndex((image) => image.id === message.id);
      if (index !== -1) setGalleryIndex(index);
    },
    [images]
  );

  const handleLongPress = useCallback((message: ChatMessage) => {
    Keyboard.dismiss();
    setSelected(message);
    setSheet('options');
  }, []);

  const handleReact = useCallback((message: ChatMessage, emoji: string) => {
    if (message.id == null) return;
    toggleReaction(message, emoji).catch(() =>
      toast("Couldn't add your reaction. Try again.", { type: 'error' })
    );
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const handleReply = useCallback(() => {
    setSheet(null);
    setEditing(null);
    setReplyTo(selected);
  }, [selected]);

  const handleStartEdit = useCallback(() => {
    if (!selected) return;
    setSheet(null);
    setReplyTo(null);
    setEditText(selected.body || '');
    setEditing(selected);
  }, [selected]);

  const handleSaveEdit = useCallback(async () => {
    const target = editing;
    const body = editText.trim();
    setEditing(null);
    setEditText('');
    if (!target || body === (target.body || '')) return;
    try {
      await editMessage(target, body);
    } catch {
      toast("Couldn't save your edit. Try again.", { type: 'error' });
    }
  }, [editing, editText]);

  const handleDelete = useCallback(() => {
    const target = selected;
    if (!target) return;
    // Never reached the server, so there's nothing to delete there.
    if (target.id == null) {
      setSheet(null);
      discardMessage(target);
      return;
    }
    setSheet('confirm-delete');
  }, [selected]);

  const handleConfirmDelete = useCallback(async () => {
    const target = selected;
    setSheet(null);
    if (!target) return;
    try {
      await deleteMessage(target);
    } catch {
      toast("Couldn't delete the message. Try again.", { type: 'error' });
    }
  }, [selected]);

  const handleCopyText = useCallback(async () => {
    setSheet(null);
    if (!selected?.body) return;
    await Clipboard.setStringAsync(selected.body);
    toast('Copied');
  }, [selected]);

  const handleSavePhoto = useCallback(async () => {
    setSheet(null);
    if (!selected?.attachment) return;
    try {
      await saveImageToGallery(selected.attachment.url);
      toast('Saved to gallery', { type: 'success' });
    } catch (error) {
      toast(
        error instanceof Error && error.message === 'permission'
          ? 'Allow SyncVibe to add photos in your phone settings'
          : "Couldn't save the photo",
        { type: 'error' }
      );
    }
  }, [selected]);

  const handleShowInfo = useCallback(() => {
    setSheet(null);
    setTimeout(() => setSheet('info'), SHEET_SWAP_MS);
  }, []);

  const handleListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowJumpToLatest(e.nativeEvent.contentOffset.y > JUMP_BUTTON_AFTER);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.type === 'date') return <DateBubble date={item.date} />;
      const isOwn = item.message.senderId === meId;
      return (
        <MessageBubble
          message={item.message}
          isOwn={isOwn}
          meId={meId}
          peerName={peerName}
          status={isOwn ? messageStatus(item.message, conversation) : null}
          startsGroup={item.startsGroup}
          endsGroup={item.endsGroup}
          onImagePress={handleImagePress}
          onLongPress={handleLongPress}
          onReact={handleReact}
          onRetry={retryMessage}
        />
      );
    },
    [meId, peerName, conversation, handleImagePress, handleLongPress, handleReact]
  );

  const keyExtractor = useCallback(
    (item: Row) => (item.type === 'date' ? item.id : `msg-${item.message.clientId}`),
    []
  );

  const selectedIsOwn = selected?.senderId === meId;
  const selectedOnServer = selected?.id != null;
  const selectedStatus = selected ? messageStatus(selected, conversation) : null;
  const myReaction = selected?.reactions.find(
    (r) => meId != null && r.userIds.includes(meId)
  )?.emoji;
  const loading = thread.status === 'loading' || thread.status === 'idle';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <KeyboardAvoidingView behavior='padding' style={styles.container}>
        <MessageHeader
          onBack={() => router.back()}
          user={conversation?.peer}
          isOnline={isOnline}
          isTyping={isTyping}
        />

        <View style={styles.container}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size='large' color={colors.primary} />
            </View>
          ) : thread.status === 'error' ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Couldn't load messages
              </Text>
              <PressableScale
                onPress={() => activeId && loadThread(activeId)}
                scaleTo={BUTTON_PRESS_SCALE}
                accessibilityRole='button'
                style={[styles.retry, { borderColor: colors.border }]}
              >
                <Text style={[styles.retryText, { color: colors.foreground }]}>Try again</Text>
              </PressableScale>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Say hello to {peerName.split(' ')[0] || 'them'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Your messages will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              inverted
              data={rows}
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
              // The list is upside down, so its end is the oldest message.
              onEndReached={() => activeId && loadOlder(activeId)}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                thread.loadingOlder ? (
                  <ActivityIndicator style={styles.older} color={colors.mutedForeground} />
                ) : null
              }
            />
          )}

          {showJumpToLatest ? (
            <Animated.View entering={JUMP_ENTER} exiting={JUMP_EXIT} style={styles.jump}>
              <PressableScale
                onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
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
          message={text}
          onChangeText={handleChangeText}
          onSend={handleSend}
          onAttach={handleAttachment}
          filePreview={photo?.uri ?? null}
          onRemoveAttachment={() => setPhoto(null)}
          replyingTo={
            replyTo
              ? {
                  name: replyTo.senderId === meId ? 'yourself' : peerName,
                  text: replyTo.body || 'Photo',
                }
              : null
          }
          onCancelReply={() => setReplyTo(null)}
          editMode={Boolean(editing)}
          editText={editText}
          onEditTextChange={setEditText}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => {
            setEditing(null);
            setEditText('');
          }}
        />

        {galleryIndex != null && images.length > 0 ? (
          <ImageGallery
            images={images.map((image) => image.url)}
            initialIndex={Math.min(galleryIndex, images.length - 1)}
            onClose={() => setGalleryIndex(null)}
          />
        ) : null}

        <SwipeableModal isVisible={sheet === 'options'} onClose={closeSheet} dragAnywhere>
          <View style={styles.sheet}>
            {selectedOnServer ? (
              <View style={styles.reactionRow}>
                {QUICK_REACTIONS.map((emoji) => (
                  <PressableScale
                    key={emoji}
                    onPress={() => {
                      setSheet(null);
                      if (selected) handleReact(selected, emoji);
                    }}
                    scaleTo={BUTTON_PRESS_SCALE}
                    accessibilityRole='button'
                    accessibilityLabel={`React ${emoji}`}
                    accessibilityState={{ selected: myReaction === emoji }}
                    style={[
                      styles.reactionButton,
                      myReaction === emoji ? { backgroundColor: colors.raised } : null,
                    ]}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </PressableScale>
                ))}
              </View>
            ) : null}
            {selectedOnServer ? (
              <OptionItem icon='arrow-undo-outline' text='Reply' onPress={handleReply} />
            ) : null}
            {selected?.body ? (
              <OptionItem icon='copy-outline' text='Copy text' onPress={handleCopyText} />
            ) : null}
            {selected?.attachment && selectedOnServer ? (
              <OptionItem icon='download-outline' text='Save photo' onPress={handleSavePhoto} />
            ) : null}
            {selectedIsOwn && selectedOnServer ? (
              <OptionItem
                icon='pencil-outline'
                text={selected?.body ? 'Edit' : 'Add a caption'}
                onPress={handleStartEdit}
              />
            ) : null}
            {selectedIsOwn && selectedOnServer ? (
              <OptionItem
                icon='information-circle-outline'
                text='Message info'
                onPress={handleShowInfo}
              />
            ) : null}
            {selectedIsOwn ? (
              <OptionItem
                icon='trash-outline'
                text='Delete'
                onPress={handleDelete}
                color={colors.destructive}
              />
            ) : null}
          </View>
        </SwipeableModal>

        <SwipeableModal isVisible={sheet === 'confirm-delete'} onClose={closeSheet} dragAnywhere>
          <View style={styles.sheet}>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
              Delete this message?
            </Text>
            <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>
              It will be removed for both of you. This can't be undone.
            </Text>
            <OptionItem
              icon='trash-outline'
              text='Delete for everyone'
              onPress={handleConfirmDelete}
              color={colors.destructive}
            />
            <OptionItem icon='close-outline' text='Cancel' onPress={closeSheet} />
          </View>
        </SwipeableModal>

        <SwipeableModal isVisible={sheet === 'info'} onClose={closeSheet} dragAnywhere>
          <View style={styles.sheet}>
            <InfoRow icon='check' label='Sent' value={formatFullDateTime(selected?.createdAt)} />
            <InfoRow
              icon='check-all'
              label='Delivered'
              value={
                selectedStatus === 'delivered' || selectedStatus === 'read'
                  ? 'Delivered'
                  : 'Not yet'
              }
            />
            <InfoRow
              icon='check-all'
              label='Read'
              value={
                selectedStatus !== 'read'
                  ? 'Not yet'
                  : // The time is known only for the latest message the other person has read.
                    (selected?.id === conversation?.peerLastReadMessageId &&
                      formatFullDateTime(conversation?.peerLastReadAt)) ||
                    'Read'
              }
            />
            {selected?.editedAt ? (
              <InfoRow
                icon='pencil-outline'
                label='Edited'
                value={formatFullDateTime(selected.editedAt)}
              />
            ) : null}
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
  retry: {
    marginTop: 14,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontSize: 14, fontWeight: '600' },
  messageList: { paddingHorizontal: 12, paddingVertical: 12 },
  older: { paddingVertical: 16 },
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
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  reactionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 26 },
  confirmTitle: { fontSize: 17, fontWeight: '600', paddingHorizontal: 12, paddingTop: 4 },
  confirmText: { fontSize: 14, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
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
