import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather, Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/SwipeableModal';
import { useTheme } from '@/context/ThemeContext';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { Message } from '@/stores/groupMusic/types';

import { SoundMessageRow } from './SoundMessageRow';
import { SoundPickerModal } from './SoundPickerModal';
import { GifPickerModal } from './GifPickerModal';
import { soundEffectsManager } from '@/utils/soundEffectsManager';
import { SoundEffectItem } from '@/utils/api/soundEffects';

const EMOJI_ONLY_REGEX =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\s*(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)){0,2}$/u;

const isEmojiOnly = (text: string) => {
  if (!text || text.length > 20) return false;
  return EMOJI_ONLY_REGEX.test(text.trim());
};

const isGifMessage = (msg: Message) => msg.messageType === 'gif' && !!msg.gifUrl;
const isImageUrl = (text: string) =>
  /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(text?.trim() || '');

const ACTIVITY_COLORS: Record<string, { icon: string; bg: string; text: string }> = {
  'now playing': { icon: '#34d399', bg: '#34d39915', text: '#34d39990' },
  queue: { icon: '#60a5fa', bg: '#60a5fa15', text: '#60a5fa90' },
  skipped: { icon: '#fbbf24', bg: '#fbbf2415', text: '#fbbf2490' },
  joined: { icon: '#34d399', bg: '#34d39915', text: '#34d39990' },
  left: { icon: '#fb7185', bg: '#fb718515', text: '#fb718590' },
  'queue ended': { icon: '#a78bfa', bg: '#a78bfa15', text: '#a78bfa90' },
};

const getActivityMeta = (message: string) => {
  const lower = message?.toLowerCase() || '';
  for (const [keyword, meta] of Object.entries(ACTIVITY_COLORS)) {
    if (lower.includes(keyword)) return meta;
  }
  return { icon: '#888', bg: '#88888815', text: '#88888860' };
};

const getActivityIcon = (message: string): string => {
  const lower = message?.toLowerCase() || '';
  if (lower.includes('now playing') || lower.includes('play')) return 'play';
  if (lower.includes('queue')) return 'list';
  if (lower.includes('skip')) return 'skip-forward';
  if (lower.includes('joined')) return 'user-plus';
  if (lower.includes('left')) return 'user-minus';
  return 'message-circle';
};

const ActivityMessageRow = React.memo(({ msg }: { msg: Message }) => {
  const meta = getActivityMeta(msg.message);
  const icon = getActivityIcon(msg.message);

  return (
    <View style={styles.activityContainer}>
      <View style={[styles.activityBadge, { backgroundColor: meta.bg }]}>
        <Feather name={icon as any} size={10} color={meta.icon} />
        <Text style={[styles.activityText, { color: meta.text }]} numberOfLines={1}>
          {msg.message}
        </Text>
      </View>
    </View>
  );
});

