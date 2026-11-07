import { BUTTON_PRESS_SCALE, EASE_OUT, ROW_PRESS_SCALE } from '@/lib/motion';
import { QuickPicks, TrendingChart } from '@/components/music/home/HomeSections';
import {
  AlbumsGrid,
  PlaylistsGrid,
  RecommendationGrid,
  SECTION_GAP,
} from '@/components/music/MusicLists';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { TabHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useHomePageMusic, useRecentMusic } from '@/queries/useMusic';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { fonts } from '@/theme/typography';
import { usePlaybackState, usePlayerControls } from '@/stores/playerStore';
import { Ionicons } from '@expo/vector-icons';
import { useIsRestoring } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

type Colors = ReturnType<typeof useTheme>['colors'];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/** The first screenful renders straight away; the rest follow a section at a time. */
const FIRST_SECTIONS = 3;
const NEXT_SECTION_MS = 80;
const SKELETON_DELAY_MS = 200;
const CONTENT_ENTER = FadeIn.duration(180).easing(EASE_OUT);

const goRooms = () => router.navigate('/(tabs)/group-music');

const goBrowse = () => router.push('/browse');

/** Home stays short; everything else the service offers is one tap away. */
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
    <View style={[styles.liveCard, { backgroundColor: colors.card }]}>
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
    <View style={[styles.yourMusic, { backgroundColor: colors.card }]}>
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

/** Stand-ins shaped like the real first screen, so nothing jumps when the content arrives. */
function HomeSkeleton({ colors }: { colors: Colors }) {
  const block = (w: number | `${number}%`, h: number, r = 10) => ({
    width: w,
    height: h,
    borderRadius: r,
    backgroundColor: colors.muted,
  });

  return (
    <View style={styles.skeleton}>
      <View style={[block('36%', 16, 6), styles.skeletonTitle]} />
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <View style={block(48, 48, 6)} />
          <View style={styles.skeletonLines}>
            <View style={block('60%', 13, 5)} />
            <View style={block('38%', 11, 5)} />
          </View>
        </View>
      ))}
      <View style={[block('36%', 16, 6), styles.skeletonTitle, styles.skeletonGap]} />
      <View style={styles.skeletonCovers}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={block(140, 140, 8)} />
        ))}
      </View>
    </View>
  );
}

function HomeScreen() {
  const { user } = useUser();
  const { colors } = useTheme();

  const { data: homePageData, isLoading, refetch: refetchHome } = useHomePageMusic();
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

  const trendingSongs = useMemo(
    () => homePageData?.trending?.data?.filter((i) => i?.type === 'song') ?? [],
    [homePageData?.trending]
  );

  const sections = useMemo(() => {
    const out: { key: string; node: ReactNode }[] = [
      { key: 'picks', node: <QuickPicks songs={recommendations?.recentlyPlayed ?? []} /> },
      {
        key: 'made',
        node: (
          <RecommendationGrid recommendations={recommendations?.songs ?? []} title='Made for you' />
        ),
      },
      { key: 'trending', node: <TrendingChart songs={trendingSongs} title='Trending now' /> },
      {
        key: 'albums',
        node: <AlbumsGrid albums={homePageData?.albums?.data ?? []} title='New albums' />,
      },
      {
        key: 'playlists',
        node: (
          <PlaylistsGrid
            playlists={homePageData?.playlists?.data ?? []}
            title='Popular playlists'
          />
        ),
      },
      { key: 'browse', node: <BrowseRow colors={colors} /> },
    ];
    return out;
  }, [colors, homePageData, recommendations, trendingSongs]);

  // Mounting every section at once is what made Home slow to appear. Mounting yields to touches.
  const [shownSections, setShownSections] = useState(FIRST_SECTIONS);
  useEffect(() => {
    if (waiting || shownSections >= sections.length) return;
    const timer = setTimeout(() => {
      startTransition(() => setShownSections((n) => n + 1));
    }, NEXT_SECTION_MS);
    return () => clearTimeout(timer);
  }, [waiting, sections.length, shownSections]);

  return (
    <TabSafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <TabHeader title={greeting()} />

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
        <LiveRoomSection colors={colors} />

        {waiting ? (
          skeletonShown && <HomeSkeleton colors={colors} />
        ) : (
          // The screen's one piece of motion nobody asked for, and only if a skeleton was showing.
          <Animated.View entering={skeletonShown ? CONTENT_ENTER : undefined}>
            {sections.slice(0, shownSections).map(({ key, node }) => (
              <View key={key}>{node}</View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </TabSafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: DECK_CLEARANCE },

  roomStack: { gap: 10, paddingHorizontal: 16, marginBottom: SECTION_GAP },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 16,
    marginBottom: SECTION_GAP,
  },
  browseText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  liveCard: { borderRadius: 22, padding: 14, gap: 14 },
  liveTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  continueBtn: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  continueText: { fontSize: 15, fontWeight: '700' },
  yourMusic: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18 },
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

  skeleton: { paddingHorizontal: 16 },
  skeletonTitle: { marginBottom: 14 },
  skeletonGap: { marginTop: SECTION_GAP },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  skeletonLines: { flex: 1, gap: 7 },
  skeletonCovers: { flexDirection: 'row', gap: 12 },
});

export default memo(HomeScreen);
