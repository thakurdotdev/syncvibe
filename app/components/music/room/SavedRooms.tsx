import type { SavedRoom } from '@/api/rooms';
import SwipeableModal from '@/components/SwipeableModal';
import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { CachedImage } from '@/components/ui/CachedImage';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { useForgetSavedRoom, useSavedRooms } from '@/queries/useSavedRooms';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ART = 48;
/** Long enough for a slow open; after it the buttons work again if nothing came of it. */
const BUSY_TIMEOUT_MS = 8000;

/** Up to four covers from the last queue, or a quiet placeholder. */
const Covers = ({ covers }: { covers: string[] }) => {
  const { colors } = useTheme();
  if (covers.length === 0) {
    return (
      <View style={[styles.art, { backgroundColor: colors.raised }]}>
        <Ionicons name='radio' size={18} color={colors.mutedForeground} />
      </View>
    );
  }
  const tiles = covers.length >= 4 ? covers.slice(0, 4) : covers.slice(0, 1);
  const size = tiles.length === 4 ? ART / 2 : ART;
  return (
    <View style={[styles.art, styles.grid, { backgroundColor: colors.raised }]}>
      {tiles.map((uri, i) => (
        <CachedImage key={`${uri}-${i}`} source={{ uri }} style={{ width: size, height: size }} />
      ))}
    </View>
  );
};

const detailOf = (room: SavedRoom) => {
  const songs =
    room.songCount > 0
      ? `${room.songCount} ${room.songCount === 1 ? 'song' : 'songs'}`
      : 'No songs';
  if (room.regularCount === 0) return `${songs} · just you so far`;
  const names = room.regulars.slice(0, 2).map((r) => r.userName.split(' ')[0]);
  const more = room.regularCount - names.length;
  return `${songs} · with ${names.join(', ')}${more > 0 ? ` +${more}` : ''}`;
};

const Row = memo(function Row({
  room,
  busy,
  disabled,
  onOpen,
  onMore,
}: {
  room: SavedRoom;
  busy: boolean;
  disabled: boolean;
  onOpen: (room: SavedRoom) => void;
  onMore: (room: SavedRoom) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      <Covers covers={room.covers} />
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {room.name}
          </Text>
          {room.live ? (
            <View style={styles.live}>
              <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
              <Text style={[styles.liveText, { color: colors.foreground }]}>Live</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.detail, { color: colors.mutedForeground }]} numberOfLines={1}>
          {detailOf(room)}
        </Text>
      </View>
      <PressableScale
        onPress={() => onOpen(room)}
        disabled={disabled}
        accessibilityRole='button'
        accessibilityLabel={room.live ? `Join ${room.name}` : `Open ${room.name}`}
        accessibilityState={{ disabled, busy }}
        style={[
          styles.button,
          { borderColor: colors.hairline, opacity: disabled && !busy ? 0.5 : 1 },
        ]}
      >
        <Gloss tone='surface' />
        {busy && <ActivityIndicator size='small' color={colors.foreground} />}
        <Text style={[styles.buttonText, { color: colors.foreground }]}>
          {busy ? 'Opening…' : room.live ? 'Join' : 'Open'}
        </Text>
      </PressableScale>
      <PressableScale
        onPress={() => onMore(room)}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={`More for ${room.name}`}
        style={styles.more}
      >
        <Feather name='more-vertical' size={18} color={colors.mutedForeground} />
      </PressableScale>
    </View>
  );
});

/**
 * Rooms you keep between sessions. Opening one starts it again as you left it (name, settings,
 * co-hosts, last queue, paused), or joins it if someone kept it going.
 */
export const SavedRooms = memo(function SavedRooms({
  onOpen,
}: {
  onOpen: (room: SavedRoom) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: rooms = [] } = useSavedRooms();
  const forget = useForgetSavedRoom();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [menuRoom, setMenuRoom] = useState<SavedRoom | null>(null);

  useEffect(() => {
    if (openingId === null) return;
    const timer = setTimeout(() => setOpeningId(null), BUSY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [openingId]);

  if (rooms.length === 0) return null;

  return (
    <View style={styles.root}>
      <Text style={[styles.heading, { color: colors.mutedForeground }]} accessibilityRole='header'>
        Kept rooms
      </Text>
      <View style={styles.list}>
        {rooms.map((room) => (
          <Row
            key={room.id}
            room={room}
            busy={openingId === room.id}
            disabled={openingId !== null}
            onOpen={(r) => {
              setOpeningId(r.id);
              onOpen(r);
            }}
            onMore={setMenuRoom}
          />
        ))}
      </View>

      {menuRoom && (
        <SwipeableModal isVisible onClose={() => setMenuRoom(null)} dragAnywhere>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]} numberOfLines={1}>
              {menuRoom.name}
            </Text>
            <Text style={[styles.sheetDetail, { color: colors.mutedForeground }]}>
              Opening it starts it again with its last queue, paused.
            </Text>
            <PressableScale
              scaleTo={ROW_PRESS_SCALE}
              onPress={() => {
                forget.mutate(menuRoom.id);
                setMenuRoom(null);
              }}
              accessibilityRole='button'
              style={styles.sheetRow}
            >
              <Feather name='bookmark' size={19} color={colors.destructive} />
              <Text style={[styles.sheetRowText, { color: colors.destructive }]}>
                Stop keeping this room
              </Text>
            </PressableScale>
          </View>
        </SwipeableModal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { paddingTop: 8 },
  heading: { fontSize: 12.5, fontWeight: '600', marginBottom: 8, paddingHorizontal: 4 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  art: {
    width: ART,
    height: ART,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, fontSize: 14.5, fontWeight: '700' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11.5, fontWeight: '700' },
  detail: { fontSize: 12.5 },
  button: {
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
  buttonText: { fontSize: 13.5, fontWeight: '600' },
  more: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheet: { paddingHorizontal: 16, paddingTop: 6 },
  sheetTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 12 },
  sheetDetail: { fontSize: 13.5, marginTop: 4, marginBottom: 10, paddingHorizontal: 12 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sheetRowText: { fontSize: 16, fontWeight: '500' },
});
