import { Input } from '@/components/ui/input';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import type { GroupMember, PendingInvite } from '@/stores/groupMusic/types';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sameUser } from './chat/chatUtils';
import MemberActionsSheet, { type MemberRole } from './MemberActionsSheet';
import { type InviteUser, useInviteSearch } from './useInviteSearch';
import { useRoomControl } from './useRoomControl';

const NO_INVITES: PendingInvite[] = [];
const SUGGESTION_COUNT = 8;
/** How long a tapped Invite shows as sent before the room confirms it (or an error explains). */
const SENDING_GRACE_MS = 8_000;

type Row =
  | { kind: 'title'; key: string; text: string }
  | { kind: 'member'; key: string; member: GroupMember }
  | { kind: 'invited'; key: string; invite: PendingInvite }
  | { kind: 'candidate'; key: string; user: InviteUser }
  | { kind: 'skeleton'; key: string }
  | { kind: 'empty'; key: string; text: string };

const skeletonRows = (prefix: string): Row[] =>
  [0, 1, 2].map((i) => ({ kind: 'skeleton', key: `${prefix}-skeleton-${i}` }));

const minutesLeft = (expiresAt: number, now: number) =>
  Math.max(1, Math.ceil((expiresAt - now) / 60_000));

/** Re-renders every half minute while invites are counting down. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * Everyone in the room, who's been invited, and a search to invite more, all in one place. Tapping
 * someone you can act on (as the host, anyone; as a co-host, listeners) opens their actions.
 */
