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
  runtime,
  songCount,
} from '@/components/music/detail/format';
import {
  ArtistChips,
  DisplayTitle,
  ExpandableText,
  Kicker,
  MetaLine,
  Rise,
  SleeveHero,
  type ChipArtist,
} from '@/components/music/detail/Hero';
import { TrackRow } from '@/components/music/detail/TrackRow';
import { useCollection, useRoomAction } from '@/components/music/detail/useCollection';
import { usePlaylistDetails } from '@/queries/useMusic';
import type { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

interface PlaylistData {
  id: string;
  name: string;
  header_desc?: string;
  image?: string;
  list_count?: number;
  follower_count?: number;
  last_updated?: string;
  songs?: Song[];
  artists?: ChipArtist[];
}

const keyOf = (song: Song) => song.id;

const updatedLabel = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
};

/** An editor's playlist: its cover as a sleeve, what it's about, who's on it, its songs. */
export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  // Cached and saved on the phone: a playlist you've opened before is there with no spinner.
  const { data, isPending, refetch } = usePlaylistDetails(id);
  const playlist = data?.id ? (data as unknown as PlaylistData) : null;

  const songs = useMemo(
    () => (playlist?.songs ?? []).map(ensureHttpsForSongUrls),
    [playlist?.songs]
  );
  const collection = useCollection(songs);
  const room = useRoomAction(songs, playlist?.name, collection);
  const { playAt } = collection;

  const renderItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <TrackRow song={item} index={index} onPlay={playAt} />
    ),
    [playAt]
  );

  if (isPending) return <DetailSkeleton variant='sleeve' />;
  if (!playlist) {
    return <DetailError message="Couldn't load this playlist" onRetry={() => refetch()} />;
  }

  const cover = coverOf(playlist.image);
  const description = cleanText(playlist.header_desc);
  const followers = compactCount(playlist.follower_count);

  return (
    <DetailScreen
      variant='sleeve'
      title={playlist.name}
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
              <Kicker>
                {['Playlist', updatedLabel(playlist.last_updated)].filter(Boolean).join(' · ')}
              </Kicker>
            </Rise>
            <Rise order={1}>
              <DisplayTitle>{cleanText(playlist.name)}</DisplayTitle>
            </Rise>
            <Rise order={2}>
              <MetaLine
                parts={[
                  songCount(songs.length || playlist.list_count || 0),
                  runtime(songs),
                  followers && `${followers} followers`,
                ]}
              />
            </Rise>
            {description ? (
              <Rise order={3} style={styles.description}>
                <ExpandableText text={description} />
              </Rise>
            ) : null}
            <Rise order={4}>
              <ArtistChips artists={playlist.artists} />
            </Rise>
          </View>
          <Rise order={5}>
            <ActionBar collection={collection} count={songs.length} room={room} />
          </Rise>
          <ListHeading>Songs</ListHeading>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  words: { paddingHorizontal: 20 },
  description: { marginTop: 10 },
});
