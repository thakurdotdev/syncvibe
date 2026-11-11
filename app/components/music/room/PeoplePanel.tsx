import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import type { GroupMember } from '@/stores/groupMusic/types';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { sameUser } from './chat/chatUtils';
import MemberActionsSheet, { type MemberRole } from './MemberActionsSheet';
import { useRoomControl } from './useRoomControl';

/**
 * Everyone in the room, host and co-hosts first, with a clear way to bring more people in. Tapping
 * someone you can act on (as the host, anyone; as a co-host, listeners) opens their actions.
 */
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
  const typing = useGroupSessionStore((s) => s.typingUsers);
  const { transferHost, setCoHost, muteMember, removeMember } = useGroupMusic();
  const {
    hostId,
    coHosts,
    mutedIds,
    isHost: youAreHost,
    isCoHost: youAreCoHost,
  } = useRoomControl();
  const [selected, setSelected] = useState<GroupMember | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // A fresh sheet per opening, so it starts on the actions rather than a confirmation left open.
  const [opening, setOpening] = useState(0);

  const roleOf = useCallback(
    (id: number | string): MemberRole =>
      sameUser(id, hostId) ? 'host' : coHosts.includes(String(id)) ? 'cohost' : 'listener',
    [hostId, coHosts]
  );
  const rank = (role: MemberRole) => (role === 'host' ? 0 : role === 'cohost' ? 1 : 2);
  const sorted = [...members].sort((a, b) => rank(roleOf(a.userId)) - rank(roleOf(b.userId)));

  const canModerate = useCallback(
    (member: GroupMember) =>
      !sameUser(member.userId, user?.userid) &&
      roleOf(member.userId) !== 'host' &&
      (youAreHost || (youAreCoHost && roleOf(member.userId) === 'listener')),
    [user?.userid, roleOf, youAreHost, youAreCoHost]
  );

  const open = useCallback((member: GroupMember) => {
    setSelected(member);
    setOpening((n) => n + 1);
    setSheetOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: GroupMember }) => {
      const role = roleOf(item.userId);
      const host = role === 'host';
      const you = sameUser(item.userId, user?.userid);
      const isTyping = Boolean(typing[String(item.userId)]);
      const away = item.connected === false;
      const muted = mutedIds.includes(String(item.userId));
      const actionable = canModerate(item);
      return (
        <PressableScale
          onPress={actionable ? () => open(item) : undefined}
          disabled={!actionable}
          accessibilityRole={actionable ? 'button' : undefined}
          accessibilityHint={actionable ? 'Shows what you can do' : undefined}
          style={[styles.row, away && styles.away]}
        >
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
                    : role === 'cohost'
                      ? 'Co-hosting'
                      : 'Listening'}
              {muted ? ' · muted' : ''}
            </Text>
          </View>
          {host && (
            <View style={[styles.hostChip, { backgroundColor: `${colors.live}22` }]}>
              <Ionicons name='star' size={11} color={colors.live} />
              <Text style={[styles.hostText, { color: colors.live }]}>Host</Text>
            </View>
          )}
          {role === 'cohost' && (
            <View style={[styles.hostChip, { backgroundColor: colors.raised }]}>
              <Ionicons name='shield-half' size={11} color={colors.foreground} />
              <Text style={[styles.hostText, { color: colors.foreground }]}>Co-host</Text>
            </View>
          )}
          {actionable && (
            <Ionicons name='ellipsis-horizontal' size={18} color={colors.mutedForeground} />
          )}
        </PressableScale>
      );
    },
    [colors, user?.userid, typing, roleOf, mutedIds, canModerate, open]
  );

  const selectedRole = selected ? roleOf(selected.userId) : 'listener';
  const selectedId = selected?.userId;

  return (
    <>
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
      <MemberActionsSheet
        key={opening}
        isVisible={sheetOpen}
        member={selected}
        role={selectedRole}
        muted={selectedId != null && mutedIds.includes(String(selectedId))}
        canPromote={youAreHost}
        canModerate={selected ? canModerate(selected) : false}
        onClose={() => setSheetOpen(false)}
        onSetCoHost={(enabled) => selectedId != null && setCoHost(selectedId, enabled)}
        onMakeHost={() => selectedId != null && transferHost(selectedId)}
        onMute={(enabled) => selectedId != null && muteMember(selectedId, enabled)}
        onRemove={() => selectedId != null && removeMember(selectedId)}
      />
    </>
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
