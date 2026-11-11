import { Bezel, Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import type {
  FormerRoom,
  JoinedRoom,
  LeftRoom,
  MyRoom,
  RemovedRoom,
  RequestState,
} from '@/stores/groupMusic/roomProtocol';
import type { Song } from '@/types/song';
import { TimeAgo } from '@/utils/TimeAgo';
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

type Colors = ReturnType<typeof useTheme>['colors'];

/** Long enough for a slow join; after it the buttons work again if nothing came of it. */
const BUSY_TIMEOUT_MS = 8000;
const ART = 56;

interface PlayingCardProps {
  room: JoinedRoom;
  joining: boolean;
  disabled: boolean;
  onJoin: (groupId: string) => void;
}

const artworkOf = (song: Song | null): string | undefined =>
  song?.image?.[1]?.link ?? song?.image?.[0]?.link;

const DeviceLine = memo(function DeviceLine({
  room,
  colors,
}: {
  room: JoinedRoom;
  colors: Colors;
}) {
  const { device, playing } = room;
  if (!device) {
    return (
      <View style={styles.deviceLine}>
        <Ionicons name='cloud-offline-outline' size={13} color={colors.mutedForeground} />
        <Text style={[styles.deviceText, { color: colors.mutedForeground }]} numberOfLines={1}>
          Your other device is offline
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.deviceLine}>
      {playing ? (
        <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
      ) : (
        <Ionicons
          name={device.mobile ? 'phone-portrait-outline' : 'laptop-outline'}
          size={13}
          color={colors.mutedForeground}
        />
      )}
      <Text style={[styles.deviceText, { color: colors.mutedForeground }]} numberOfLines={1}>
        {playing ? 'Playing on ' : 'Paused on '}
        <Text style={{ color: colors.foreground, fontWeight: '600' }}>{device.name}</Text>
      </Text>
    </View>
  );
});

/** A room you're in, playing on another device of yours. */
const PlayingCard = memo(function PlayingCard({
  room,
  joining,
  disabled,
  onJoin,
}: PlayingCardProps) {
  const { colors } = useTheme();
  const { song } = room;
  const art = artworkOf(song);
  const artist = song?.artist_map?.primary_artists?.[0]?.name;
  const detail = song ? [artist, room.name].filter(Boolean).join(' · ') : 'Nothing playing yet';

  return (
    <Bezel contentStyle={styles.card} radius={24}>
      <View style={styles.info}>
        <View style={[styles.art, { backgroundColor: colors.raised }]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.artImage} />
          ) : (
            <Ionicons name='radio' size={22} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {song?.name || room.name}
          </Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
            {detail}
          </Text>
          <DeviceLine room={room} colors={colors} />
        </View>
      </View>

      <PressableScale
        onPress={() => onJoin(room.groupId)}
        disabled={disabled}
        accessibilityRole='button'
        accessibilityLabel={`Play ${room.name} on this phone`}
        accessibilityState={{ disabled, busy: joining }}
        style={[
          styles.cta,
          { backgroundColor: colors.primary, opacity: disabled && !joining ? 0.5 : 1 },
        ]}
      >
        <Gloss />
        {joining ? (
          <ActivityIndicator size='small' color={colors.primaryForeground} />
        ) : (
          <Ionicons name='phone-portrait-outline' size={17} color={colors.primaryForeground} />
        )}
        <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
          {joining ? 'Moving…' : 'Play here'}
        </Text>
      </PressableScale>
    </Bezel>
  );
});

interface RowAction {
  label: string;
  accessibilityLabel: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

interface RowState {
  busy: boolean;
  disabled: boolean;
  onJoin: (groupId: string) => void;
  onAsk: (groupId: string) => void;
}

/** A room you left or were removed from lately: what happened, and the one thing to do next. */
const FormerRoomRow = memo(function FormerRoomRow({
  room,
  detail,
  action,
  onDismiss,
}: {
  room: FormerRoom;
  detail: string;
  action: RowAction | null;
  onDismiss: (groupId: string) => void;
}) {
  const { colors } = useTheme();
  const dimmed = action && action.disabled && !action.busy;

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.raised }]}>
        <Ionicons name='radio' size={18} color={colors.mutedForeground} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
          {room.name}
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {action && (
        <PressableScale
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole='button'
          accessibilityLabel={action.accessibilityLabel}
          accessibilityState={{ disabled: action.disabled, busy: action.busy }}
          style={[styles.rowButton, { borderColor: colors.hairline, opacity: dimmed ? 0.5 : 1 }]}
        >
          <Gloss tone='surface' />
          {action.busy && <ActivityIndicator size='small' color={colors.foreground} />}
          <Text style={[styles.rowButtonText, { color: colors.foreground }]}>
            {action.busy ? action.busyLabel : action.label}
          </Text>
        </PressableScale>
      )}
      <Pressable
        onPress={() => onDismiss(room.groupId)}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={`Don't show ${room.name} again`}
        style={styles.dismiss}
      >
        <Ionicons name='close' size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
});

