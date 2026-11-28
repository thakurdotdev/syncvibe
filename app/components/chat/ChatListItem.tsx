import PressableScale from '@/components/ui/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { TimeAgo } from '@/utils/TimeAgo';
import Avatar from './Avatar';

interface ChatListItemProps {
  user: {
    userid: string | number;
    name: string;
    profilepic?: string | null;
  };
  lastMessage?: string;
  updatedAt?: string;
  isOnline?: boolean;
  isTyping?: boolean;
  unreadCount?: number;
  /** Muted: a bell with a line through it, and a quieter badge. */
  muted?: boolean;
  /** Written in this chat and not sent: shown instead of the last message. */
  draft?: string;
  isSearchResult?: boolean;
  onPress: () => void;
  /** The moment a finger lands, before the tap is over: a head start on loading. */
  onPressIn?: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({
  user,
  lastMessage,
  updatedAt,
  isOnline,
  isTyping,
  unreadCount = 0,
  muted = false,
  draft,
  isSearchResult,
  onPress,
  onPressIn,
}) => {
  const { colors } = useTheme();

  return (
    <PressableScale onPress={onPress} onPressIn={onPressIn} style={styles.container}>
      <Avatar
        name={user.name}
        profilepic={user.profilepic ?? undefined}
        size='md'
        isOnline={isOnline}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {user.name}
            </Text>
            {muted ? (
              <Ionicons
                name='notifications-off-outline'
                size={14}
                color={colors.mutedForeground}
                accessibilityLabel='Muted'
              />
            ) : null}
          </View>

          {!isSearchResult && updatedAt ? (
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {TimeAgo(updatedAt)}
            </Text>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          {!isSearchResult && isTyping ? (
            <Text
              style={[styles.subtitle, { color: colors.primary, fontWeight: '500' }]}
              numberOfLines={1}
            >
              typing...
            </Text>
          ) : !isSearchResult && draft ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              <Text style={[styles.draftLabel, { color: colors.foreground }]}>Draft: </Text>
              {draft.replace(/\s+/g, ' ')}
            </Text>
          ) : (
            <Text
              style={[
                styles.subtitle,
                { color: unreadCount > 0 ? colors.foreground : colors.mutedForeground },
                unreadCount > 0 ? styles.unreadText : null,
              ]}
              numberOfLines={1}
            >
              {lastMessage || (isSearchResult ? 'Tap to start conversation' : 'No messages yet')}
            </Text>
          )}
          {unreadCount > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: muted ? colors.mutedForeground : colors.primary },
              ]}
              accessibilityLabel={`${unreadCount} unread`}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: muted ? colors.background : colors.primaryForeground },
                ]}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  draftLabel: { fontWeight: '600' },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
    fontWeight: '400',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
  unreadText: { fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

export default React.memo(ChatListItem);
