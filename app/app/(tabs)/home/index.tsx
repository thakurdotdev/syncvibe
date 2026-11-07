import { HomeHero, songCoverUrl, SongRow } from '@/components/music/home/HomeSections';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { HomeHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, ROW_PRESS_SCALE } from '@/lib/motion';
import { useHomePageMusic, useRecentMusic } from '@/queries/useMusic';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlaybackState, usePlayerControls, usePlayerStore } from '@/stores/playerStore';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { useIsRestoring } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

type Colors = ReturnType<typeof useTheme>['colors'];

/** Short on purpose: the page ends, and everything else is in Browse. */
const LIST_SIZE = 10;
const SKELETON_DELAY_MS = 200;
const CONTENT_ENTER = FadeIn.duration(180).easing(EASE_OUT);

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

/** Stand-ins shaped like the real screen, so nothing jumps when the content arrives. Still. */
function HomeSkeleton({ colors }: { colors: Colors }) {
  const block = (w: number | `${number}%`, h: number, r = 6) => ({
    width: w,
    height: h,
    borderRadius: r,
    backgroundColor: colors.muted,
  });

  return (
    <View style={styles.skeleton}>
      <View style={[block('100%', 0, 10), styles.skeletonCover]} />
      <View style={[block('60%', 24), styles.skeletonTitle]} />
      <View style={block('38%', 13)} />
      <View style={styles.list}>
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

function HomeScreen() {
  const { user } = useUser();
  const { colors } = useTheme();
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentId = currentSong?.id;

  const { data: homePageData, isLoading, isError, refetch: refetchHome } = useHomePageMusic();
  const { data: recommendations, refetch: refetchRecent } = useRecentMusic();

  // Saved data is still being read from storage, which is too quick to show anything for.
  const isRestoring = useIsRestoring();
  const waiting = isLoading || isRestoring;

  // Only when you pull: data also refreshes by itself in the background, and a spinner appearing
  // for that, with nothing touched, reads as something going wrong.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshes, setRefreshes] = useState(0);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const requests: Promise<unknown>[] = [refetchHome()];
    if (user?.userid) requests.push(refetchRecent());
    await Promise.allSettled(requests);
    setRefreshing(false);
    setRefreshes((n) => n + 1);
  }, [user?.userid, refetchHome, refetchRecent]);

  // A fast load goes straight to the music, with no skeleton flashing up in between.
  const [skeletonShown, setSkeletonShown] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSkeletonShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const pool = useMemo(
    () =>
      buildPool(
        recommendations?.songs ?? [],
        recommendations?.recentlyPlayed ?? [],
        homePageData?.trending?.data?.filter((i) => i?.type === 'song') ?? []
      ),
    [homePageData?.trending, recommendations]
  );
  const hasPool = pool.length > 0;

  // The song restored from last time is there to resume until you play something. After that the
  // cover stays on what's next, or pausing would make it jump back.
  const [startedPlaying, setStartedPlaying] = useState(false);
  if (isPlaying && !startedPlaying) setStartedPlaying(true);
  const resumeSong = !startedPlaying ? currentSong : null;

  // Changes when the song does or you pull to refresh, not whenever data updates in the background:
  // a cover swapping while you're looking at it, for no reason you can see, feels broken.
  const nextPick = useMemo(
    () => pool.find((song) => song.id !== currentId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentId, hasPool, refreshes]
  );
  const hero = resumeSong ?? nextPick;
  const heroId = hero?.id;

  const rows = useMemo(
    () => pool.filter((song) => song.id !== heroId).slice(0, LIST_SIZE),
    [heroId, pool]
  );

  // So the next cover is already there when this one is played.
  const upcomingCover = useMemo(() => {
    const upcoming = pool.find((song) => song.id !== heroId && song.id !== currentId);
    return upcoming ? songCoverUrl(upcoming) : undefined;
  }, [currentId, heroId, pool]);
  useEffect(() => {
    if (upcomingCover) Image.prefetch(upcomingCover).catch(() => {});
  }, [upcomingCover]);

  return (
    <TabSafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <HomeHeader />

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
          skeletonShown && !inRoom && <HomeSkeleton colors={colors} />
        ) : !hasPool ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isError ? "Couldn't load music. Check your connection." : 'Nothing to play yet.'}
            </Text>
            <PressableScale
              onPress={onRefresh}
              accessibilityRole='button'
              style={[styles.retry, { backgroundColor: colors.raised }]}
            >
              <Text style={[styles.retryText, { color: colors.foreground }]}>Try again</Text>
            </PressableScale>
          </View>
        ) : (
          <Animated.View entering={skeletonShown ? CONTENT_ENTER : undefined}>
            {hero && !inRoom ? <HomeHero song={hero} /> : null}
            <View style={styles.list}>
              {rows.map((song) => (
                <SongRow key={song.id} song={song} />
              ))}
            </View>
            <BrowseRow colors={colors} />
          </Animated.View>
        )}
      </ScrollView>
    </TabSafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: DECK_CLEARANCE },
  list: { paddingHorizontal: 16, paddingTop: 18 },

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
  skeletonCover: { height: undefined, aspectRatio: 1, marginBottom: 14 },
  skeletonTitle: { marginBottom: 8 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  skeletonLines: { flex: 1, gap: 7 },

  empty: { alignItems: 'center', gap: 14, paddingTop: 96, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retry: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '600' },
});

export default memo(HomeScreen);
