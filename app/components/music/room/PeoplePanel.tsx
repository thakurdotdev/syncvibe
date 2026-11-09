import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import type { GroupMember } from '@/stores/groupMusic/types';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { sameUser } from './chat/chatUtils';

/** Everyone in the room, host first, with a clear way to bring more people in. */
export const PeoplePanel = memo(function PeoplePanel({
  onInvite,
  bottomInset = 0,
}: {
  onInvite: () => void;
  bottomInset?: number;
}) {
  const { colors } = useTheme();
  const { user } = useUser();
  const members = useGroupSessionStore((s) => s.groupMembers);
  const hostId = useGroupSessionStore((s) => s.currentGroup?.createdBy);
  const typing = useGroupSessionStore((s) => s.typingUsers);
  const { transferHost } = useGroupMusic();
  const youAreHost = sameUser(hostId, user?.userid);

  const sorted = [...members].sort(
    (a, b) => Number(sameUser(b.userId, hostId)) - Number(sameUser(a.userId, hostId))
  );

  const renderItem = useCallback(
    ({ item }: { item: GroupMember }) => {
      const host = sameUser(item.userId, hostId);
      const you = sameUser(item.userId, user?.userid);
      const isTyping = Boolean(typing[String(item.userId)]);
      const away = item.connected === false;
      return (
        <View style={[styles.row, away && styles.away]}>
          <Image
            source={{ uri: getProfileCloudinaryUrl(item.profilePic) }}
            style={[styles.avatar, { backgroundColor: colors.muted }]}
            fadeDuration={0}
          />
          <View style={styles.text}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {item.userName}
              {you ? <Text style={{ color: colors.mutedForeground }}> (you)</Text> : null}
            </Text>
            <Text
              style={[styles.sub, { color: isTyping ? colors.primary : colors.mutedForeground }]}
            >
              {away
                ? 'Reconnecting…'
                : isTyping
                  ? 'typing…'
                  : host
                    ? 'Hosting this room'
                    : 'Listening'}
            </Text>
          </View>
          {host && (
            <View style={[styles.hostChip, { backgroundColor: `${colors.live}22` }]}>
              <Ionicons name='star' size={11} color={colors.live} />
              <Text style={[styles.hostText, { color: colors.live }]}>Host</Text>
            </View>
          )}
          {youAreHost && !host && !away && (
            <PressableScale
              onPress={() => transferHost(item.userId)}
              accessibilityRole='button'
              accessibilityLabel={`Make ${item.userName} the host`}
              hitSlop={8}
              style={[styles.hostChip, { backgroundColor: colors.raised }]}
            >
              <Text style={[styles.hostText, { color: colors.foreground }]}>Make host</Text>
            </PressableScale>
          )}
        </View>
      );
    },
    [colors, hostId, user?.userid, typing, youAreHost, transferHost]
  );

  return (
    <FlatList
      data={sorted}
      keyExtractor={(m) => String(m.userId)}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 16 }]}
      ListHeaderComponent={
        <PressableScale
          onPress={onInvite}
          accessibilityRole='button'
          style={[styles.invite, { backgroundColor: colors.accent }]}
        >
          <View style={[styles.inviteIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name='person-add' size={18} color={colors.primaryForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inviteTitle, { color: colors.accentForeground }]}>
              Invite friends
            </Text>
            <Text style={[styles.inviteText, { color: colors.accentForeground }]}>
              Send an invite, share the code or show the QR.
            </Text>
          </View>
          <Ionicons name='chevron-forward' size={18} color={colors.accentForeground} />
        </PressableScale>
      }
    />
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 12 },
  away: { opacity: 0.5 },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteTitle: { fontSize: 15, fontWeight: '700' },
  inviteText: { fontSize: 12.5, marginTop: 1, opacity: 0.85 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12.5, marginTop: 1 },
  hostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
  },
  hostText: { fontSize: 11.5, fontWeight: '700' },
});
