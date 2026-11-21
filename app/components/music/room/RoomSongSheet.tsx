import SwipeableModal from '@/components/SwipeableModal';
import { SheetLayout } from '@/components/security/SheetLayout';
import { Button } from '@/components/ui/button';
import { CachedImage } from '@/components/ui/CachedImage';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { closeFullPlayer, setRoomGuard, usePlayerStore } from '@/stores/playerStore';
import type { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRoomControl } from './useRoomControl';

/*
 * In a room the room plays, so a song you start anywhere else would go nowhere. This asks what
 * to do with it instead: put it on in the room, or leave the room and play it yourself.
 */

const artOf = (song?: Song | null) => song?.image?.[1]?.link || song?.image?.[0]?.link;
const artistOf = (song?: Song | null) =>
  song?.artist_map?.artists?.[0]?.name || song?.subtitle || '';

export const goToRoom = () => {
  closeFullPlayer();
  router.navigate('/(tabs)/group-music');
};

const SongLine = ({ song, label, live }: { song: Song; label: string; live?: boolean }) => {
  const { colors } = useTheme();
  const art = artOf(song);
  return (
    <View style={styles.songLine}>
      <View style={[styles.art, { backgroundColor: colors.muted }]}>
        {art ? <CachedImage source={{ uri: art }} style={styles.artImg} /> : null}
        {live ? (
          <View style={[styles.liveBadge, { backgroundColor: colors.live }]}>
            <Ionicons name='radio' size={10} color={colors.background} />
          </View>
        ) : null}
      </View>
      <View style={styles.songText}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>
          {artistOf(song)}
        </Text>
      </View>
    </View>
  );
};

const Choices = ({ song, onDone }: { song: Song; onDone: () => void }) => {
  const { colors } = useTheme();
  const { addToQueue, playNext, leaveGroup } = useGroupMusic();
  const { canManage } = useRoomControl();
  const roomName = useGroupSessionStore((s) => s.currentGroup?.name ?? 'a room');
  const allowAnyone = useGroupSessionStore(
    (s) => s.currentGroup?.settings?.allowAnyoneToAdd !== false
  );
  const roomSong = useGroupPlaybackStore((s) => s.currentSong);
  const canAdd = allowAnyone || canManage;

  return (
    <SheetLayout
      icon='radio'
      title={`You're in ${roomName}`}
      description={
        canAdd
          ? 'The room plays for everyone in it, so your own music waits while you’re here. Put this song on in the room, or leave to play it yourself.'
          : 'The room plays for everyone in it, so your own music waits while you’re here. Only the hosts add songs in this room.'
      }
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
        <SongLine song={song} label='You picked' />
        {roomSong ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
            <SongLine song={roomSong} label='Playing in the room' live />
          </>
        ) : null}
      </View>

      {canAdd ? (
        <View style={styles.pair}>
          <Button
            size='lg'
            style={styles.half}
            icon={<Ionicons name='play-forward' size={17} color={colors.primaryForeground} />}
            onPress={() => {
              playNext(song);
              toast('Playing next in the room', { type: 'success' });
              onDone();
            }}
          >
            Play next
          </Button>
          <Button
            size='lg'
            variant='outline'
            style={styles.half}
            icon={<Ionicons name='list' size={17} color={colors.foreground} />}
            onPress={() => {
              addToQueue(song);
              toast('Added to the room', { type: 'success' });
              onDone();
            }}
          >
            Add to queue
          </Button>
        </View>
      ) : null}

      <View style={styles.pair}>
        <Button
          size='lg'
          variant='ghost'
          style={styles.half}
          onPress={() => {
            onDone();
            goToRoom();
          }}
        >
          Go to the room
        </Button>
        <Button
          size='lg'
          variant='ghost'
          style={styles.half}
          onPress={() => {
            onDone();
            leaveGroup();
            usePlayerStore.getState().playSong(song);
          }}
        >
          Leave and play
        </Button>
      </View>
    </SheetLayout>
  );
};

/** Listens for songs started while you're in a room, from anywhere in the app. */
export const RoomSongSheet = memo(function RoomSongSheet() {
  const [song, setSong] = useState<Song | null>(null);
  const [open, setOpen] = useState(false);
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));

  useEffect(() => {
    setRoomGuard((picked) => {
      if (!useGroupSessionStore.getState().currentGroup) return false;
      setSong(picked);
      setOpen(true);
      return true;
    });
    return () => setRoomGuard(null);
  }, []);

  // The sheet slides away on its own; the song stays for that, and is replaced on the next pick.
  const close = () => setOpen(false);
  return (
    <SwipeableModal isVisible={open && inRoom} onClose={close} maxHeight='85%' dragAnywhere>
      {song ? <Choices song={song} onDone={close} /> : null}
    </SwipeableModal>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  songLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  art: { width: 48, height: 48, borderRadius: 10, overflow: 'visible' },
  artImg: { width: 48, height: 48, borderRadius: 10 },
  liveBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songText: { flex: 1, minWidth: 0 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  name: { fontSize: 15, fontWeight: '600', marginTop: 1 },
  artist: { fontSize: 13, marginTop: 1 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
