import PressableScale from '@/components/ui/PressableScale';
import { Message } from '@/context/SocketContext';
import { useTheme } from '@/context/ThemeContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  /** Messages in a row from one person sit together; time shows once, at the end of the run. */
  startsGroup: boolean;
  endsGroup: boolean;
  onImagePress: (url: string) => void;
  onMessageLongPress: (message: Message) => void;
  onRetry?: (message: Message) => void;
}

const formatTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const LONG_PRESS_MS = 300;

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  startsGroup,
  endsGroup,
  onImagePress,
  onMessageLongPress,
  onRetry,
}) => {
  const { colors } = useTheme();
  const failed = message.status === 'failed';
  const pending = message.status === 'pending';
  const fileurl = message.fileurl;

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

  const openActions = () => onMessageLongPress(message);
  const showMeta = endsGroup && !failed;

  return (
    <View
      style={[
        styles.container,
        isOwn ? styles.own : styles.other,
        { marginTop: startsGroup ? 10 : 2 },
      ]}
    >
      {fileurl ? (
        <PressableScale
          onPress={() => onImagePress(fileurl)}
          onLongPress={openActions}
          delayLongPress={LONG_PRESS_MS}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityRole='imagebutton'
          accessibilityLabel='Photo. Tap to view, hold for options'
        >
          <Image
            source={{ uri: getOptimizedImageUrl(fileurl, { thumbnail: true }) }}
            style={[styles.image, corners, { backgroundColor: colors.raised }]}
            resizeMode='cover'
            fadeDuration={0}
          />
          {pending ? (
            <View style={[styles.sending, corners]}>
              <ActivityIndicator color='#fff' />
            </View>
          ) : null}
        </PressableScale>
      ) : null}

      {message.content ? (
        <PressableScale
          onLongPress={openActions}
          delayLongPress={LONG_PRESS_MS}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityHint='Hold for options'
          style={[
            styles.bubble,
            corners,
            { backgroundColor: isOwn ? colors.primary : colors.raised },
            fileurl ? styles.afterImage : null,
          ]}
        >
          <Text
            style={[styles.text, { color: isOwn ? colors.primaryForeground : colors.foreground }]}
          >
            {message.content}
          </Text>
        </PressableScale>
      ) : null}

      {showMeta ? (
        <View style={styles.meta}>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {formatTime(message.createdat)}
          </Text>
          {isOwn ? (
            <MaterialCommunityIcons
              name={pending ? 'clock-outline' : message.isread ? 'check-all' : 'check'}
              size={14}
              color={message.isread ? colors.foreground : colors.mutedForeground}
              accessibilityLabel={pending ? 'Sending' : message.isread ? 'Read' : 'Sent'}
            />
          ) : null}
        </View>
      ) : null}

      {failed ? (
        <PressableScale
          onPress={() => onRetry?.(message)}
          hitSlop={8}
          accessibilityRole='button'
          style={styles.meta}
        >
          <MaterialCommunityIcons name='alert-circle' size={14} color={colors.destructive} />
          <Text style={[styles.failed, { color: colors.destructive }]}>Not sent. Tap to retry</Text>
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4 },
  time: { fontSize: 11, fontVariant: ['tabular-nums'] },
  failed: { fontSize: 12, fontWeight: '600' },
  image: { width: 240, height: 240, borderRadius: RADIUS },
  sending: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});

export default React.memo(MessageBubble);