const leftRoomRow = (room: LeftRoom, { busy, disabled, onJoin }: RowState) => ({
  detail: room.full ? 'Room is full' : `Left ${TimeAgo(room.leftAt).toLowerCase()}`,
  action: {
    label: 'Rejoin',
    accessibilityLabel: `Rejoin ${room.name}`,
    busyLabel: 'Joining…',
    busy,
    disabled: disabled || room.full,
    onPress: () => onJoin(room.groupId),
  },
});

const REMOVED_TEXT: Record<RequestState, string> = {
  none: 'A host removed you',
  pending: 'Waiting for a host to answer',
  declined: 'A host said no',
  blocked: 'A host said no twice',
};

// Short, so the room's name keeps its room on a phone; the row already says why.
const ASK_LABEL: Record<Exclude<RequestState, 'blocked'>, string> = {
  none: 'Ask',
  pending: 'Asked',
  declined: 'Ask again',
};

const removedRoomRow = (room: RemovedRoom, { busy, disabled, onAsk }: RowState) => ({
  detail: REMOVED_TEXT[room.request],
  action:
    room.request === 'blocked'
      ? null
      : {
          label: ASK_LABEL[room.request],
          accessibilityLabel: `Ask the hosts to let you back into ${room.name}`,
          busyLabel: 'Asking…',
          busy,
          disabled: disabled || room.request === 'pending',
          onPress: () => onAsk(room.groupId),
        },
});

/**
 * Ways back into your rooms: one playing on another device can be moved here, one you left
 * lately rejoined, and one a host removed you from asked about. Moving and rejoining are an
 * ordinary join; for a room you're in, the server hands it to this phone and tells the other
 * device to stop.
 */
export const MyRooms = memo(function MyRooms({
  rooms,
  onJoin,
  onAsk,
  onDismiss,
}: {
  rooms: MyRoom[];
  onJoin: (groupId: string) => void;
  onAsk: (groupId: string) => Promise<void>;
  onDismiss: (groupId: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!busyId) return;
    const timer = setTimeout(() => setBusyId(null), BUSY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [busyId]);

  if (rooms.length === 0) return null;

  // A join ends by leaving this screen; asking ends with the answer from the server.
  const join = (groupId: string) => {
    setBusyId(groupId);
    onJoin(groupId);
  };
  const ask = async (groupId: string) => {
    setBusyId(groupId);
    await onAsk(groupId);
    setBusyId(null);
  };

  return (
    <View style={styles.list}>
      {rooms.map((room) => {
        const state: RowState = {
          busy: busyId === room.groupId,
          disabled: busyId != null,
          onJoin: join,
          onAsk: ask,
        };
        if (room.status === 'member') {
          return (
            <PlayingCard
              key={room.groupId}
              room={room}
              joining={state.busy}
              disabled={state.disabled}
              onJoin={join}
            />
          );
        }
        const row =
          room.status === 'removed' ? removedRoomRow(room, state) : leftRoomRow(room, state);
        return <FormerRoomRow key={room.groupId} room={room} {...row} onDismiss={onDismiss} />;
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { gap: 10, paddingTop: 8 },
  card: { padding: 14, gap: 14 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  art: {
    width: ART,
    height: ART,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artImage: { width: ART, height: ART },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 13 },
  deviceLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  deviceText: { flexShrink: 1, fontSize: 12.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  cta: {
    height: 46,
    borderRadius: 15,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaText: { fontSize: 15, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14.5, fontWeight: '700' },
  rowButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowButtonText: { fontSize: 13.5, fontWeight: '600' },
  dismiss: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
