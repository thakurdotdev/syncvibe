import { CoverDeck, DECK_PEEK } from '@/components/music/home/CoverDeck';
import { SongRow } from '@/components/music/home/HomeSections';
import { playStationFrom } from '@/components/music/home/playStation';
import { VibeDial } from '@/components/music/home/VibeDial';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { HomeHeader } from '@/components/ui/AppHeader';
import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, ROW_PRESS_SCALE } from '@/lib/motion';
import { buildStations, shortSongName, Station } from '@/lib/stations';
import {
  stationQuery,
  useHomePageMusic,
  useRecentMusic,
  useStationSongs,
} from '@/queries/useMusic';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlaybackState, usePlayerControls } from '@/stores/playerStore';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

type Colors = ReturnType<typeof useTheme>['colors'];

const LIST_SIZE = 8;
const RECENT_SHOWN = 10;
const RECENT_TILE = 116;
const SKELETON_DELAY_MS = 200;
const SIDE_MARGIN = 16;
/** The cover never takes more of a short phone's screen than this. */
const MAX_COVER_SHARE = 0.38;
const STAGE_ENTER = FadeIn.duration(140).easing(EASE_OUT);
const META_ENTER = FadeIn.duration(140).easing(EASE_OUT);
const ROW_REFLOW = LinearTransition.duration(180).easing(EASE_OUT);

const goRooms = () => router.navigate('/(tabs)/group-music');
const goBrowse = () => router.push('/browse');

