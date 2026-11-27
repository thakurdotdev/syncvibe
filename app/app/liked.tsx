import { ActionBar } from '@/components/music/detail/Actions';
import {
  DetailError,
  DetailScreen,
  DetailSkeleton,
  ListHeading,
} from '@/components/music/detail/DetailScreen';
import { mosaicOf, runtime, songCount } from '@/components/music/detail/format';
import { DisplayTitle, Kicker, MetaLine, Rise, SleeveHero } from '@/components/music/detail/Hero';
import { TrackRow } from '@/components/music/detail/TrackRow';
import { useCollection, useRoomAction } from '@/components/music/detail/useCollection';
import { useTheme } from '@/context/ThemeContext';
import { useLikedSongs } from '@/queries/usePersonal';
import { typography } from '@/theme/typography';
import type { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

const keyOf = (song: Song) => song.id;

/** The Liked songs sleeve: drawn in the theme's colour rather than any one song's cover. */
const HeartArt = memo(function HeartArt({ size }: { size: number }) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <LinearGradient
        colors={colors.gradients.primary as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons name='heart' size={size} color={colors.primaryForeground} />
    </View>
  );
});

/** Every song you've liked, newest first. */
export default function LikedSongsScreen() {
  const { colors } = useTheme();
  const { data: songs = [], isLoading, isError, refetch, isRefetching } = useLikedSongs();
  const collection = useCollection(songs);
  const room = useRoomAction(songs, 'Liked songs', collection);
  const { playAt } = collection;

  const renderItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <TrackRow song={item} index={index} onPlay={playAt} />
    ),
    [playAt]
  );

  if (isLoading) return <DetailSkeleton variant='sleeve' />;
  if (isError && !songs.length) {
    return <DetailError message="Couldn't load your liked songs" onRetry={() => refetch()} />;
  }

  return (
    <DetailScreen
      variant='sleeve'
      title='Liked songs'
      backdrop={mosaicOf(songs)[0]}
      collection={collection}
      data={songs}
      renderItem={renderItem}
      keyExtractor={keyOf}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      header={
        <View>
          <SleeveHero
            art={<HeartArt size={72} />}
            label={<HeartArt size={18} />}
            active={collection.active}
            playing={collection.playing}
          />
          <View style={styles.words}>
            <Rise order={0}>
              <Kicker>Your collection</Kicker>
            </Rise>
            <Rise order={1}>
              <DisplayTitle>Liked songs</DisplayTitle>
            </Rise>
            <Rise order={2}>
              <MetaLine parts={[songCount(songs.length), runtime(songs)]} />
            </Rise>
          </View>
          <Rise order={3}>
            <ActionBar collection={collection} count={songs.length} room={room} />
          </Rise>
          {songs.length ? <ListHeading>Newest first</ListHeading> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No liked songs yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Tap the heart in the player on songs you love. They land here, and we&apos;ll recommend
            more like them.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  words: { paddingHorizontal: 20 },
  empty: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingTop: 32 },
  emptyTitle: { ...typography.headingSm },
  emptyText: { ...typography.bodyMd, textAlign: 'center' },
});