const ChatBubble = React.memo(
  ({
    msg,
    isOwn,
    showAvatar,
    colors,
  }: {
    msg: Message;
    isOwn: boolean;
    showAvatar: boolean;
    colors: any;
  }) => {
    const isSound = msg.messageType === 'sound' || Boolean(msg.soundUrl);
    const isGif = isGifMessage(msg);
    const isImg = !isGif && !isSound && isImageUrl(msg.message);
    const isMedia = isGif || isImg;
    const emoji = !isMedia && !isSound && isEmojiOnly(msg.message);

    const mediaUrl = isGif ? msg.gifUrl : isImg ? msg.message : null;

    return (
      <View
        style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn, showAvatar && { marginTop: 10 }]}
      >
        {!isOwn && (
          <View style={styles.avatarSlot}>
            {showAvatar && (
              <Image
                source={{
                  uri: getProfileCloudinaryUrl(msg.profilePic) || 'https://via.placeholder.com/28',
                }}
                style={styles.bubbleAvatar}
              />
            )}
          </View>
        )}

        {isMedia ? (
          <View>
            {!isOwn && showAvatar && (
              <Text style={[styles.bubbleName, { color: colors.mutedForeground + '80' }]}>
                {msg.userName}
              </Text>
            )}
            <View style={styles.mediaContainer}>
              <Image source={{ uri: mediaUrl! }} style={styles.mediaImage} resizeMode='cover' />
            </View>
          </View>
        ) : (
          <View
            style={[
              emoji && !isSound
                ? styles.emojiContainer
                : isOwn
                  ? [styles.bubbleOwn, { backgroundColor: colors.primary }]
                  : [styles.bubbleOther, { backgroundColor: colors.secondary }],
            ]}
          >
            {!isOwn && showAvatar && !emoji && (
              <Text style={[styles.bubbleName, { color: colors.mutedForeground + '80' }]}>
                {msg.userName}
              </Text>
            )}
            {isSound ? (
              <SoundMessageRow msg={msg} isOwn={isOwn} />
            ) : emoji ? (
              <Text style={styles.emojiText}>{msg.message}</Text>
            ) : (
              <Text
                style={[
                  styles.bubbleText,
                  { color: isOwn ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {msg.message}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }
);

const TypingDot = ({ delay }: { delay: number }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    const timeout = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
        -1
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.typingDot, style]} />;
};

const TypingIndicator = React.memo(
  ({ typingUsers, colors }: { typingUsers: Record<string, string>; colors: any }) => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;

    const label =
      names.length === 1
        ? `${names[0]} is typing`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing`
          : `${names.length} people are typing`;

    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.typingContainer}>
        <View style={styles.typingDots}>
          <TypingDot delay={0} />
          <TypingDot delay={150} />
          <TypingDot delay={300} />
        </View>
        <Text style={[styles.typingLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </Animated.View>
    );
  }
);

interface ChatScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ isOpen, onClose }) => {
  const { colors } = useTheme();
  const { sendMessage, startTyping, stopTyping, user } = useGroupMusic();
  const messages = useGroupSessionStore((s) => s.messages);
  const typingUsers = useGroupSessionStore((s) => s.typingUsers);

  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [sfxAutoPlay, setSfxAutoPlay] = useState(() => soundEffectsManager.getAutoPlay());

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<any>(null);

  const handleToggleSfx = useCallback(() => {
    const next = !sfxAutoPlay;
    setSfxAutoPlay(next);
    soundEffectsManager.setAutoPlay(next);
  }, [sfxAutoPlay]);

  const handleSelectSound = useCallback(
    (sound: SoundEffectItem) => {
      setShowAttachMenu(false);
      sendMessage(sound.url, 'sound', {
        soundUrl: sound.url,
        soundName: sound.name,
        soundId: sound.id,
      });
    },
    [sendMessage]
  );

  const handleGifSelect = useCallback(
    (gifUrl: string) => {
      sendMessage(gifUrl, 'gif');
      setShowGifPicker(false);
      setShowAttachMenu(false);
    },
    [sendMessage]
  );

  useEffect(() => {
    if (!isOpen) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isOpen]);

  useEffect(() => {
    if (messages.length > 0 && isOpen) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isOpen]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    sendMessage(text);
    setInputText('');
    stopTyping();
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, [inputText, sendMessage, stopTyping]);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (text.trim()) {
        startTyping();
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(stopTyping, 2000);
      } else {
        stopTyping();
      }
    },
    [startTyping, stopTyping]
  );

  const scrollOffset = useSharedValue(0);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.value = event.nativeEvent.contentOffset.y;
    },
    [scrollOffset]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      if (item.type === 'activity') {
        return <ActivityMessageRow msg={item} />;
      }
      const isOwn = String(item.senderId) === String(user?.userid);
      const prev = index > 0 ? messages[index - 1] : null;
      const showAvatar =
        !isOwn &&
        (!prev || prev.type === 'activity' || String(prev.senderId) !== String(item.senderId));

      return <ChatBubble msg={item} isOwn={isOwn} showAvatar={showAvatar} colors={colors} />;
    },
    [user?.userid, messages, colors]
  );

  const keyExtractor = useCallback((item: Message, index: number) => item.id || String(index), []);

  return (
    <>
      <SwipeableModal
        isVisible={isOpen}
        onClose={onClose}
        maxHeight={Dimensions.get('window').height * 0.88}
        style={{ height: Dimensions.get('window').height * 0.88 }}
        scrollable={true}
        scrollOffset={scrollOffset}
      >
        <View style={[styles.flex, { paddingBottom: keyboardHeight }]}>
          <View style={styles.header}>
            <Feather name='message-circle' size={18} color={colors.foreground} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Group Chat</Text>

            <View style={styles.headerRightControls}>
              <TouchableOpacity
                onPress={handleToggleSfx}
                style={[
                  styles.sfxToggleBtn,
                  {
                    backgroundColor: sfxAutoPlay ? colors.primary + '18' : colors.secondary,
                    borderColor: sfxAutoPlay ? colors.primary + '40' : colors.border + '30',
                  },
                ]}
                activeOpacity={0.7}
              >
                <Feather
                  name={sfxAutoPlay ? 'volume-2' : 'volume-x'}
                  size={12}
                  color={sfxAutoPlay ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.sfxToggleText,
                    { color: sfxAutoPlay ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  SFX {sfxAutoPlay ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name='x' size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border + '40' }]} />

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name='message-circle' size={20} color={colors.mutedForeground + '40'} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.mutedForeground + '70' }]}>
                  No messages yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground + '40' }]}>
                  Say something to the group!
                </Text>
              </View>
            }
          />

          <TypingIndicator typingUsers={typingUsers} colors={colors} />

          {/* Attachment row */}
          {showAttachMenu && (
            <View style={[styles.attachRow, { backgroundColor: colors.secondary + '80' }]}>
              <TouchableOpacity
                onPress={() => {
                  setShowSoundPicker(true);
                  setShowAttachMenu(false);
                }}
                style={[styles.attachOption, { backgroundColor: colors.background }]}
                activeOpacity={0.7}
              >
                <Ionicons name='volume-high' size={16} color={colors.primary} />
                <Text style={[styles.attachLabel, { color: colors.foreground }]}>Sounds</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowGifPicker(true);
                  setShowAttachMenu(false);
                }}
                style={[styles.attachOption, { backgroundColor: colors.background }]}
                activeOpacity={0.7}
              >
                <Feather name='film' size={16} color={colors.primary} />
                <Text style={[styles.attachLabel, { color: colors.foreground }]}>GIF</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputContainer, { borderTopColor: colors.border + '30' }]}>
            <TouchableOpacity
              onPress={() => setShowAttachMenu((v) => !v)}
              style={[
                styles.attachBtn,
                {
                  backgroundColor: showAttachMenu ? colors.primary : colors.secondary,
                },
              ]}
              activeOpacity={0.75}
            >
              <Feather
                name='plus'
                size={18}
                color={showAttachMenu ? colors.primaryForeground : colors.mutedForeground}
              />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                },
              ]}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder='Type a message...'
              placeholderTextColor={colors.mutedForeground + '60'}
              multiline
              maxLength={500}
              returnKeyType='send'
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: inputText.trim() ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Feather
                name='send'
                size={15}
                color={inputText.trim() ? colors.primaryForeground : colors.mutedForeground + '40'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </SwipeableModal>

      {showSoundPicker && (
        <SoundPickerModal
          isOpen={showSoundPicker}
          onClose={() => setShowSoundPicker(false)}
          onSelectSound={handleSelectSound}
        />
      )}

      <GifPickerModal
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
      />
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  activityContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityText: {
    fontSize: 11,
    maxWidth: 260,
  },
  bubbleRow: {
    flexDirection: 'row',
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  avatarSlot: {
    width: 28,
    marginRight: 6,
    alignSelf: 'flex-end',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  bubbleOwn: {
    maxWidth: '72%',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bubbleOther: {
    maxWidth: '72%',
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bubbleName: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 20,
  },
  emojiContainer: {
    paddingVertical: 2,
  },
  emojiText: {
    fontSize: 40,
    lineHeight: 48,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 6,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#888',
  },
  typingLabel: {
    fontSize: 11,
  },
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 220,
  },
  mediaImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  attachLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  input: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    flex: 1,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 11,
    marginTop: 3,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
  sfxToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  sfxToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
