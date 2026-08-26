import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Card from '@/components/ui/card';
import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';

interface ChatPeekProps {
  onOpenChat: () => void;
}

export const ChatPeek: React.FC<ChatPeekProps> = ({ onOpenChat }) => {
  const { colors } = useTheme();
  const messages = useGroupSessionStore((s) => s.messages);

  const lastMessage = useMemo(() => {
    const textMessages = messages.filter((m) => m.type !== 'activity');
    return textMessages.length > 0 ? textMessages[textMessages.length - 1] : null;
  }, [messages]);

  const previewText = lastMessage
    ? lastMessage.messageType === 'gif'
      ? 'sent a GIF'
      : lastMessage.messageType === 'sound'
        ? `🔊 ${lastMessage.soundName || 'Sound'}`
        : lastMessage.message
    : null;

  return (
    <Card variant='default' style={styles.container}>
      <TouchableOpacity
        onPress={onOpenChat}
        activeOpacity={0.7}
        accessibilityRole='button'
        accessibilityLabel='Open group chat'
        style={styles.inner}
      >
        <Feather name='message-circle' size={15} color={colors.mutedForeground} />

        {lastMessage ? (
          <View style={styles.previewContent}>
            <Image
              source={{
                uri:
                  getProfileCloudinaryUrl(lastMessage.profilePic) ||
                  'https://via.placeholder.com/18',
              }}
              style={[styles.miniAvatar, { backgroundColor: colors.secondary }]}
            />
            <Text style={[styles.previewName, { color: colors.mutedForeground }]} numberOfLines={1}>
              {lastMessage.userName}
            </Text>
            <Text style={[styles.previewText, { color: colors.foreground }]} numberOfLines={1}>
              {previewText}
            </Text>
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Start the conversation
          </Text>
        )}

        <Feather name='chevron-right' size={16} color={colors.mutedForeground + '60'} />
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  previewName: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
  },
  previewText: {
    fontSize: 12,
    flex: 1,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});