/** New for you and your own recent songs in turn, then what's trending, each song once. */
const buildPool = (fresh: Song[], recent: Song[], trending: Song[]) => {
  const mixed: Song[] = [];
  for (let i = 0; i < Math.max(fresh.length, recent.length); i++) {
    if (fresh[i]) mixed.push(fresh[i]);
    if (recent[i]) mixed.push(recent[i]);
  }
  const seen = new Set<string>();
  return [...mixed, ...trending].filter((song) => {
    if (!song?.id || seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
};

const BrowseRow = memo(function BrowseRow({ colors }: { colors: Colors }) {
  return (
    <PressableScale
      onPress={goBrowse}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      style={styles.browseRow}
    >
      <Text style={[styles.browseText, { color: colors.foreground }]}>Browse all music</Text>
      <Ionicons name='chevron-forward' size={17} color={colors.mutedForeground} />
    </PressableScale>
  );
});

const songArtist = (song: Song) =>
  song.artist_map?.primary_artists?.[0]?.name ||
  song.artist_map?.artists?.[0]?.name ||
  song.subtitle ||
  '';

/**
 * Plays the song in front. Tapping the cover does the same, but a cover doesn't look like a
 * button, so this is the one that says so. Subscribes to playback on its own, so the stage
 * around it doesn't re-render when a song starts or stops.
 */
const StagePlayButton = memo(function StagePlayButton({
  song,
  colors,
  onPlay,
}: {
  song: Song;
  colors: Colors;
  onPlay: () => void;
}) {
  const { currentSong, isPlaying } = usePlaybackState();
  const playing = currentSong?.id === song.id && isPlaying;

  return (
    <PressableScale
      onPress={onPlay}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={6}
      accessibilityRole='button'
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${song.name}`}
      style={[styles.stagePlay, { backgroundColor: colors.primary }]}
    >
      <Gloss />
      <Ionicons
        name={playing ? 'pause' : 'play'}
        size={22}
        color={colors.primaryForeground}
        style={{ marginLeft: playing ? 0 : 2 }}
      />
    </PressableScale>
  );
});

/** Songs you played lately, a swipe away. Tapping one plays it and queues the ones after it. */
const RecentStrip = memo(function RecentStrip({
  songs,
  colors,
}: {
  songs: Song[];
  colors: Colors;
}) {
  if (songs.length < 3) return null;

  return (
    <View style={styles.recent}>
      <Text style={[styles.sectionLabel, styles.sectionInset, { color: colors.foreground }]}>
        Jump back in
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentRow}
      >
        {songs.map((song, i) => {
          const art = song.image?.[1]?.link || song.image?.[0]?.link;
          return (
            <PressableScale
              key={song.id}
              onPress={() => playStationFrom(songs, i)}
              scaleTo={ROW_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityLabel={`Play ${song.name} by ${songArtist(song)}`}
              style={styles.recentTile}
            >
              <Image
                source={{ uri: art ? convertToHttps(art) : undefined, cache: 'force-cache' }}
                style={[styles.recentArt, { backgroundColor: colors.raised }]}
                fadeDuration={0}
                resizeMethod='resize'
              />
              <Text style={[styles.recentTitle, { color: colors.foreground }]} numberOfLines={1}>
                {shortSongName(song.name)}
              </Text>
              <Text style={[styles.recentSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {songArtist(song)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
});

/** Your live room: what's playing and who's there, with one clear way back in. */
const LiveRoomCard = memo(function LiveRoomCard({ colors }: { colors: Colors }) {
  const group = useGroupSessionStore((s) => s.currentGroup);
  const memberCount = useGroupSessionStore((s) => s.groupMembers.length);
  const songName = useGroupPlaybackStore((s) => s.currentSong?.name);
  const art = useGroupPlaybackStore(
    (s) => s.currentSong?.image?.[1]?.link || s.currentSong?.image?.[0]?.link
  );
  if (!group) return null;

  return (
    <View style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      <View style={styles.liveTop}>
        <View style={[styles.roomThumb, { borderColor: colors.live }]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.roomThumbImg} fadeDuration={0} />
          ) : (
            <Ionicons name='radio' size={22} color={colors.live} />
          )}
        </View>
        <View style={styles.roomText}>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
            <Text style={[styles.liveText, { color: colors.live }]}>{memberCount} listening</Text>
          </View>
          <Text style={[styles.roomTitle, { color: colors.foreground }]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={[styles.roomSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {songName || 'Nothing playing yet'}
          </Text>
        </View>
      </View>
      <PressableScale
        onPress={goRooms}
        accessibilityRole='button'
        accessibilityLabel={`Continue in ${group.name}`}
        style={[styles.continueBtn, { backgroundColor: colors.primary }]}
      >
        <Gloss />
        <Text style={[styles.continueText, { color: colors.primaryForeground }]}>Continue</Text>
        <Ionicons name='arrow-forward' size={17} color={colors.primaryForeground} />
      </PressableScale>
    </View>
  );
});

/**
 * Your own song while you're in a room. It leaves the bottom bar (the room owns playback)
 * and waits here instead.
 */
const YourMusicCard = memo(function YourMusicCard({ colors }: { colors: Colors }) {
  const { currentSong, isPlaying, activePlayerMode } = usePlaybackState();
  const { handlePlayPause } = usePlayerControls();
  if (!currentSong) return null;

  const art = currentSong.image?.[1]?.link || currentSong.image?.[0]?.link;
  const artist = currentSong.artist_map?.artists?.[0]?.name || currentSong.subtitle || '';
  const canPlay = activePlayerMode === 'normal';

  return (
    <View
      style={[styles.yourMusic, { backgroundColor: colors.card, borderColor: colors.hairline }]}
    >
      <Image source={{ uri: art }} style={styles.yourArt} fadeDuration={0} />
      <View style={styles.roomText}>
        <Text style={[styles.yourLabel, { color: colors.mutedForeground }]}>Your music</Text>
        <Text style={[styles.yourTitle, { color: colors.foreground }]} numberOfLines={1}>
          {currentSong.name}
        </Text>
        <Text style={[styles.roomSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {canPlay ? artist : 'Paused while the room plays'}
        </Text>
      </View>
      {canPlay ? (
        <PressableScale
          onPress={handlePlayPause}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={isPlaying ? 'Pause your music' : 'Play your music'}
          style={[styles.yourPlay, { backgroundColor: colors.raised }]}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={colors.foreground}
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        </PressableScale>
      ) : null}
    </View>
  );
});

/** Being in a room outranks everything else, so it leads the page. */
const LiveRoomSection = memo(function LiveRoomSection({ colors }: { colors: Colors }) {
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  if (!inRoom) return null;
  return (
    <View style={styles.roomStack}>
      <LiveRoomCard colors={colors} />
      <YourMusicCard colors={colors} />
    </View>
  );
});

/** Stand-ins shaped like the real screen, so nothing jumps when the content arrives. Still. */
function HomeSkeleton({ colors, size }: { colors: Colors; size: number }) {
  const block = (w: number | `${number}%`, h: number, r = 6) => ({
    width: w,
    height: h,
    borderRadius: r,
    backgroundColor: colors.muted,
  });

  return (
    <View style={styles.stage}>
      <View style={block(size, size, 10)} />
      <View style={[block('56%', 18), styles.skeletonTitle]} />
      <View style={block('34%', 12)} />
      <View style={styles.skeletonRows}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.skeletonRow}>
            <View style={block(48, 48)} />
            <View style={styles.skeletonLines}>
              <View style={block('60%', 13, 5)} />
              <View style={block('38%', 11, 5)} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const Retry = ({
  colors,
  message,
  onRetry,
}: {
  colors: Colors;
  message: string;
  onRetry: () => void;
}) => (
  <View style={styles.empty}>
    <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{message}</Text>
    <PressableScale
      onPress={onRetry}
      accessibilityRole='button'
      style={[styles.retry, { backgroundColor: colors.raised }]}
    >
      <Text style={[styles.retryText, { color: colors.foreground }]}>Try again</Text>
    </PressableScale>
  </View>
);

/** One vibe: its covers, the song in front, and what comes after it. Remounts per station. */
const StationStage = memo(function StationStage({
  station,
  size,
  colors,
  initialIndex,
  onIndexChange,
  showDeck,
}: {
  station: Station;
  size: number;
  colors: Colors;
  initialIndex: number;
  onIndexChange: (key: string, index: number) => void;
  showDeck: boolean;
}) {
  const { songs, isLoading, isError, refetch } = useStationSongs(station);
  const [index, setIndex] = useState(initialIndex);
  const front = Math.min(index, Math.max(0, songs.length - 1));
  const song: Song | undefined = songs[front];

  const changeIndex = useCallback(
    (next: number) => {
      setIndex(next);
      onIndexChange(station.key, next);
    },
    [onIndexChange, station.key]
  );

  const playAt = useCallback(
    (at: number) => {
      changeIndex(at);
      playStationFrom(songs, at);
    },
    [changeIndex, songs]
  );

  if (isLoading) return <HomeSkeleton colors={colors} size={size} />;
  if (isError || !song) {
    return (
      <Retry
        colors={colors}
        message={
          isError ? "Couldn't load this vibe. Check your connection." : 'Nothing here right now.'
        }
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Animated.View entering={STAGE_ENTER}>
      {showDeck ? (
        <View style={styles.stage}>
          <CoverDeck
            songs={songs}
            index={front}
            size={size}
            onIndexChange={changeIndex}
            onPlay={playAt}
          />
          <View style={styles.meta}>
            <Animated.View key={song.id} entering={META_ENTER} style={styles.metaText}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {shortSongName(song.name)}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {songArtist(song)}
              </Text>
            </Animated.View>
            <StagePlayButton song={song} colors={colors} onPlay={() => playAt(front)} />
          </View>
        </View>
      ) : null}
      <View style={styles.list}>
        {songs.length > (showDeck ? front + 1 : 0) && (
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
            {showDeck ? 'Up next' : station.title}
          </Text>
        )}
        {songs
          .slice(showDeck ? front + 1 : 0, (showDeck ? front + 1 : 0) + LIST_SIZE)
          .map((row) => (
            <Animated.View key={row.id} layout={ROW_REFLOW}>
              <SongRow song={row} onPlay={() => playAt(songs.indexOf(row))} />
            </Animated.View>
          ))}
      </View>
    </Animated.View>
  );
});

function HomeScreen() {
  const { user } = useUser();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));

  const { data: homePageData, isLoading, isError, refetch: refetchHome } = useHomePageMusic();
  const { data: recommendations, refetch: refetchRecent } = useRecentMusic();

  // Saved data is still being read from storage, which is too quick to show anything for.
  const isRestoring = useIsRestoring();
  const waiting = isLoading || isRestoring;

  // Only when you pull: data also refreshes by itself in the background, and a spinner appearing
  // for that, with nothing touched, reads as something going wrong.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const requests: Promise<unknown>[] = [refetchHome()];
    if (user?.userid) requests.push(refetchRecent());
    await Promise.allSettled(requests);
    setRefreshing(false);
  }, [user?.userid, refetchHome, refetchRecent]);

  // A fast load goes straight to the music, with no skeleton flashing up in between.
  const [skeletonShown, setSkeletonShown] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSkeletonShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const forYou = useMemo(
    () =>
      buildPool(
        recommendations?.songs ?? [],
        recommendations?.recentlyPlayed ?? [],
        homePageData?.trending?.data?.filter((i) => i?.type === 'song') ?? []
      ),
    [homePageData?.trending, recommendations]
  );
  const stations = useMemo(() => buildStations(homePageData, forYou), [homePageData, forYou]);
  const recent = useMemo(
    () => (recommendations?.recentlyPlayed ?? []).filter((s) => s?.id).slice(0, RECENT_SHOWN),
    [recommendations?.recentlyPlayed]
  );
  const titles = useMemo(() => stations.map((s) => s.title), [stations]);

  // The vibe you're on is remembered by key, so a data refresh or new section can't move you.
  const [stationKey, setStationKey] = useState<string | null>(null);
  const found = stations.findIndex((s) => s.key === stationKey);
  const stationIndex = found < 0 ? 0 : found;
  const station: Station | undefined = stations[stationIndex];

  // Yields to the dial: mounting a station must never hold up your finger.
  const onDialChange = useCallback(
    (next: number) => {
      const key = stations[next]?.key;
      if (key) startTransition(() => setStationKey(key));
    },
    [stations]
  );

  // Each vibe remembers the song you'd flicked to.
  const positions = useRef<Record<string, number>>({});
  const onIndexChange = useCallback((key: string, index: number) => {
    positions.current[key] = index;
  }, []);

  // So the vibes either side are usually ready before you reach them.
  useEffect(() => {
    for (const near of [stations[stationIndex - 1], stations[stationIndex + 1]]) {
      if (near?.source) queryClient.prefetchQuery(stationQuery(near.source)).catch(() => {});
      const cover = near?.songs?.[0]?.image?.[2]?.link;
      if (cover) Image.prefetch(cover).catch(() => {});
    }
  }, [queryClient, stationIndex, stations]);

  const coverSize = Math.min(
    width - SIDE_MARGIN * 2 - DECK_PEEK * 2,
    Math.round(height * MAX_COVER_SHARE)
  );

  return (
    <TabSafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <HomeHeader>
        {titles.length ? (
          <VibeDial titles={titles} index={stationIndex} onChange={onDialChange} />
        ) : (
          <View style={styles.root} />
        )}
      </HomeHeader>

      <ScrollView
        style={styles.root}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {inRoom ? <LiveRoomSection colors={colors} /> : null}

        {waiting ? (
          skeletonShown && !inRoom && <HomeSkeleton colors={colors} size={coverSize} />
        ) : !station ? (
          <Retry
            colors={colors}
            message={
              isError ? "Couldn't load music. Check your connection." : 'Nothing to play yet.'
            }
            onRetry={onRefresh}
          />
        ) : (
          <>
            <StationStage
              key={station.key}
              station={station}
              size={coverSize}
              colors={colors}
              initialIndex={positions.current[station.key] ?? 0}
              onIndexChange={onIndexChange}
              showDeck={!inRoom}
            />
            {!inRoom && <RecentStrip songs={recent} colors={colors} />}
            <BrowseRow colors={colors} />
          </>
        )}
      </ScrollView>
    </TabSafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: DECK_CLEARANCE },
  list: { paddingHorizontal: SIDE_MARGIN, paddingTop: 8 },
  sectionLabel: {
    fontFamily: fonts.displaySemibold,
    fontSize: 17,
    letterSpacing: -0.3,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionInset: { paddingHorizontal: SIDE_MARGIN },

  recent: { marginTop: 12 },
  recentRow: { paddingHorizontal: SIDE_MARGIN, gap: 12 },
  recentTile: { width: RECENT_TILE },
  recentArt: { width: RECENT_TILE, height: RECENT_TILE, borderRadius: 12 },
  recentTitle: { fontSize: 13.5, fontWeight: '600', marginTop: 8, letterSpacing: -0.1 },
  recentSub: { fontSize: 12, marginTop: 1 },

  roomStack: { gap: 10, paddingHorizontal: 16 },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  browseText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  liveCard: { borderRadius: 22, padding: 14, gap: 14, borderWidth: StyleSheet.hairlineWidth },
  liveTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  continueBtn: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  continueText: { fontSize: 15, fontWeight: '700' },
  yourMusic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  yourArt: { width: 46, height: 46, borderRadius: 12 },
  yourLabel: { fontSize: 11.5, fontWeight: '600' },
  yourTitle: { fontSize: 14.5, fontWeight: '700' },
  yourPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomThumb: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomThumbImg: { width: '100%', height: '100%', borderRadius: 12 },
  roomText: { flex: 1, minWidth: 0 },
  roomTitle: { fontFamily: fonts.display, fontSize: 18, letterSpacing: -0.3 },
  roomSub: { fontSize: 13, marginTop: 2, opacity: 0.85 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 12, fontWeight: '700' },

  stage: { paddingHorizontal: SIDE_MARGIN, paddingTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 4 },
  metaText: { flex: 1, minWidth: 0 },
  stagePlay: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.4 },
  sub: { fontSize: 13.5, marginTop: 2 },
  skeletonTitle: { marginTop: 14, marginBottom: 8 },
  skeletonRows: { paddingTop: 18 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  skeletonLines: { flex: 1, gap: 7 },

  empty: { alignItems: 'center', gap: 14, paddingTop: 96, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retry: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '600' },
});

export default memo(HomeScreen);
