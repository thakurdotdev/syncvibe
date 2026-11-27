import { ActionBar } from '@/components/music/detail/Actions';
import {
  DetailError,
  DetailScreen,
  DetailSkeleton,
  ListHeading,
} from '@/components/music/detail/DetailScreen';
import {
  cleanText,
  compactCount,
  coverOf,
  longDate,
  runtime,
  songCount,
} from '@/components/music/detail/format';
import {
  ArtistChips,
  DisplayTitle,
  Kicker,
  MetaLine,
  Rise,
  SleeveHero,
  type ChipArtist,
} from '@/components/music/detail/Hero';
import { TrackRow } from '@/components/music/detail/TrackRow';
import { useCollection, useRoomAction } from '@/components/music/detail/useCollection';
import { useTheme } from '@/context/ThemeContext';
import { useAlbumDetails } from '@/queries/useMusic';
import { typography } from '@/theme/typography';
import type { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AlbumData {
  id: string;
  name: string;
  year?: string | number;
  language?: string;
  play_count?: number | string;
  copyright_text?: string;
  image?: { link: string }[];
  songs?: Song[];
  artist_map?: { artists?: ChipArtist[] };
}

const keyOf = (song: Song) => song.id;

/** An album: its sleeve and record, the people on it, its songs in order, its credits. */
export default function AlbumScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  // Cached and saved on the phone: an album you've opened before is there with no spinner.
  const { data, isPending, refetch } = useAlbumDetails(id);
  const album = data?.id ? (data as unknown as AlbumData) : null;

  const songs = useMemo(() => (album?.songs ?? []).map(ensureHttpsForSongUrls), [album?.songs]);
  const collection = useCollection(songs);
  const room = useRoomAction(songs, album?.name, collection);
  const { playAt } = collection;

  const renderItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <TrackRow song={item} index={index} onPlay={playAt} showCover={false} dropAlbum />
    ),
    [playAt]
  );

  if (isPending) return <DetailSkeleton variant='sleeve' />;
  if (!album) return <DetailError message="Couldn't load this album" onRetry={() => refetch()} />;

  const cover = coverOf(album.image);
  const first = songs[0];
  const released = longDate(first?.release_date);
  const language = album.language ? album.language[0].toUpperCase() + album.language.slice(1) : '';
  const credits = [first?.label && `Label: ${first.label}`, cleanText(album.copyright_text)].filter(
    Boolean
  );

  return (
    <DetailScreen
      variant='sleeve'
      title={album.name}
      backdrop={cover}
      collection={collection}
      data={songs}
      renderItem={renderItem}
      keyExtractor={keyOf}
      header={
        <View>
          <SleeveHero cover={cover} active={collection.active} playing={collection.playing} />
          <View style={styles.words}>
            <Rise order={0}>
              <Kicker>{['Album', album.year, language].filter(Boolean).join(' · ')}</Kicker>
            </Rise>
            <Rise order={1}>
              <DisplayTitle>{cleanText(album.name)}</DisplayTitle>
            </Rise>
            <Rise order={2}>
              <MetaLine
                parts={[
                  songCount(songs.length),
                  runtime(songs),
                  compactCount(album.play_count) && `${compactCount(album.play_count)} plays`,
                ]}
              />
            </Rise>
            <Rise order={3}>
              <ArtistChips artists={album.artist_map?.artists} />
            </Rise>
          </View>
          <Rise order={4}>
            <ActionBar collection={collection} count={songs.length} room={room} />
          </Rise>
          <ListHeading>Songs</ListHeading>
        </View>
      }
      ListFooterComponent={
        released || credits.length ? (
          <View style={styles.liner}>
            {released ? (
              <Text style={[styles.released, { color: colors.foreground }]}>
                Released {released}
              </Text>
            ) : null}
            {credits.map((line) => (
              <Text key={line} style={[styles.credit, { color: colors.mutedForeground }]}>
                {line}
              </Text>
            ))}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  words: { paddingHorizontal: 20 },
  liner: { paddingHorizontal: 20, paddingTop: 24, gap: 4 },
  released: { ...typography.labelMd },
  credit: { ...typography.caption },
});
