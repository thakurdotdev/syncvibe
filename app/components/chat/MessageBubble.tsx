import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import type { ChatMessage, MessageStatus } from '@/stores/chatStore';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  meId: number | null;
  peerName: string;
  /** Sending, sent, delivered or read: only for the user's own messages. */
  status: MessageStatus | null;
  /** Messages in a row from one person sit together; time shows once, at the end of the run. */
  startsGroup: boolean;
  endsGroup: boolean;
  onImagePress: (message: ChatMessage) => void;
  onLongPress: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onRetry: (message: ChatMessage) => void;
}

const formatTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDuration = (seconds = 0) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const LONG_PRESS_MS = 300;
const IMAGE_WIDTH = 240;

const STATUS_ICON: Record<MessageStatus, { name: any; label: string }> = {
  sending: { name: 'clock-outline', label: 'Sending' },
  failed: { name: 'alert-circle', label: 'Not sent' },
  sent: { name: 'check', label: 'Sent' },
  delivered: { name: 'check-all', label: 'Delivered' },
  read: { name: 'check-all', label: 'Read' },
};

const callLabel = (message: ChatMessage, isOwn: boolean) => {
  const outcome = message.call?.outcome;
  if (outcome === 'missed') return isOwn ? 'No answer' : 'Missed call';
  if (outcome === 'rejected') return isOwn ? 'Call declined' : 'Declined call';
  return `Video call · ${formatDuration(message.call?.durationSec)}`;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  meId,
  peerName,
  status,
  startsGroup,
  endsGroup,
  onImagePress,
  onLongPress,
  onReact,
  onRetry,
}) => {
  const { colors } = useTheme();
  const failed = status === 'failed';
  const sending = status === 'sending';
  const image = message.attachment;
  const reply = message.replyTo;

  if (message.type === 'call') {
    const missed = message.call?.outcome !== 'completed';
    return (
      <View style={[styles.call, { borderColor: colors.border }]}>
        <MaterialCommunityIcons
          name={missed ? 'phone-missed' : 'video'}
          size={15}
          color={missed ? colors.destructive : colors.mutedForeground}
        />
        <Text style={[styles.callText, { color: colors.foreground }]}>
          {callLabel(message, isOwn)}
        </Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    );
  }

  // The corners facing the same person's other messages tuck in, joining the run up.
  const corners = isOwn
    ? {
        borderTopRightRadius: startsGroup ? RADIUS : TUCKED,
        borderBottomRightRadius: endsGroup ? RADIUS : TUCKED,
      }
    : {
        borderTopLeftRadius: startsGroup ? RADIUS : TUCKED,
        borderBottomLeftRadius: endsGroup ? RADIUS : TUCKED,
      };

  const openActions = () => onLongPress(message);
  const textColor = isOwn ? colors.primaryForeground : colors.foreground;
  const imageHeight =
    image?.width && image?.height
      ? Math.min(360, Math.max(120, (IMAGE_WIDTH * image.height) / image.width))
      : IMAGE_WIDTH;
  const showMeta = (endsGroup || Boolean(message.editedAt) || sending) && !failed;

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.own : styles.other,
        { marginTop: startsGroup ? 10 : 2 },
      ]}
    >
      {image ? (
        <PressableScale
          onPress={() => onImagePress(message)}
          onLongPress={openActions}
          delayLongPress={LONG_PRESS_MS}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityRole='imagebutton'
          accessibilityLabel='Photo. Tap to view, hold for options'
        >
          <Image
            source={{
              uri: message.localUrl || getOptimizedImageUrl(image.url, { thumbnail: true }),
            }}
            style={[styles.image, corners, { height: imageHeight, backgroundColor: colors.raised }]}
            resizeMode='cover'
            fadeDuration={0}
          />
          {sending ? (
            <View style={[styles.sending, corners]}>
              <ActivityIndicator color='#fff' />
            </View>
          ) : null}
        </PressableScale>
      ) : null}

      {message.body || reply ? (
        <PressableScale
          onLongPress={openActions}
          delayLongPress={LONG_PRESS_MS}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityHint='Hold for options'
          style={[
            styles.bubble,
            corners,
            { backgroundColor: isOwn ? colors.primary : colors.raised },
            image ? styles.afterImage : null,
          ]}
        >
          {reply ? (
            <View style={[styles.reply, { borderLeftColor: textColor }]}>
              <Text style={[styles.replyAuthor, { color: textColor }]} numberOfLines={1}>
                {reply.senderId === meId ? 'You' : peerName}
              </Text>
              <Text
                style={[
                  styles.replyText,
                  { color: textColor },
                  reply.deleted ? styles.italic : null,
                ]}
                numberOfLines={2}
              >
                {reply.deleted
                  ? 'Deleted message'
                  : reply.body || (reply.hasAttachment ? 'Photo' : 'Message')}
              </Text>
            </View>
          ) : null}
          {message.body ? (
            <Text style={[styles.text, { color: textColor }]}>{message.body}</Text>
          ) : null}
        </PressableScale>
      ) : null}

      {message.reactions.length > 0 ? (
        <View style={styles.reactions}>
          {message.reactions.map(({ emoji, userIds }) => {
            const mine = meId != null && userIds.includes(meId);
            return (
              <PressableScale
                key={emoji}
                onPress={() => onReact(message, emoji)}
                hitSlop={6}
                accessibilityRole='button'
                accessibilityLabel={`${emoji} ${userIds.length}${mine ? ', including you' : ''}`}
                style={[
                  styles.reaction,
                  {
                    backgroundColor: colors.raised,
                    borderColor: mine ? colors.foreground : colors.border,
                  },
                ]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {userIds.length > 1 ? (
                  <Text style={[styles.reactionCount, { color: colors.foreground }]}>
                    {userIds.length}
                  </Text>
                ) : null}
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {showMeta ? (
        <View style={styles.meta}>
          {message.editedAt ? (
            <Text style={[styles.time, { color: colors.mutedForeground }]}>Edited ·</Text>
          ) : null}
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {formatTime(message.createdAt)}
          </Text>
          {isOwn && status ? (
            <MaterialCommunityIcons
              name={STATUS_ICON[status].name}
              size={16}
              color={status === 'read' ? colors.receipt : colors.mutedForeground}
              accessibilityLabel={STATUS_ICON[status].label}
            />
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <PressableScale
          onPress={() => onRetry(message)}
          hitSlop={8}
          accessibilityRole='button'
          style={styles.meta}
        >
          <MaterialCommunityIcons name='alert-circle' size={14} color={colors.destructive} />
          <Text style={[styles.failed, { color: colors.destructive }]}>
            {message.error || 'Not sent'}. Tap to retry
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
};

const RADIUS = 18;
const TUCKED = 6;

const styles = StyleSheet.create({
  container: { maxWidth: '80%' },
  own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: RADIUS, paddingHorizontal: 13, paddingVertical: 8 },
  afterImage: { marginTop: 2 },
  text: { fontSize: 15.5, lineHeight: 21 },
  reply: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 4, opacity: 0.8 },
  replyAuthor: { fontSize: 12, fontWeight: '700' },
  replyText: { fontSize: 13, lineHeight: 17 },
  italic: { fontStyle: 'italic' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4 },
  time: { fontSize: 11, fontVariant: ['tabular-nums'] },
  failed: { fontSize: 12, fontWeight: '600' },
  image: { width: IMAGE_WIDTH, borderRadius: RADIUS },
  sending: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  call: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  callText: { fontSize: 13, fontWeight: '500' },
});

export default React.memo(MessageBubble);
