import type { Shelf } from '@/api/personal';
import { coverOf, mosaicOf, songCount } from '@/components/music/detail/format';
import { ICON_IN, ICON_OUT } from '@/components/music/detail/motion';
import { playList, useCollection } from '@/components/music/detail/useCollection';
import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import { CachedImage } from '@/components/ui/CachedImage';
import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { blurredArt } from '@/lib/artwork';
import {
  BUTTON_PRESS_SCALE,
  IMAGE_FADE_MS,
  LIST_PRESS_DELAY,
  PRESS_SCALE,
  ROW_PRESS_SCALE,
} from '@/lib/motion';
import { shortSongName, type Station } from '@/lib/stations';
import { usePlayerStore } from '@/stores/playerStore';
import { stationQuery } from '@/queries/useMusic';
import { fonts, typography } from '@/theme/typography';
import type { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

export const SIDE = 16;
const ARRIVE = FadeIn.duration(220).reduceMotion(ReduceMotion.System);
const LEAVE = FadeOut.duration(160).reduceMotion(ReduceMotion.System);

const artistOf = (song: Song) =>
  song.artist_map?.primary_artists?.[0]?.name ||
  song.artist_map?.artists?.[0]?.name ||
  song.subtitle ||
  '';

/** A small play/pause icon that turns over when it changes. */
const PlayIcon = memo(function PlayIcon({
  playing,
  size,
  color,
}: {
  playing: boolean;
  size: number;
  color: string;
}) {
  const icon = playing ? 'pause' : 'play';
  return (
    <View style={{ width: size + 2, height: size + 2 }}>
      <Animated.View key={icon} entering={ICON_IN} exiting={ICON_OUT} style={styles.iconLayer}>
        <Ionicons name={icon} size={size} color={color} style={{ marginLeft: playing ? 0 : 2 }} />
      </Animated.View>
    </View>
  );
});

// ─── Station chips ──────────────────────────────────────────────────────────────────────────────

/**
 * One station. A tap plays it straight away (fetching its songs first if it has none of its
 * own); tapping it again while it plays pauses it.
 */
const StationChip = memo(function StationChip({ station }: { station: Station }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const [loading, setLoading] = useState(false);
  const source = station.source ?? { kind: 'playlist' as const, id: '' };
  // Only reads what's already cached: a station's songs are fetched when it's tapped.
  const { data: fetched } = useQuery({ ...stationQuery(source), enabled: false });
  const songs = station.songs ?? fetched ?? EMPTY;
  const { active, playing, toggle } = useCollection(songs);

  const prefetch = useCallback(() => {
    if (station.source) client.prefetchQuery(stationQuery(station.source)).catch(() => {});
  }, [client, station.source]);

  const press = useCallback(async () => {
    if (active || station.songs) {
      toggle();
      return;
    }
    if (!station.source) return;
    setLoading(true);
    try {
      const list = await client.fetchQuery(stationQuery(station.source));
      await playList(list, 0);
    } catch {
      // The toast from playList covers a song that won't play; a station that won't load is quiet.
    } finally {
      setLoading(false);
    }
  }, [active, station.songs, station.source, toggle, client]);

  return (
    <PressableScale
      onPress={press}
      onPressIn={prefetch}
      scaleTo={BUTTON_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityState={{ selected: active, busy: loading }}
      accessibilityLabel={playing ? `Pause ${station.title}` : `Play ${station.title}`}
      style={[styles.chip, { backgroundColor: active ? colors.foreground : colors.raised }]}
    >
      {loading ? (
        <ActivityIndicator size='small' color={colors.mutedForeground} style={styles.chipSpinner} />
      ) : active ? (
        // Still: only the playing song's own row moves, so Home isn't a page of bouncing bars.
        <PlayingBars color={colors.background} active={false} />
      ) : null}
      <Text
        style={[styles.chipText, { color: active ? colors.background : colors.mutedForeground }]}
        numberOfLines={1}
      >
        {station.title}
      </Text>
    </PressableScale>
  );
});

const EMPTY: Song[] = [];

/** Every station in one row, where the dial used to show one at a time. */
export const StationChips = memo(function StationChips({ stations }: { stations: Station[] }) {
  if (!stations.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipRow}
    >
      {stations.map((station) => (
        <StationChip key={station.key} station={station} />
      ))}
    </ScrollView>
  );
});

// ─── Right now ──────────────────────────────────────────────────────────────────────────────────

/**
 * The one thing to play now: the mix for this time of day. Three of its covers fanned out, and
 * the artwork washed behind it.
 */
export const RightNowCard = memo(function RightNowCard({
  title,
  subtitle,
  songs,
}: {
  title: string;
  subtitle?: string;
  songs: Song[];
}) {
  const { colors } = useTheme();
  const { playing, toggle } = useCollection(songs);
  const covers = mosaicOf(songs).slice(0, 3);
  if (!songs.length) return null;

  return (
    <Animated.View entering={ARRIVE} style={styles.heroWrap}>
      <PressableScale
        onPress={toggle}
        scaleTo={PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${title}`}
        style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      >
        {covers[0] ? (
          <CachedImage
            {...blurredArt(covers[0], 50)}
            style={[StyleSheet.absoluteFill, styles.heroArt]}
          />
        ) : null}
        <View
          pointerEvents='none'
          style={[
            StyleSheet.absoluteFill,
            styles.heroRound,
            { backgroundColor: `${colors.card}B3` },
          ]}
        />
        <View pointerEvents='none' style={[styles.heroSheen, { backgroundColor: colors.sheen }]} />

        <Text style={[styles.kicker, { color: colors.mutedForeground }]}>RIGHT NOW</Text>
        <Text style={[styles.heroTitle, { color: colors.foreground }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}

        <View style={styles.heroBottom}>
          <View style={styles.fan}>
            {covers.map((uri, i) => (
              <CachedImage
                key={uri}
                source={{ uri }}
                transition={IMAGE_FADE_MS}
                style={[
                  styles.fanCover,
                  { borderColor: colors.card, backgroundColor: colors.raised, zIndex: 3 - i },
                  FAN[i],
                ]}
              />
            ))}
          </View>
          <View style={[styles.heroPlay, { backgroundColor: colors.primary }]}>
            <Gloss />
            <PlayIcon playing={playing} size={22} color={colors.primaryForeground} />
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const FAN = [
  undefined,
  { transform: [{ translateY: 6 }, { rotate: '4deg' }] },
  { transform: [{ translateY: 12 }, { rotate: '8deg' }] },
];

// ─── Continue an album ──────────────────────────────────────────────────────────────────────────

/**
 * The album you stopped partway through, and how much of it is left. Only while nothing is
 * playing: with music on it's beside the point, and once you tap it you're continuing it, so it
 * steps aside.
 */
export const ContinueRow = memo(function ContinueRow({ shelf }: { shelf: Shelf }) {
  const { colors } = useTheme();
  const { playing, toggle } = useCollection(shelf.songs);
  const busy = usePlayerStore((s) => s.isPlaying);
  const cover = coverOf(shelf.songs[0]?.image, 1);
  if (busy) return null;
  return (
    <Animated.View entering={ARRIVE} exiting={LEAVE}>
      <PressableScale
        onPress={toggle}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${shelf.title}`}
        style={[styles.continue, { backgroundColor: colors.card, borderColor: colors.hairline }]}
      >
        <CachedImage
          source={{ uri: cover }}
          transition={IMAGE_FADE_MS}
          style={[styles.continueArt, { backgroundColor: colors.raised }]}
        />
        <View style={styles.flex}>
          <Text style={[styles.continueTitle, { color: colors.foreground }]} numberOfLines={1}>
            {shelf.title}
          </Text>
          <Text style={[styles.small, { color: colors.mutedForeground }]} numberOfLines={1}>
            Album you didn&apos;t finish · {songCount(shelf.songs.length)} left
          </Text>
        </View>
        <View style={[styles.ring, { borderColor: colors.hairline }]}>
          <PlayIcon playing={playing} size={16} color={colors.foreground} />
        </View>
      </PressableScale>
    </Animated.View>
  );
});

// ─── Shelves of cards ───────────────────────────────────────────────────────────────────────────

/** A section heading in the page's display face. */
export const HomeHeading = memo(function HomeHeading({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingText, { color: colors.foreground }]} accessibilityRole='header'>
        {title}
      </Text>
      {action && (
        <PressableScale
          onPress={action.onPress}
          hitSlop={10}
          scaleTo={BUTTON_PRESS_SCALE}
          accessibilityRole='button'
          style={styles.headingAction}
        >
          <Text style={[styles.actionText, { color: colors.mutedForeground }]}>{action.label}</Text>
        </PressableScale>
      )}
    </View>
  );
});

