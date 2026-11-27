import SwipeableModal from '@/components/SwipeableModal';
import { ActionBar } from '@/components/music/detail/Actions';
import {
  DetailError,
  DetailScreen,
  DetailSkeleton,
  ListHeading,
} from '@/components/music/detail/DetailScreen';
import { coverOf, longDate, mosaicOf, runtime, songCount } from '@/components/music/detail/format';
import { DisplayTitle, Kicker, MetaLine, Rise, SleeveHero } from '@/components/music/detail/Hero';
import { useCollection, useRoomAction } from '@/components/music/detail/useCollection';
import { PlaylistSongRow } from '@/components/music/playlist/PlaylistSongRow';
import { SheetLayout } from '@/components/security/SheetLayout';
import { HEADER_HEIGHT, HeaderOrb } from '@/components/ui/AppHeader';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { ENTER } from '@/lib/motion';
import { typography } from '@/theme/typography';
import type { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PlaylistSong = {
  id: string;
  songData: Song;
};

type PlaylistData = {
  id: string;
  name: string;
  description: string;
  userId: number;
  createdat: string;
  image: { link: string }[] | string;
  songs: PlaylistSong[];
};

const keyOf = (item: PlaylistSong) => String(item.id);
const BAR_IN = FadeInUp.duration(ENTER.duration).reduceMotion(ReduceMotion.System);
const BAR_OUT = FadeOutUp.duration(140).reduceMotion(ReduceMotion.System);

/** One of your own playlists: play it, or pick songs off it (swipe one, or select several). */
export default function UserPlaylistDetails() {
  const api = useApi();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Picking several songs, then removing them with one confirmation.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Songs waiting for "Remove?" to be answered.
  const [pendingRemoval, setPendingRemoval] = useState<Song[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const cancelSwipe = useRef<(() => void) | undefined>(undefined);

  const fetchPlaylistData = useCallback(async () => {
    try {
      setIsLoading(true);
      setFailed(false);
      const response = await api.get(`/api/playlist/details`, { params: { id } });
      setPlaylistData(response.data.data);
    } catch (error) {
      console.error('Error fetching playlist data:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchPlaylistData();
  }, [id, fetchPlaylistData]);

  const items = useMemo(
    () => (playlistData?.songs ?? []).filter((s) => s.songData?.id),
    [playlistData?.songs]
  );
  const songs = useMemo(() => items.map((s) => s.songData), [items]);
  const collection = useCollection(songs);
  const room = useRoomAction(songs, playlistData?.name, collection);
  const { playAt } = collection;

  const toggleSelected = useCallback((songId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const askToRemove = useCallback((song: Song, cancel?: () => void) => {
    cancelSwipe.current = cancel;
    setPendingRemoval([song]);
  }, []);

  const closeConfirm = useCallback(() => {
    if (removing) return;
    cancelSwipe.current?.();
    cancelSwipe.current = undefined;
    setPendingRemoval(null);
  }, [removing]);

  const confirmRemoval = useCallback(async () => {
    if (!pendingRemoval?.length) return;
    const songIds = pendingRemoval.map((song) => song.id);
    setRemoving(true);
    try {
      await api.post('/api/playlist/remove-song', { playlistId: Number(id), songIds });
      const gone = new Set(songIds);
      setPlaylistData((current) =>
        current
          ? { ...current, songs: current.songs.filter((s) => !gone.has(s.songData?.id)) }
          : current
      );
      toast(songIds.length === 1 ? 'Removed from playlist' : `Removed ${songIds.length} songs`, {
        type: 'success',
      });
      cancelSwipe.current = undefined;
      setPendingRemoval(null);
      stopSelecting();
    } catch {
      toast("Couldn't remove. Try again.", { type: 'error' });
    } finally {
      setRemoving(false);
    }
  }, [api, id, pendingRemoval, stopSelecting]);

  const renderSong = useCallback(
    ({ item, index }: { item: PlaylistSong; index: number }) => (
      <PlaylistSongRow
        song={item.songData}
        index={index}
        onPlay={playAt}
        selecting={selecting}
        selected={selected.has(item.songData?.id)}
        onToggle={toggleSelected}
        onRemove={askToRemove}
      />
    ),
    [playAt, selecting, selected, toggleSelected, askToRemove]
  );

  if (isLoading && !playlistData) return <DetailSkeleton variant='sleeve' />;
  if (failed || !playlistData) {
    return <DetailError message="Couldn't load this playlist" onRetry={fetchPlaylistData} />;
  }

  const count = songs.length;
  const allSelected = count > 0 && selected.size === count;
  const removalCount = pendingRemoval?.length ?? 0;
  const cover = coverOf(playlistData.image);
  const mosaic = cover ? undefined : mosaicOf(songs);
  const created = longDate(playlistData.createdat);

  return (
    <DetailScreen
      variant='sleeve'
      title={playlistData.name || 'Playlist'}
      headerTitle={selecting ? `${selected.size} selected` : undefined}
      backdrop={cover || mosaic?.[0]}
      collection={selecting ? undefined : collection}
      headerRight={
        count ? (
          <HeaderOrb
            icon={selecting ? 'close' : 'checkmark-done'}
            label={selecting ? 'Stop selecting' : 'Select songs'}
            onPress={selecting ? stopSelecting : () => setSelecting(true)}
          />
        ) : undefined
      }
      data={items}
      renderItem={renderSong}
      keyExtractor={keyOf}
      extraData={selected}
      header={
        <View>
          <SleeveHero
            cover={cover}
            mosaic={mosaic}
            active={collection.active}
            playing={collection.playing}
          />
          <View style={styles.words}>
            <Rise order={0}>
              <Kicker>Your playlist</Kicker>
            </Rise>
            <Rise order={1}>
              <DisplayTitle>{playlistData.name || 'Playlist'}</DisplayTitle>
            </Rise>
            <Rise order={2}>
              <MetaLine parts={[songCount(count), runtime(songs), created && `Made ${created}`]} />
            </Rise>
          </View>
          <Rise order={3}>
            <ActionBar collection={collection} count={count} room={room} />
          </Rise>
          {count ? <ListHeading>Songs</ListHeading> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.raised }]}>
            <Ionicons name='musical-notes-outline' size={26} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing here yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Long-press any song and choose Add to Playlist.
          </Text>
        </View>
      }
    >
      {selecting && (
        <Animated.View
          entering={BAR_IN}
          exiting={BAR_OUT}
          style={[
            styles.selectionBar,
            {
              // Under the header: the mini player and tabs cover the bottom of this page.
              top: insets.top + HEADER_HEIGHT + 4,
              backgroundColor: colors.raised,
              borderColor: colors.border,
            },
          ]}
        >
          <Button
            variant='ghost'
            onPress={() => setSelected(allSelected ? new Set() : new Set(songs.map((s) => s.id)))}
          >
            {allSelected ? 'Clear' : 'Select all'}
          </Button>
          <Button
            variant='destructive'
            disabled={selected.size === 0}
            onPress={() => setPendingRemoval(songs.filter((song) => selected.has(song.id)))}
          >
            {selected.size ? `Remove (${selected.size})` : 'Remove'}
          </Button>
        </Animated.View>
      )}

      <SwipeableModal isVisible={removalCount > 0} onClose={closeConfirm} dragAnywhere>
        <SheetLayout
          icon='trash-2'
          tone='destructive'
          title={removalCount === 1 ? 'Remove this song?' : `Remove ${removalCount} songs?`}
          description={
            removalCount === 1
              ? `“${pendingRemoval?.[0]?.name}” will be taken off “${playlistData.name}”.`
              : `They will be taken off “${playlistData.name}”.`
          }
        >
          <Button size='lg' variant='destructive' isLoading={removing} onPress={confirmRemoval}>
            {removalCount === 1 ? 'Remove song' : `Remove ${removalCount} songs`}
          </Button>
          <Button size='lg' variant='ghost' disabled={removing} onPress={closeConfirm}>
            Keep {removalCount === 1 ? 'it' : 'them'}
          </Button>
        </SheetLayout>
      </SwipeableModal>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  words: { paddingHorizontal: 20 },
  selectionBar: {
    position: 'absolute',
    zIndex: 11,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 40 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.headingSm },
  emptyText: { ...typography.bodyMd, textAlign: 'center' },
});
