import { Button } from '@/components/ui/button';
import { CachedImage } from '@/components/ui/CachedImage';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { goToRoom } from '../room/RoomSongSheet';

/**
 * In the full player, in place of its controls while you're in a room: the room is what plays,
 * so they would do nothing. Says so, with the way to the room and the way out of it.
 */
export const RoomOwnsPlayback = memo(function RoomOwnsPlayback() {
  const { colors } = useTheme();
  const { leaveGroup } = useGroupMusic();
  const roomName = useGroupSessionStore((s) => s.currentGroup?.name ?? 'your room');
  const listeners = useGroupSessionStore((s) => s.groupMembers.length);
  const song = useGroupPlaybackStore((s) => s.currentSong);
  const art = song?.image?.[1]?.link || song?.image?.[0]?.link;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      accessibilityRole='summary'
    >
      <View style={styles.top}>
        <View style={[styles.art, { borderColor: colors.live, backgroundColor: colors.muted }]}>
          {art ? (
            <CachedImage source={{ uri: art }} style={styles.artImg} />
          ) : (
            <Ionicons name='radio' size={20} color={colors.live} />
          )}
        </View>
        <View style={styles.text}>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
            <Text style={[styles.liveText, { color: colors.live }]}>
              Playing in the room · {listeners} listening
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {roomName}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {song?.name || 'Nothing playing yet'}
          </Text>
        </View>
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Your own music is paused while you’re in a room. Leave the room to carry on with it.
      </Text>
      <View style={styles.pair}>
        <Button
          style={styles.half}
          onPress={goToRoom}
          icon={<Ionicons name='arrow-forward' size={16} color={colors.primaryForeground} />}
          iconPosition='right'
        >
          Open room
        </Button>
        <Button variant='outline' style={styles.half} onPress={leaveGroup}>
          Leave room
        </Button>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  art: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artImg: { width: '100%', height: '100%' },
  text: { flex: 1, minWidth: 0 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  sub: { fontSize: 13, marginTop: 1 },
  note: { fontSize: 13, lineHeight: 18 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