const HERO_RADIUS = 26;
const MIX_CARD = 140;
const MIX_RADIUS = 14;
/*
 * Images round their own corners instead of being clipped by a rounded wrapper: Android clips
 * again on every frame of a scroll, and these cards are what you scroll past.
 */
const TILE_CORNERS = [
  { borderTopLeftRadius: MIX_RADIUS },
  { borderTopRightRadius: MIX_RADIUS },
  { borderBottomLeftRadius: MIX_RADIUS },
  { borderBottomRightRadius: MIX_RADIUS },
];
const SONG_CARD = 118;

/** A mix: four of its covers in a square, its name and the people in it. Tap plays it. */
const MixCard = memo(function MixCard({ shelf }: { shelf: Shelf }) {
  const { colors } = useTheme();
  const { playing, active, toggle } = useCollection(shelf.songs);
  const covers = mosaicOf(shelf.songs);
  return (
    <PressableScale
      onPress={toggle}
      unstable_pressDelay={LIST_PRESS_DELAY}
      accessibilityRole='button'
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${shelf.title}`}
      style={styles.mix}
    >
      <View style={[styles.mixCover, { backgroundColor: colors.raised }]}>
        {covers.length >= 4 ? (
          <View style={styles.mosaic}>
            {covers.slice(0, 4).map((uri, i) => (
              <CachedImage
                key={uri}
                source={{ uri }}
                style={[styles.mosaicTile, TILE_CORNERS[i]]}
              />
            ))}
          </View>
        ) : (
          <CachedImage
            source={{ uri: covers[0] }}
            style={[StyleSheet.absoluteFill, styles.mixRound]}
          />
        )}
        {active && (
          <View style={styles.coverBars}>
            <PlayingBars color='#fff' active={false} />
          </View>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
        {shelf.title}
      </Text>
      {shelf.subtitle ? (
        <Text style={[styles.small, { color: colors.mutedForeground }]} numberOfLines={1}>
          {shelf.subtitle}
        </Text>
      ) : null}
    </PressableScale>
  );
});

/** Your Daily Mixes and the other shelves made from your listening, side by side. */
export const MixRow = memo(function MixRow({ shelves }: { shelves: Shelf[] }) {
  if (!shelves.length) return null;
  return (
    <View style={styles.section}>
      <HomeHeading title='Your mixes' />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {shelves.map((shelf) => (
          <MixCard key={shelf.key} shelf={shelf} />
        ))}
      </ScrollView>
    </View>
  );
});

/** One new song as a cover. Tap plays the row from it. */
const ReleaseCard = memo(function ReleaseCard({
  song,
  index,
  list,
}: {
  song: Song;
  index: number;
  list: Song[];
}) {
  const { colors } = useTheme();
  const { onLongPress, isCurrentSong: isCurrent, options } = useSongPress(song);
  return (
    <>
      <PressableScale
        onPress={() => playList(list, index)}
        onLongPress={onLongPress}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        accessibilityRole='button'
        accessibilityLabel={`Play ${song.name} by ${artistOf(song)}`}
        style={styles.release}
      >
        <View>
          <CachedImage
            source={{ uri: coverOf(song.image) }}
            transition={IMAGE_FADE_MS}
            style={[styles.releaseCover, { backgroundColor: colors.raised }]}
          />
          {isCurrent && (
            <View style={styles.coverBars}>
              <PlayingBars color='#fff' active={false} />
            </View>
          )}
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {shortSongName(song.name)}
        </Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]} numberOfLines={1}>
          {artistOf(song)}
        </Text>
      </PressableScale>
      {options}
    </>
  );
});

/** Songs new from the artists you play. */
export const NewReleasesRow = memo(function NewReleasesRow({ shelf }: { shelf?: Shelf }) {
  if (!shelf?.songs.length) return null;
  return (
    <View style={styles.section}>
      <HomeHeading title={shelf.title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
      >
        {shelf.songs.slice(0, 12).map((song, index) => (
          <ReleaseCard key={song.id} song={song} index={index} list={shelf.songs} />
        ))}
      </ScrollView>
    </View>
  );
});

// ─── Picked for you ─────────────────────────────────────────────────────────────────────────────

/** A song with one quiet line under it: why it's here, or who it's by. */
const PickRow = memo(function PickRow({
  song,
  index,
  list,
  reason,
}: {
  song: Song;
  index: number;
  list: Song[];
  reason?: string;
}) {
  const { colors } = useTheme();
  const { onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);
  const line = reason || artistOf(song);
  return (
    <>
      <PressableScale
        onPress={() => playList(list, index)}
        onLongPress={onLongPress}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${isCurrentSong && isPlaying ? 'Pause' : 'Play'} ${song.name}. ${line}`}
        style={styles.pick}
      >
        <CachedImage
          source={{ uri: coverOf(song.image, 1) }}
          transition={IMAGE_FADE_MS}
          style={[styles.pickArt, { backgroundColor: colors.raised }]}
        />
        <View style={styles.flex}>
          <Text style={[styles.pickTitle, { color: colors.foreground }]} numberOfLines={1}>
            {shortSongName(song.name)}
          </Text>
          <Text style={[styles.small, { color: colors.mutedForeground }]} numberOfLines={1}>
            {line}
          </Text>
        </View>
        {isCurrentSong ? <PlayingBars color={colors.foreground} active={isPlaying} /> : null}
      </PressableScale>
      {options}
    </>
  );
});

