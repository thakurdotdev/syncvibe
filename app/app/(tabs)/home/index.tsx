import type { Shelf } from '@/api/personal';
import {
  ContinueRow,
  HomeFeedSkeleton,
  MixRow,
  NewReleasesRow,
  PickList,
  RightNowCard,
  SIDE,
  StationChips,
} from '@/components/music/home/HomeFeed';
import { FriendsStrip } from '@/components/music/home/PersonalHome';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { Aura } from '@/components/shell/Aura';
import { TabHeader, useTopBarScroll } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { buildStations, uniqueSongs, type Station } from '@/lib/stations';
import { useHomePageMusic, useRecentMusic } from '@/queries/useMusic';
import { useLanguageSync, useMoods, useShelves } from '@/queries/usePersonal';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { useIsRestoring } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

/** Songs under "Picked for you": enough to choose from, short enough to see the page below. */
const PICKS = 5;
const SKELETON_DELAY_MS = 200;

const goBrowse = () => router.push('/browse');

/** New for you and your own recent songs in turn, then what's trending, each song once. */
const buildPool = (fresh: Song[], recent: Song[], trending: Song[]) => {
  const mixed: Song[] = [];
  for (let i = 0; i < Math.max(fresh.length, recent.length); i++) {
    if (fresh[i]) mixed.push(fresh[i]);
    if (recent[i]) mixed.push(recent[i]);
  }
  return uniqueSongs([...mixed, ...trending]);
};

/** For you first, then moods, then what the catalogue is featuring. Your shelves have their own places. */
const chipStations = (stations: Station[]) => {
  const rank = (s: Station) => (s.key === 'for-you' ? 0 : s.key.startsWith('mood-') ? 1 : 2);
  return stations.filter((s) => !s.key.startsWith('shelf-')).sort((a, b) => rank(a) - rank(b));
};

const BrowseRow = memo(function BrowseRow() {
  const { colors } = useTheme();
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

/**
 * Home: everything worth playing, each a tap away. Stations as chips, the mix for this time of
 * day, the album you left halfway, your mixes, songs picked for you (with why), and what's new
 * from your artists. A room you're in shows in the bottom bar's orb, not here.
 */
function HomeScreen() {
  const { user, restored } = useUser();
  const { colors } = useTheme();
  const signedIn = Boolean(user?.userid);

  const { data: homePageData, isLoading, isError, refetch: refetchHome } = useHomePageMusic();
  const { data: recommendations, refetch: refetchRecent } = useRecentMusic();
  useLanguageSync();
  const { data: shelves = EMPTY_SHELVES, refetch: refetchShelves } = useShelves();
  const { data: moods } = useMoods();

  // Saved data (or your saved languages) is still being read from storage, which is too quick
  // to show anything for.
  const isRestoring = useIsRestoring();
  const waiting = isLoading || isRestoring || !restored;

  // Only when you pull: data also refreshes by itself in the background, and a spinner appearing
  // for that, with nothing touched, reads as something going wrong.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const requests: Promise<unknown>[] = [refetchHome()];
    if (signedIn) requests.push(refetchRecent(), refetchShelves());
    await Promise.allSettled(requests);
    setRefreshing(false);
  }, [signedIn, refetchHome, refetchRecent, refetchShelves]);

  // A fast load goes straight to the music, with no skeleton flashing up in between.
  const [skeletonShown, setSkeletonShown] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSkeletonShown(true), SKELETON_DELAY_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const trending = useMemo(
    () => uniqueSongs(homePageData?.trending?.data?.filter((i) => i?.type === 'song') ?? []),
    [homePageData?.trending]
  );
  const forYou = useMemo(
    () => buildPool(recommendations?.songs ?? [], recommendations?.recentlyPlayed ?? [], trending),
    [recommendations, trending]
  );
  const stations = useMemo(
    () => chipStations(buildStations(homePageData, forYou, { moods })),
    [homePageData, forYou, moods]
  );

  // Your shelves, each to its place on the page.
  const { hero, continueAlbum, mixes, releases } = useMemo(() => {
    const usable = shelves.filter((s) => s.songs?.length);
    const time = usable.find((s) => s.key.startsWith('time-'));
    const mixShelves = usable.filter((s) => s.key.startsWith('mix-'));
    const heroShelf = time ?? mixShelves[0];
    return {
      hero: heroShelf,
      continueAlbum: usable.find((s) => s.key === 'continue-album'),
      mixes: usable.filter(
        (s) =>
          s !== heroShelf &&
          (s.key.startsWith('mix-') || s.key === 'rediscover' || s.key === 'liked')
      ),
      releases: usable.find((s) => s.key === 'new-releases'),
    };
  }, [shelves]);

  const picks = useMemo(
    () => uniqueSongs(recommendations?.songs ?? []).slice(0, PICKS),
    [recommendations?.songs]
  );
  const popular = useMemo(() => trending.slice(0, PICKS), [trending]);

  const nothing = !stations.length && !forYou.length && !shelves.length;
  const { scrollY, onScroll, listRef } = useTopBarScroll();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Aura scrollY={scrollY} />
      <TabSafeAreaView edges={['top']} style={styles.root}>
        <TabHeader title='Home' />

        <Animated.ScrollView
          ref={listRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
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
          {waiting ? (
            skeletonShown && <HomeFeedSkeleton />
          ) : nothing ? (
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
            <>
              <StationChips stations={stations} />
              {hero ? (
                <RightNowCard title={hero.title} subtitle={hero.subtitle} songs={hero.songs} />
              ) : (
                <RightNowCard
                  title='For you'
                  subtitle={
                    signedIn
                      ? 'New for you, and songs you keep coming back to'
                      : 'Popular right now'
                  }
                  songs={forYou}
                />
              )}
              {continueAlbum && <ContinueRow shelf={continueAlbum} />}
              <MixRow shelves={mixes} />
              {picks.length ? (
                <PickList title='Picked for you' songs={picks} reasons={recommendations?.reasons} />
              ) : (
                <PickList title='Popular right now' songs={popular} />
              )}
              <NewReleasesRow shelf={releases} />
              {signedIn ? <FriendsStrip /> : null}
              <BrowseRow />
            </>
          )}
        </Animated.ScrollView>
      </TabSafeAreaView>
    </View>
  );
}

const EMPTY_SHELVES: Shelf[] = [];

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: DECK_CLEARANCE },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: SIDE,
    marginTop: 22,
  },
  browseText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  empty: { alignItems: 'center', gap: 14, paddingTop: 96, paddingHorizontal: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retry: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '600' },
});

export default memo(HomeScreen);
