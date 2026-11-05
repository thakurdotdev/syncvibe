import { QuickPicks, TrendingChart } from '@/components/music/home/HomeSections';
import {
  AlbumsGrid,
  ArtistGrid,
  PlaylistsGrid,
  RecommendationGrid,
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
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Colors = ReturnType<typeof useTheme>['colors'];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const goRooms = () => router.navigate('/(tabs)/group-music');

/** Start-a-room invitation when you're not in a room: one quiet row, a single accent. */
const StartRoomCard = memo(function StartRoomCard({ colors }: { colors: Colors }) {
  return (
    <PressableScale
      onPress={goRooms}
      scaleTo={0.98}
      accessibilityRole='button'
      accessibilityLabel='Listen together. Start a room'
      style={[styles.startCard, { backgroundColor: colors.card }]}
    >
      <View style={[styles.roomIcon, { backgroundColor: colors.raised }]}>
        <Ionicons name='people' size={20} color={colors.foreground} />
      </View>
      <View style={styles.roomText}>
        <Text style={[styles.startTitle, { color: colors.foreground }]}>Listen together</Text>
        <Text style={[styles.roomSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          Start a room and play in sync with friends
        </Text>
      </View>
      <View style={[styles.startGo, { backgroundColor: colors.primary }]}>
        <Ionicons name='arrow-forward' size={16} color={colors.primaryForeground} />
      </View>
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
          scaleTo={0.86}
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

const RoomSection = memo(function RoomSection({ colors }: { colors: Colors }) {
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  if (!inRoom) return <StartRoomCard colors={colors} />;
  return (
    <View style={styles.roomStack}>
      <LiveRoomCard colors={colors} />
      <YourMusicCard colors={colors} />
    </View>
  );
});

function HomeSkeleton({ colors }: { colors: Colors }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.set(withRepeat(withTiming(0.9, { duration: 700 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const block = (w: number | `${number}%`, h: number, r = 12) => ({
    width: w,
    height: h,
    borderRadius: r,
    backgroundColor: colors.muted,
  });

  return (
    <Animated.View style={[styles.skeleton, pulse]}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ marginBottom: 28 }}>
          <View style={[block('40%', 18, 8), { marginBottom: 12 }]} />
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={block(144, 144, 14)} />
            ))}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

function HomeScreen() {
  const { user } = useUser();
  const { colors } = useTheme();

  const {
    data: homePageData,
    isLoading: loadingHome,
    refetch: refetchHome,
    isRefetching: isRefetchingHome,
  } = useHomePageMusic();
  const {
    data: recommendations,
    refetch: refetchRecent,
    isRefetching: isRefetchingRecent,
  } = useRecentMusic();

  const onRefresh = useCallback(() => {
    const requests: Promise<unknown>[] = [refetchHome()];
    if (user?.userid) requests.push(refetchRecent());
    return Promise.allSettled(requests).then(() => undefined);
  }, [user?.userid, refetchHome, refetchRecent]);

  const trendingSongs = useMemo(
    () => homePageData?.trending?.data?.filter((i) => i?.type === 'song') ?? [],
    [homePageData?.trending]
  );

  const firstName = user?.name?.split(' ')[0];

  return (
    <TabSafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <TabHeader
        kicker={greeting()}
        title={firstName || 'Welcome'}
        avatar='leading'
        prominentSearch
      />

      <ScrollView
        style={styles.root}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: DECK_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingHome || isRefetchingRecent}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.hero}>
          <RoomSection colors={colors} />
        </View>

        {loadingHome ? (
          <HomeSkeleton colors={colors} />
        ) : (
          <View>
            <QuickPicks songs={recommendations?.recentlyPlayed ?? []} />

            {(recommendations?.songs ?? []).length > 0 && (
              <RecommendationGrid recommendations={recommendations!.songs} title='Made for you' />
            )}

            {trendingSongs.length > 0 && (
              <TrendingChart songs={trendingSongs} title='Trending now' />
            )}

            {(homePageData?.playlists?.data?.length ?? 0) > 0 && (
              <PlaylistsGrid playlists={homePageData!.playlists.data} title='Popular playlists' />
            )}

            {(homePageData?.charts?.data?.length ?? 0) > 0 && (
              <PlaylistsGrid playlists={homePageData!.charts.data} title='Charts' />
            )}

            {(homePageData?.albums?.data?.length ?? 0) > 0 && (
              <AlbumsGrid albums={homePageData!.albums.data} title='New albums' />
            )}

            {(homePageData?.artist_recos?.data?.length ?? 0) > 0 && (
              <ArtistGrid artists={homePageData!.artist_recos.data} title='Artists to know' />
            )}
          </View>
        )}
      </ScrollView>
    </TabSafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },

  roomStack: { gap: 10 },
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 12,
    borderRadius: 18,
  },
  startTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, letterSpacing: -0.2 },
  startGo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
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
});

export default memo(HomeScreen);
