import { CachedImage } from '@/components/ui/CachedImage';
import PressableScale from '@/components/ui/PressableScale';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import type { SongRequest } from '@/stores/groupMusic/types';
import { Feather } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoomControl } from './useRoomControl';

/** More than this many waiting fold away behind "Show all". */
const FOLDED = 3;

const RoundButton = ({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={4}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={[styles.round, { backgroundColor: primary ? colors.primary : colors.raised }]}
    >
      <Feather
        name={icon}
        size={16}
        color={primary ? colors.primaryForeground : colors.foreground}
      />
    </PressableScale>
  );
};

const Row = memo(function Row({
  request,
  mine,
  canManage,
  onAnswer,
}: {
  request: SongRequest;
  mine: boolean;
  canManage: boolean;
  onAnswer: (id: string, approve: boolean) => void;
}) {
  const { colors } = useTheme();
  const art = request.song?.image?.[1]?.link || request.song?.image?.[0]?.link;
  return (
    <View style={styles.row}>
      <CachedImage source={{ uri: art }} style={[styles.art, { backgroundColor: colors.raised }]} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {request.song?.name}
        </Text>
        <Text style={[styles.by, { color: colors.mutedForeground }]} numberOfLines={1}>
          {mine ? 'You asked' : `${request.requestedBy?.userName || 'Someone'} asked`}
          {request.next ? ' · to play next' : ''}
        </Text>
      </View>
      {canManage ? (
        <View style={styles.actions}>
          <RoundButton
            icon='x'
            label={`Turn away ${request.song?.name}`}
            onPress={() => onAnswer(request.id, false)}
          />
          <RoundButton
            icon='check'
            primary
            label={`Add ${request.song?.name}`}
            onPress={() => onAnswer(request.id, true)}
          />
        </View>
      ) : (
        <RoundButton
          icon='x'
          label={`Take back ${request.song?.name}`}
          onPress={() => onAnswer(request.id, false)}
        />
      )}
    </View>
  );
});

/**
 * Songs waiting for a host's OK (when the room asks for that). The hosts see everyone's and let
 * them in or turn them away; a listener sees only their own and can take one back.
 */
export const SongRequests = memo(function SongRequests() {
  const { colors } = useTheme();
  const requests = useGroupSessionStore((s) => s.requests);
  const { myId, canManage } = useRoomControl();
  const { answerRequest } = useGroupMusic();
  const [expanded, setExpanded] = useState(false);

  const shown = canManage
    ? requests
    : requests.filter((r) => myId != null && String(r.requestedBy?.userId) === myId);
  if (shown.length === 0) return null;
  const visible = expanded ? shown : shown.slice(0, FOLDED);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Feather name='clock' size={13} color={colors.mutedForeground} />
        <Text style={[styles.title, { color: colors.mutedForeground }]}>
          {canManage ? 'Waiting for your OK' : 'Waiting for the hosts'} · {shown.length}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.raised + '80', borderColor: colors.hairline },
        ]}
      >
        {visible.map((request) => (
          <Row
            key={request.id}
            request={request}
            mine={myId != null && String(request.requestedBy?.userId) === myId}
            canManage={canManage}
            onAnswer={answerRequest}
          />
        ))}
        {shown.length > FOLDED ? (
          <PressableScale
            onPress={() => setExpanded((open) => !open)}
            accessibilityRole='button'
            style={styles.more}
          >
            <Text style={[styles.moreText, { color: colors.mutedForeground }]}>
              {expanded ? 'Show fewer' : `Show all ${shown.length}`}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  title: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 6, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6 },
  art: { width: 40, height: 40, borderRadius: 10 },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600' },
  by: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  round: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: { alignItems: 'center', paddingVertical: 8 },
  moreText: { fontSize: 13, fontWeight: '600' },
});
