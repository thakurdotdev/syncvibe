import { Bezel, Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import type { MyRoom } from '@/stores/groupMusic/roomProtocol';
import type { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

type Colors = ReturnType<typeof useTheme>['colors'];

/** Long enough for a slow join; after it the button works again if nothing came of it. */
const SWITCH_TIMEOUT_MS = 8000;
const ART = 56;

const artworkOf = (song: Song | null): string | undefined =>
  song?.image?.[1]?.link ?? song?.image?.[0]?.link;

const DeviceLine = memo(function DeviceLine({ room, colors }: { room: MyRoom; colors: Colors }) {
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

const RoomCard = memo(function RoomCard({
  room,
  switching,
  disabled,
  onPlayHere,
}: {
  room: MyRoom;
  switching: boolean;
  disabled: boolean;
  onPlayHere: (groupId: string) => void;
}) {
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
        onPress={() => onPlayHere(room.groupId)}
        disabled={disabled}
        accessibilityRole='button'
        accessibilityLabel={`Play ${room.name} on this phone`}
        accessibilityState={{ disabled, busy: switching }}
        style={[
          styles.cta,
          { backgroundColor: colors.primary, opacity: disabled && !switching ? 0.5 : 1 },
        ]}
      >
        <Gloss />
        {switching ? (
          <ActivityIndicator size='small' color={colors.primaryForeground} />
        ) : (
          <Ionicons name='phone-portrait-outline' size={17} color={colors.primaryForeground} />
        )}
        <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
          {switching ? 'Moving…' : 'Play here'}
        </Text>
      </PressableScale>
    </Bezel>
  );
});

/**
 * Your rooms playing on another device, with a button to move each one here. Moving it is an
 * ordinary join: the server hands the room to this phone and tells the other device to stop.
 */
export const PlayingElsewhere = memo(function PlayingElsewhere({
  rooms,
  onPlayHere,
}: {
  rooms: MyRoom[];
  onPlayHere: (groupId: string) => void;
}) {
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!switchingId) return;
    const timer = setTimeout(() => setSwitchingId(null), SWITCH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [switchingId]);

  if (rooms.length === 0) return null;

  const playHere = (groupId: string) => {
    setSwitchingId(groupId);
    onPlayHere(groupId);
  };

  return (
    <View style={styles.list}>
      {rooms.map((room) => (
        <RoomCard
          key={room.groupId}
          room={room}
          switching={switchingId === room.groupId}
          disabled={switchingId != null}
          onPlayHere={playHere}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { gap: 12, paddingTop: 8 },
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
});