/** A short list of songs with a "Play all"; reasons under each when the server gave them. */
export const PickList = memo(function PickList({
  title,
  songs,
  reasons,
}: {
  title: string;
  songs: Song[];
  reasons?: Record<string, string>;
}) {
  const playAll = useCallback(() => playList(songs, 0), [songs]);
  if (!songs.length) return null;
  return (
    <View style={styles.section}>
      <HomeHeading title={title} action={{ label: 'Play all', onPress: playAll }} />
      {songs.map((song, index) => (
        <PickRow key={song.id} song={song} index={index} list={songs} reason={reasons?.[song.id]} />
      ))}
    </View>
  );
});

// ─── Loading ────────────────────────────────────────────────────────────────────────────────────

/** Stand-ins shaped like the page, so nothing jumps when it arrives. Still. */
export function HomeFeedSkeleton() {
  const { colors } = useTheme();
  const fill = { backgroundColor: colors.raised };
  return (
    <View accessibilityLabel='Loading' accessible>
      <View style={styles.chips}>
        {[64, 84, 60, 70].map((w) => (
          <View key={w} style={[styles.skelChip, fill, { width: w }]} />
        ))}
      </View>
      <View style={[styles.skelHero, fill]} />
      <View style={styles.section}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.pick}>
            <View style={[styles.pickArt, fill]} />
            <View style={[styles.flex, styles.skelLines]}>
              <View style={[styles.skelLine, fill, { width: '62%' }]} />
              <View style={[styles.skelLine, fill, { width: '40%', height: 10 }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  iconLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  small: { ...typography.bodySm, fontSize: 12.5, marginTop: 1 },

  chipRow: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: SIDE, paddingTop: 14 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chipText: { ...typography.labelMd, fontSize: 13.5 },
  chipSpinner: { transform: [{ scale: 0.7 }], marginHorizontal: -4 },

  heroWrap: { marginHorizontal: SIDE, marginTop: 18 },
  hero: {
    borderRadius: HERO_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  heroArt: { opacity: 0.9, borderRadius: HERO_RADIUS },
  heroRound: { borderRadius: HERO_RADIUS },
  heroSheen: { position: 'absolute', top: 0, left: HERO_RADIUS, right: HERO_RADIUS, height: 1 },
  kicker: { ...typography.labelSm, letterSpacing: 1.4 },
  heroTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.8,
    marginTop: 4,
  },
  heroSub: { ...typography.bodySm, marginTop: 4 },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingBottom: 12,
  },
  fan: { flexDirection: 'row' },
  fanCover: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: -24,
    // A system shadow, not a blurred one: this scrolls, and a blurred shadow is redrawn each frame.
    elevation: 4,
  },
  heroPlay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  continue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: SIDE,
    marginTop: 12,
    padding: 10,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  continueArt: { width: 44, height: 44, borderRadius: 10 },
  continueTitle: { ...typography.labelLg, fontSize: 14.5 },
  ring: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { marginTop: 34 },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SIDE,
    marginBottom: 12,
  },
  headingText: { fontFamily: fonts.display, fontSize: 19, letterSpacing: -0.4 },
  headingAction: { paddingVertical: 2 },
  actionText: { ...typography.labelMd },

  cardRow: { paddingHorizontal: SIDE, gap: 14 },
  mix: { width: MIX_CARD },
  mixCover: { width: MIX_CARD, height: MIX_CARD, borderRadius: MIX_RADIUS },
  mixRound: { borderRadius: MIX_RADIUS },
  mosaic: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  mosaicTile: { width: '50%', height: '50%' },
  coverBars: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cardTitle: { ...typography.labelMd, fontSize: 13.5, marginTop: 9 },
  release: { width: SONG_CARD },
  releaseCover: { width: SONG_CARD, height: SONG_CARD, borderRadius: 12 },

  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
    paddingHorizontal: SIDE,
  },
  pickArt: { width: 48, height: 48, borderRadius: 9 },
  pickTitle: { ...typography.labelLg, fontSize: 15, letterSpacing: -0.15 },

  skelChip: { height: 34, borderRadius: 17 },
  skelHero: { height: 236, borderRadius: 26, marginHorizontal: SIDE, marginTop: 18 },
  skelLines: { gap: 7 },
  skelLine: { height: 13, borderRadius: 5 },
});
