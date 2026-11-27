import { ActionBar } from '@/components/music/detail/Actions';
import { useDetail } from '@/components/music/detail/context';
import {
  DetailError,
  DetailScreen,
  DetailSkeleton,
  ListHeading,
} from '@/components/music/detail/DetailScreen';
import { cleanText, compactCount, coverOf, longDate } from '@/components/music/detail/format';
import {
  DisplayTitle,
  ExpandableText,
  Kicker,
  MetaLine,
  PortraitHero,
  Rise,
} from '@/components/music/detail/Hero';
import { TrackRow } from '@/components/music/detail/TrackRow';
import { useCollection, useRoomAction } from '@/components/music/detail/useCollection';
import { AlbumCard, ArtistCard, PlaylistCard } from '@/components/music/MusicCards';
import { CardRow } from '@/components/music/MusicLists';
import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useArtistDetails } from '@/queries/useMusic';
import { typography } from '@/theme/typography';
import type { Album, Artist, ArtistDetails, Playlist } from '@/types/music';
import type { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

/** Popular songs shown before "Show all". */
const POPULAR = 5;

const keyOf = (song: Song) => song.id;
const albumKey = (album: Album, i: number) => album?.id || album?.album_id || String(i);
const renderAlbum = (album: Album) => <AlbumCard album={album} />;
const renderPlaylist = (playlist: Playlist) => <PlaylistCard playlist={playlist} />;
const renderArtist = (artist: Artist) => <ArtistCard artist={artist} />;

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const CHEVRON_TURN = {
  transitionProperty: 'transform',
  transitionDuration: 220,
  transitionTimingFunction: 'ease-out',
} as const;

/** "Show all 10" under the popular songs; the chevron turns to say which way it goes. */
const ShowAll = memo(function ShowAll({
  open,
  total,
  onToggle,
}: {
  open: boolean;
  total: number;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const { revealFrom } = useDetail();
  return (
    <PressableScale
      onPress={() => {
        if (!open) revealFrom(POPULAR);
        onToggle();
      }}
      accessibilityRole='button'
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? 'Show fewer songs' : `Show all ${total} songs`}
      style={[styles.showAll, { borderColor: colors.hairline }]}
    >
      <Gloss tone='surface' />
      <Text style={[styles.showAllText, { color: colors.foreground }]}>
        {open ? 'Show less' : `Show all ${total}`}
      </Text>
      <Animated.View style={[CHEVRON_TURN, { transform: [{ rotate: open ? '180deg' : '0deg' }] }]}>
        <Ionicons name='chevron-down' size={15} color={colors.mutedForeground} />
      </Animated.View>
    </PressableScale>
  );
});

/** Who they are: the bio, cut short until you open it, and a few facts. */
const About = memo(function About({ artist }: { artist: ArtistDetails }) {
  const { colors } = useTheme();
  const bio = useMemo(
    () =>
      [...(artist.bio ?? [])]
        .sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))
        .map((part) => cleanText(part.text))
        .filter(Boolean)
        .join('\n\n'),
    [artist.bio]
  );
  const born = longDate(artist.dob);
  const languages = (artist.available_languages ?? []).filter(
    (l) => l && l !== 'unknown' && l !== 'instrumental'
  );
  const facts = [
    born && { label: 'Born', value: born },
    languages.length > 0 && {
      label: 'Sings in',
      value:
        languages.slice(0, 4).map(capitalise).join(', ') +
        (languages.length > 4 ? ` +${languages.length - 4}` : ''),
    },
  ].filter(Boolean) as { label: string; value: string }[];

  if (!bio && !facts.length && !artist.wiki) return null;

  return (
    <View>
      <ListHeading>About</ListHeading>
      <View style={[styles.about, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
        <View pointerEvents='none' style={[styles.aboutSheen, { backgroundColor: colors.sheen }]} />
        {bio ? <ExpandableText text={bio} lines={4} /> : null}
        {facts.map((fact) => (
          <View key={fact.label} style={[styles.fact, { borderTopColor: colors.hairline }]}>
            <Text style={[styles.factLabel, { color: colors.mutedForeground }]}>{fact.label}</Text>
            <Text style={[styles.factValue, { color: colors.foreground }]} numberOfLines={2}>
              {fact.value}
            </Text>
          </View>
        ))}
        {artist.wiki ? (
          <PressableScale
            onPress={() => WebBrowser.openBrowserAsync(artist.wiki!).catch(() => {})}
            accessibilityRole='link'
            accessibilityLabel={`Read about ${artist.name} on Wikipedia`}
            style={[styles.fact, { borderTopColor: colors.hairline }]}
          >
            <Text style={[styles.factLabel, { color: colors.mutedForeground }]}>More</Text>
            <View style={styles.link}>
              <Text style={[styles.factValue, { color: colors.foreground }]}>Wikipedia</Text>
              <Ionicons name='open-outline' size={14} color={colors.mutedForeground} />
            </View>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
});

/**
 * An artist: their photo across the top, their popular songs, then everything else they've put
 * out and who else fans listen to, on one page you scroll rather than tabs you switch.
 */
export default function ArtistScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  // Cached and saved on the phone: an artist you've opened before is there with no spinner.
  const { data, isPending, refetch } = useArtistDetails(id);
  const artist: ArtistDetails | null = data?.id ? data : null;
  const [showAll, setShowAll] = useState(false);

  const songs = useMemo(
    () => (artist?.top_songs ?? []).map(ensureHttpsForSongUrls),
    [artist?.top_songs]
  );
  const visible = useMemo(() => (showAll ? songs : songs.slice(0, POPULAR)), [songs, showAll]);
  const collection = useCollection(songs);
  const room = useRoomAction(songs, artist?.name, collection);
  const { playAt } = collection;

  const renderItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => (
      <TrackRow song={item} index={index} onPlay={playAt} />
    ),
    [playAt]
  );

  if (isPending) return <DetailSkeleton variant='portrait' />;
  if (!artist) return <DetailError message="Couldn't load this artist" onRetry={() => refetch()} />;

  const role = artist.dominant_type ? capitalise(artist.dominant_type.replace(/_/g, ' ')) : '';
  const listeners = compactCount(artist.fan_count);
  const followers = compactCount(artist.follower_count);
  const singles = (artist.singles ?? []) as unknown as Album[];

  return (
    <DetailScreen
      variant='portrait'
      title={artist.name}
      collection={collection}
      data={visible}
      renderItem={renderItem}
      keyExtractor={keyOf}
      header={
        <View>
          <PortraitHero image={coverOf(artist.image)}>
            <Rise order={0}>
              <Kicker
                icon={
                  artist.is_verified ? (
                    <Ionicons name='checkmark-circle' size={15} color={colors.primary} />
                  ) : undefined
                }
              >
                {[artist.is_verified ? 'Verified artist' : 'Artist', role]
                  .filter(Boolean)
                  .join(' · ')}
              </Kicker>
            </Rise>
            <Rise order={1}>
              <DisplayTitle huge>{cleanText(artist.name)}</DisplayTitle>
            </Rise>
            <Rise order={2}>
              <MetaLine
                parts={[
                  listeners && `${listeners} listeners`,
                  followers && `${followers} followers`,
                ]}
              />
            </Rise>
          </PortraitHero>
          <Rise order={3}>
            <ActionBar collection={collection} count={songs.length} room={room} />
          </Rise>
          {songs.length > 0 && <ListHeading>Popular</ListHeading>}
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.mutedForeground }]}>No songs yet</Text>
      }
      ListFooterComponent={
        <View>
          {songs.length > POPULAR && (
            <ShowAll open={showAll} total={songs.length} onToggle={() => setShowAll((v) => !v)} />
          )}
          <View style={styles.shelves}>
            <CardRow
              title='Latest releases'
              data={artist.latest_release ?? []}
              itemWidth={140}
              renderCard={renderAlbum}
              keyOf={albumKey}
            />
            <CardRow
              title='Albums'
              data={artist.top_albums ?? []}
              itemWidth={140}
              renderCard={renderAlbum}
              keyOf={albumKey}
            />
            <CardRow
              title='Singles'
              data={singles}
              itemWidth={124}
              renderCard={renderAlbum}
              keyOf={albumKey}
            />
            <CardRow
              title='Playlists'
              data={artist.dedicated_artist_playlist ?? []}
              itemWidth={140}
              renderCard={renderPlaylist}
            />
            <CardRow
              title='Featured in'
              data={artist.featured_artist_playlist ?? []}
              itemWidth={140}
              renderCard={renderPlaylist}
            />
            <CardRow
              title='Fans also like'
              data={artist.similar_artists ?? []}
              itemWidth={108}
              renderCard={renderArtist}
            />
          </View>
          <About artist={artist} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.bodyMd, textAlign: 'center', paddingVertical: 32 },
  showAll: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  showAllText: { ...typography.labelMd },
  shelves: { marginTop: 32 },
  about: {
    marginHorizontal: 16,
    padding: 18,
    paddingBottom: 6,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  aboutSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 46,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  factLabel: { ...typography.bodySm },
  factValue: { ...typography.labelMd, flexShrink: 1, textAlign: 'right' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
