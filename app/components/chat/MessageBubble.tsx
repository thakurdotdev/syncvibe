import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { Message } from '@/context/SocketContext';
import { getOptimizedImageUrl } from '@/utils/Cloudinary';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onImagePress: (url: string) => void;
  onMessageLongPress: (message: Message) => void;
  onRetry?: (message: Message) => void;
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  onImagePress,
  onMessageLongPress,
  onRetry,
}) => {
  const { colors } = useTheme();

  const bubbleBg = isOwn ? colors.accent : colors.card;
  const timeStr = formatTime(message.createdat);

  const renderStatusIcon = () => {
    if (!isOwn) return null;

    if (message.status === 'pending') {
      return (
        <MaterialCommunityIcons
          name='clock-outline'
          size={13}
          color={colors.mutedForeground}
          style={styles.checkIcon}
        />
      );
    }

    if (message.status === 'failed') {
      return (
        <Pressable
          onPress={() => onRetry && onRetry(message)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name='alert-circle'
            size={14}
            color={colors.destructive}
            style={styles.checkIcon}
          />
        </Pressable>
      );
    }

    return (
      <MaterialCommunityIcons
        name={message.isread ? 'check-all' : 'check'}
        size={14}
        color={message.isread ? colors.primary : colors.mutedForeground}
        style={styles.checkIcon}
      />
    );
  };

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      {message.fileurl && (
        <Pressable
          onPress={() => message.fileurl && onImagePress(message.fileurl)}
          style={styles.imageWrapper}
        >
          <Image
            source={{
              uri: getOptimizedImageUrl(message.fileurl, { thumbnail: true }),
            }}
            style={styles.messageImage}
            resizeMode='cover'
          />
          <View style={styles.imageFooter}>
            <Text style={styles.imageTime}>{timeStr}</Text>
            {renderStatusIcon()}
          </View>
        </Pressable>
      )}

      {message.content ? (
        <Pressable
          onLongPress={() => {
            if (isOwn) {
              onMessageLongPress(message);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          }}
          style={[
            styles.bubble,
            { backgroundColor: bubbleBg },
            isOwn ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <View style={styles.contentRow}>
            <Text style={[styles.messageText, { color: colors.foreground }]}>
              {message.content}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeStr}</Text>
              {renderStatusIcon()}
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  ownContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
  },
  ownBubble: {
    borderBottomRightRadius: 3,
  },
  otherBubble: {
    borderBottomLeftRadius: 3,
  },
  contentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    paddingBottom: 1,
  },
  time: {
    fontSize: 11,
    lineHeight: 13,
  },
  checkIcon: {
    marginLeft: 2,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 2,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
  },
  imageFooter: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageTime: {
    fontSize: 11,
    color: '#FFFFFF',
  },
});

export default React.memo(MessageBubble);