export const PeoplePanel = memo(function PeoplePanel({
  focusRequest = 0,
  bottomInset = 0,
}: {
  /** Changes to put the cursor in the invite search. */
  focusRequest?: number;
  bottomInset?: number;
}) {
  const { colors } = useTheme();
  const { user } = useUser();
  const members = useGroupSessionStore((s) => s.groupMembers);
  const typing = useGroupSessionStore((s) => s.typingUsers);
  const pendingInvites = useGroupSessionStore((s) => s.currentGroup?.pendingInvites ?? NO_INVITES);
  const maxMembers = useGroupSessionStore((s) => s.currentGroup?.maxMembers ?? 0);
  const { transferHost, setCoHost, muteMember, removeMember, sendInvite } = useGroupMusic();
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
  // Tapped Invite recently: shown as invited until the room's own list has it.
  const [sending, setSending] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<TextInput>(null);
  const search = useInviteSearch();
  const now = useNow(pendingInvites.length > 0);

  useEffect(() => {
    if (!focusRequest) return undefined;
    // The panel has just been shown; focus once it's laid out.
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [focusRequest]);

  const roleOf = useCallback(
    (id: number | string): MemberRole =>
      sameUser(id, hostId) ? 'host' : coHosts.includes(String(id)) ? 'cohost' : 'listener',
    [hostId, coHosts]
  );

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

  const isFull = maxMembers > 0 && members.length >= maxMembers;
  const memberIds = useMemo(() => new Set(members.map((m) => String(m.userId))), [members]);
  const invitedIds = useMemo(
    () => new Set(pendingInvites.map((invite) => String(invite.userId))),
    [pendingInvites]
  );

  const handleInvite = useCallback(
    (userId: number) => {
      const id = String(userId);
      setSending((prev) => new Set(prev).add(id));
      sendInvite(userId);
      // If the room refuses (it says why), offer the button again.
      setTimeout(() => {
        setSending((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, SENDING_GRACE_MS);
    },
    [sendInvite]
  );

  const rows = useMemo<Row[]>(() => {
    const candidates = (users: InviteUser[]): Row[] =>
      users.map((u) => ({ kind: 'candidate', key: `user-${u.userid}`, user: u }));

    if (search.isSearching) {
      const out: Row[] = [{ kind: 'title', key: 'title-search', text: 'Invite' }];
      if (search.isLoading && search.users.length === 0) return [...out, ...skeletonRows('search')];
      if (search.users.length === 0) {
        return [
          ...out,
          { kind: 'empty', key: 'empty', text: `No one found for “${search.query.trim()}”.` },
        ];
      }
      return [...out, ...candidates(search.users)];
    }

    const rank = (m: GroupMember) => {
      const role = roleOf(m.userId);
      if (role === 'host') return 0;
      if (role === 'cohost') return 1;
      return sameUser(m.userId, user?.userid) ? 2 : 3;
    };
    const sorted = [...members].sort((a, b) => rank(a) - rank(b));
    const count = maxMembers ? `${members.length} of ${maxMembers}` : String(members.length);

    const out: Row[] = [
      {
        kind: 'title',
        key: 'title-room',
        text: `In the room · ${count}${isFull ? ' · full' : ''}`,
      },
      ...sorted.map((m): Row => ({ kind: 'member', key: `member-${m.userId}`, member: m })),
    ];

    if (pendingInvites.length > 0) {
      out.push({ kind: 'title', key: 'title-invited', text: `Invited · ${pendingInvites.length}` });
      for (const invite of pendingInvites) {
        out.push({ kind: 'invited', key: `invited-${invite.userId}`, invite });
      }
    }

    if (!search.hasLoaded) {
      out.push({ kind: 'title', key: 'title-suggested', text: 'Suggested' });
      out.push(...skeletonRows('suggested'));
    } else {
      const suggestions = search.users
        .filter((u) => !memberIds.has(String(u.userid)) && !invitedIds.has(String(u.userid)))
        .slice(0, SUGGESTION_COUNT);
      if (suggestions.length > 0) {
        out.push({ kind: 'title', key: 'title-suggested', text: 'Suggested' });
        out.push(...candidates(suggestions));
      }
    }
    return out;
  }, [
    search.isSearching,
    search.isLoading,
    search.users,
    search.query,
    search.hasLoaded,
    members,
    maxMembers,
    isFull,
    pendingInvites,
    memberIds,
    invitedIds,
    roleOf,
    user?.userid,
  ]);

  const renderMember = useCallback(
    (item: GroupMember) => {
      const role = roleOf(item.userId);
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
                  : role === 'host'
                    ? 'Hosting this room'
                    : role === 'cohost'
                      ? 'Co-hosting'
                      : 'Listening'}
              {muted ? ' · muted' : ''}
            </Text>
          </View>
          {role === 'host' && (
            <View style={[styles.chip, { backgroundColor: `${colors.live}22` }]}>
              <Ionicons name='star' size={11} color={colors.live} />
              <Text style={[styles.chipText, { color: colors.live }]}>Host</Text>
            </View>
          )}
          {role === 'cohost' && (
            <View style={[styles.chip, { backgroundColor: colors.raised }]}>
              <Ionicons name='shield-half' size={11} color={colors.foreground} />
              <Text style={[styles.chipText, { color: colors.foreground }]}>Co-host</Text>
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

  const renderCandidate = useCallback(
    (item: InviteUser) => {
      const id = String(item.userid);
      const inRoom = memberIds.has(id);
      const invited = invitedIds.has(id) || sending.has(id);
      return (
        <View style={styles.row}>
          <View>
            <Image
              source={{ uri: getProfileCloudinaryUrl(item.profilepic) }}
              style={[styles.avatar, { backgroundColor: colors.muted }]}
              fadeDuration={0}
            />
            {item.isOnline ? (
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: colors.live, borderColor: colors.background },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.text}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, styles.shrink, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.isFollowing && (
                <View style={[styles.followChip, { backgroundColor: colors.raised }]}>
                  <Text style={[styles.followText, { color: colors.mutedForeground }]}>
                    Following
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
          {inRoom ? (
            <Text style={[styles.status, { color: colors.mutedForeground }]}>In the room</Text>
          ) : invited ? (
            <View style={styles.invited}>
              <Feather name='check' size={13} color={colors.foreground} />
              <Text style={[styles.status, { color: colors.foreground }]}>Invited</Text>
            </View>
          ) : (
            <PressableScale
              onPress={() => handleInvite(item.userid)}
              disabled={isFull}
              accessibilityRole='button'
              accessibilityLabel={isFull ? 'The room is full' : `Invite ${item.name}`}
              accessibilityState={{ disabled: isFull }}
              hitSlop={6}
              style={[
                styles.inviteButton,
                { backgroundColor: colors.primary },
                isFull && styles.disabled,
              ]}
            >
              <Text style={[styles.inviteText, { color: colors.primaryForeground }]}>Invite</Text>
            </PressableScale>
          )}
        </View>
      );
    },
    [colors, memberIds, invitedIds, sending, isFull, handleInvite]
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      switch (item.kind) {
        case 'title':
          return (
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              {item.text}
            </Text>
          );
        case 'member':
          return renderMember(item.member);
        case 'candidate':
          return renderCandidate(item.user);
        case 'invited': {
          const invite = item.invite;
          const yours = sameUser(invite.invitedById, user?.userid);
          return (
            <View style={styles.row}>
              <Image
                source={{ uri: getProfileCloudinaryUrl(invite.profilePic ?? '') }}
                style={[styles.avatar, { backgroundColor: colors.muted }]}
                fadeDuration={0}
              />
              <View style={styles.text}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {invite.userName}
                </Text>
                <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  Invited by {yours ? 'you' : invite.invitedByName || 'someone'}
                </Text>
              </View>
              <View
                style={styles.invited}
                accessible
                accessibilityLabel={`Invite lapses in ${minutesLeft(invite.expiresAt, now)} minutes`}
              >
                <Feather name='clock' size={12} color={colors.mutedForeground} />
                <Text style={[styles.status, { color: colors.mutedForeground }]}>
                  {minutesLeft(invite.expiresAt, now)} min
                </Text>
              </View>
            </View>
          );
        }
        case 'skeleton':
          return (
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.muted }]} />
              <View style={[styles.text, styles.skeletonText]}>
                <View
                  style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.muted }]}
                />
                <View
                  style={[styles.skeletonLine, { width: '25%', backgroundColor: colors.muted }]}
                />
              </View>
            </View>
          );
        case 'empty':
          return <Text style={[styles.empty, { color: colors.mutedForeground }]}>{item.text}</Text>;
      }
    },
    [colors, renderMember, renderCandidate, user?.userid, now]
  );

  const selectedRole = selected ? roleOf(selected.userId) : 'listener';
  const selectedId = selected?.userId;

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <Input
          ref={inputRef}
          value={search.query}
          onChangeText={search.setQuery}
          placeholder='Invite people by name…'
          accessibilityLabel='Search people to invite'
          variant='filled'
          size='sm'
          returnKeyType='search'
          autoCorrect={false}
          autoCapitalize='none'
          leftIcon={<Feather name='search' size={16} color={colors.mutedForeground} />}
          rightIcon={
            search.isSearching && search.isLoading ? (
              <ActivityIndicator size='small' color={colors.mutedForeground} />
            ) : search.query ? (
              <PressableScale
                onPress={search.clear}
                hitSlop={10}
                accessibilityRole='button'
                accessibilityLabel='Clear search'
              >
                <Feather name='x' size={16} color={colors.mutedForeground} />
              </PressableScale>
            ) : null
          }
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode='on-drag'
        contentContainerStyle={[styles.list, { paddingBottom: bottomInset + 16 }]}
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
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  searchBar: { paddingHorizontal: 16, paddingTop: 10 },
  list: { paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingTop: 14,
    paddingBottom: 4,
  },
  away: { opacity: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  text: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12.5, marginTop: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
  },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  followChip: { paddingHorizontal: 6, height: 18, borderRadius: 9, justifyContent: 'center' },
  followText: { fontSize: 10, fontWeight: '600' },
  status: { fontSize: 12, fontWeight: '600' },
  invited: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteButton: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: { fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  skeletonText: { gap: 6 },
  skeletonLine: { height: 10, borderRadius: 5 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 32 },
});
