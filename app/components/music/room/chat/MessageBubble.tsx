import { SoundMessageRow } from '@/components/music/group/SoundMessageRow';
import { useTheme } from '@/context/ThemeContext';
import type { Message } from '@/stores/groupMusic/types';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import * as Haptics from 'expo-haptics';
import { memo, useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AnchorRect } from './MessageActions';
import { formatClock, isEmojiOnly, isGif, isSound, toReactionChips } from './chatUtils';
import { MessageReactions } from './MessageReactions';
import { ReplyQuote } from './ReplyQuote';
import { SwipeToReply } from './SwipeToReply';

type Props = {
  message: Message;
  own: boolean;
  /** First message of a run from this sender: shows name + avatar and extra spacing. */
  groupStart: boolean;
  myId?: number | string;
  highlighted?: boolean;
  onReply: (m: Message) => void;
  /** Long-press with the bubble's on-screen rect, so the menu can grow from it. */
  onLongPress: (m: Message, anchor: AnchorRect) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onJumpTo: (messageId: string) => void;
};

/**
 * One chat message. Swipe right to reply, long-press for reactions and actions; reactions
 * and a reply quote render inline. Memoised on the message object, so a new message or a
 * reaction elsewhere doesn't re-render the rest of the list.
 */
export const MessageBubble = memo(function MessageBubble({
  message: m,
  own,
  groupStart,
  myId,
  highlighted,
  onReply,
  onLongPress,
  onToggleReaction,
  onJumpTo,
}: Props) {
  const { colors } = useTheme();
  const gif = isGif(m);
  const sound = isSound(m);
  const emoji = !gif && !sound && isEmojiOnly(m.message);
  const chips = useMemo(() => toReactionChips(m.reactions, myId), [m.reactions, myId]);

  const bubbleRef = useRef<View>(null);

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    bubbleRef.current?.measureInWindow((x, y, width, height) =>
      onLongPress(m, { x, y, width, height })
    );
  };

  const bubbleBg = own ? colors.primary : colors.raised;
  const textColor = own ? colors.primaryForeground : colors.foreground;
  const bare = gif || emoji;

  return (
    <SwipeToReply onReply={() => onReply(m)}>
      <View
        style={[
          styles.row,
          own && styles.rowOwn,
          groupStart && styles.groupStart,
          highlighted && { backgroundColor: `${colors.primary}14` },
        ]}
      >
        {!own && (
          <View style={styles.avatarSlot}>
            {groupStart && (
              <Image
                source={{ uri: getProfileCloudinaryUrl(m.profilePic) }}
                style={[styles.avatar, { backgroundColor: colors.muted }]}
                fadeDuration={0}
              />
            )}
          </View>
        )}

        <View style={[styles.column, own && styles.columnOwn]}>
          {!own && groupStart && (
            <Text style={[styles.name, { color: colors.mutedForeground }]} numberOfLines={1}>
              {m.userName || 'Someone'}
            </Text>
          )}

          <Pressable
            ref={bubbleRef}
            onLongPress={handleLongPress}
            delayLongPress={280}
            accessibilityHint='Long press for reactions. Swipe right to reply.'
            style={[
              bare ? styles.bare : styles.bubble,
              !bare && { backgroundColor: bubbleBg },
              !bare && (own ? styles.bubbleOwn : styles.bubbleOther),
            ]}
          >
            {m.replyTo?.id ? (
              <ReplyQuote reply={m.replyTo} own={own && !bare} onPress={onJumpTo} />
            ) : null}

            {gif ? (
              <Image
                source={{ uri: m.gifUrl }}
                style={styles.gif}
                resizeMode='cover'
                fadeDuration={0}
              />
            ) : sound ? (
              <SoundMessageRow msg={m} isOwn={own} />
            ) : emoji ? (
              <Text style={styles.emoji}>{m.message}</Text>
            ) : (
              <Text style={[styles.text, { color: textColor }]}>
                {m.message}
                <Text
                  style={[
                    styles.time,
                    { color: own ? `${colors.primaryForeground}B0` : colors.mutedForeground },
                  ]}
                >
                  {'  '}
                  {formatClock(m.timestamp)}
                </Text>
              </Text>
            )}
          </Pressable>

          <MessageReactions
            chips={chips}
            own={own}
            onToggle={(emojiKey) => onToggleReaction(m.id, emojiKey)}
          />
        </View>
      </View>
    </SwipeToReply>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 2 },
  rowOwn: { justifyContent: 'flex-end' },
  groupStart: { marginTop: 10 },
  avatarSlot: { width: 30, marginRight: 8 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  column: { maxWidth: '78%', alignItems: 'flex-start' },
  columnOwn: { alignItems: 'flex-end' },
  name: { fontSize: 12, fontWeight: '600', marginBottom: 3, marginLeft: 4 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleOwn: { borderBottomRightRadius: 6 },
  bubbleOther: { borderBottomLeftRadius: 6 },
  bare: { paddingVertical: 2 },
  text: { fontSize: 15, lineHeight: 20 },
  time: { fontSize: 10.5 },
  emoji: { fontSize: 36, lineHeight: 44 },
  gif: { width: 200, height: 150, borderRadius: 14 },
});
