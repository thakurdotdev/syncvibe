import { GifPickerModal } from '@/components/music/group/GifPickerModal';
import { SoundPickerModal } from '@/components/music/group/SoundPickerModal';
import PressableScale from '@/components/ui/PressableScale';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import type { Message, ReplyRef } from '@/stores/groupMusic/types';
import type { SoundEffectItem } from '@/utils/api/soundEffects';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ActivityRow } from './ActivityRow';
import { isActivity, sameUser, startsGroup, toReplyRef } from './chatUtils';
import { Composer } from './Composer';
import { MessageActions, type AnchorRect } from './MessageActions';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

const AT_BOTTOM_PX = 120;
const HIGHLIGHT_MS = 1400;

/**
 * Room chat: replies (swipe or long-press), reactions, GIFs, sound effects and typing.
 * The list is inverted so the newest message is at the bottom without measuring, and
 * appending a message never re-lays out the history.
 */
export const ChatPanel = memo(function ChatPanel({ bottomInset = 0 }: { bottomInset?: number }) {
  const { colors } = useTheme();
  const { sendMessage, reactToMessage, startTyping, stopTyping, user } = useGroupMusic();
  const messages = useGroupSessionStore((s) => s.messages);

  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [menuFor, setMenuFor] = useState<{
    message: Message;
    anchor: AnchorRect;
    own: boolean;
  } | null>(null);
  const [picker, setPicker] = useState<'gif' | 'sound' | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [missed, setMissed] = useState(0);

  const listRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);
  const lastCount = useRef(messages.length);
  const myId = user?.userid;

  // Newest first for the inverted list.
  const data = useMemo(() => [...messages].reverse(), [messages]);

  // Count messages that arrive while you're scrolled up, for the "new messages" pill.
  useEffect(() => {
    const added = messages.length - lastCount.current;
    lastCount.current = messages.length;
    if (added > 0 && !atBottom) setMissed((n) => n + added);
  }, [messages.length, atBottom]);

  const scrollToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setMissed(0);
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const bottom = e.nativeEvent.contentOffset.y < AT_BOTTOM_PX;
    setAtBottom((prev) => (prev === bottom ? prev : bottom));
    if (bottom) setMissed(0);
  }, []);

  const openMenu = useCallback(
    (message: Message, anchor: AnchorRect) =>
      setMenuFor({ message, anchor, own: sameUser(message.senderId, myId) }),
    [myId]
  );

  const startReply = useCallback((m: Message) => {
    setReplyTo(toReplyRef(m));
    inputRef.current?.focus();
  }, []);

  const jumpTo = useCallback(
    (id: string) => {
      const index = data.findIndex((m) => m.id === id);
      if (index < 0) return;
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setHighlightId(id);
      setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), HIGHLIGHT_MS);
    },
    [data]
  );

  const send = useCallback(
    (text: string) => {
      sendMessage(text, 'text', replyTo ? { replyTo } : {});
      setReplyTo(null);
      scrollToLatest();
    },
    [sendMessage, replyTo, scrollToLatest]
  );

  const sendGif = useCallback(
    (url: string) => {
      sendMessage(url, 'gif', replyTo ? { replyTo } : {});
      setReplyTo(null);
      setPicker(null);
      scrollToLatest();
    },
    [sendMessage, replyTo, scrollToLatest]
  );

  const sendSound = useCallback(
    (sound: SoundEffectItem) => {
      sendMessage(sound.url, 'sound', {
        soundUrl: sound.url,
        soundName: sound.name,
        soundId: sound.id,
      });
      setPicker(null);
      scrollToLatest();
    },
    [sendMessage, scrollToLatest]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      if (isActivity(item)) return <ActivityRow message={item} />;
      return (
        <MessageBubble
          message={item}
          own={sameUser(item.senderId, myId)}
          groupStart={startsGroup(item, data[index + 1])}
          myId={myId}
          highlighted={highlightId === item.id}
          onReply={startReply}
          onLongPress={openMenu}
          onToggleReaction={reactToMessage}
          onJumpTo={jumpTo}
        />
      );
    },
    [data, myId, highlightId, startReply, openMenu, reactToMessage, jumpTo]
  );

  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]}>
      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          data={data}
          inverted
          keyExtractor={(m, i) => m.id || String(i)}
          renderItem={renderItem}
          onScroll={handleScroll}
          scrollEventThrottle={64}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode='interactive'
          contentContainerStyle={data.length ? styles.listContent : styles.emptyContent}
          onScrollToIndexFailed={({ index }) =>
            listRef.current?.scrollToOffset({ offset: index * 60, animated: true })
          }
          initialNumToRender={18}
          maxToRenderPerBatch={12}
          windowSize={9}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
                <Feather name='message-circle' size={22} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Say hi to the room
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Messages, GIFs and sounds show up here for everyone listening.
              </Text>
            </View>
          }
        />

        {missed > 0 && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(100)}
            style={styles.pillWrap}
          >
            <PressableScale
              onPress={scrollToLatest}
              accessibilityRole='button'
              accessibilityLabel={`${missed} new messages. Jump to latest`}
              style={[styles.pill, { backgroundColor: colors.primary }]}
            >
              <Ionicons name='arrow-down' size={14} color={colors.primaryForeground} />
              <Text style={[styles.pillText, { color: colors.primaryForeground }]}>
                {missed} new
              </Text>
            </PressableScale>
          </Animated.View>
        )}
      </View>

      <TypingIndicator />

      <Composer
        ref={inputRef}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={send}
        onOpenGifs={() => setPicker('gif')}
        onOpenSounds={() => setPicker('sound')}
        onTypingStart={startTyping}
        onTypingStop={stopTyping}
      />

      <MessageActions
        target={menuFor}
        myId={myId}
        onClose={() => setMenuFor(null)}
        onReact={reactToMessage}
        onReply={startReply}
      />

      {picker === 'gif' && (
        <GifPickerModal isOpen onClose={() => setPicker(null)} onSelect={sendGif} />
      )}
      {picker === 'sound' && (
        <SoundPickerModal isOpen onClose={() => setPicker(null)} onSelectSound={sendSound} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  listWrap: { flex: 1, minHeight: 0 },
  listContent: { paddingVertical: 8 },
  emptyContent: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
    // The list is inverted, so flip the empty state back upright.
    transform: [{ scaleY: -1 }],
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
  pillWrap: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
  },
  pillText: { fontSize: 12.5, fontWeight: '700' },
});
