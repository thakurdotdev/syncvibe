import {
  AlbumsGrid,
  ArtistGrid,
  PlaylistsGrid,
  RecommendationGrid,
  TrendingSongs,
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

/**
 * The room card: what SyncVibe is for, kept compact. In a room it shows the live artwork,
 * listener count and the room name; otherwise it invites you to start one.
 */
const RoomCard = memo(function RoomCard({ colors }: { colors: Colors }) {
  const group = useGroupSessionStore((s) => s.currentGroup);
  const memberCount = useGroupSessionStore((s) => s.groupMembers.length);
  const songName = useGroupPlaybackStore((s) => s.currentSong?.name);
  const art = useGroupPlaybackStore(
    (s) => s.currentSong?.image?.[1]?.link || s.currentSong?.image?.[0]?.link
  );

  return (
    <PressableScale
      onPress={goRooms}
      accessibilityRole='button'
      accessibilityLabel={group ? `Back to room ${group.name}` : 'Start a room'}
      style={[
        styles.roomCard,
        {
          backgroundColor: group ? colors.card : colors.accent,
          borderColor: group ? `${colors.live}66` : 'transparent',
        },
      ]}
    >
      {group ? (
        <View style={[styles.roomThumb, { borderColor: colors.live }]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.roomThumbImg} fadeDuration={0} />
          ) : (
            <Ionicons name='radio' size={22} color={colors.live} />
          )}
        </View>
      ) : (
        <View style={[styles.roomIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name='people' size={22} color={colors.primaryForeground} />
        </View>
      )}

      <View style={styles.roomText}>
        {group ? (
          <>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
              <Text style={[styles.liveText, { color: colors.live }]}>{memberCount} listening</Text>
            </View>
            <Text style={[styles.roomTitle, { color: colors.foreground }]} numberOfLines={1}>
              {group.name}
            </Text>
            {songName ? (
              <Text style={[styles.roomSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {songName}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.roomTitle, { color: colors.accentForeground }]}>Start a room</Text>
            <Text style={[styles.roomSub, { color: colors.accentForeground }]} numberOfLines={2}>
              Play the same song with friends, in sync.
            </Text>
          </>
        )}
      </View>

      <Ionicons
        name='chevron-forward'
        size={20}
        color={group ? colors.mutedForeground : colors.accentForeground}
      />
    </PressableScale>
  );
});

function HomeSkeleton({ colors }: { colors: Colors }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
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
      <TabHeader kicker={greeting()} title={firstName || 'Welcome'} showAvatar />

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
          <RoomCard colors={colors} />
        </View>

        {loadingHome ? (
          <HomeSkeleton colors={colors} />
        ) : (
          <View>
            {(recommendations?.recentlyPlayed ?? []).length > 0 && (
              <RecommendationGrid
                recommendations={recommendations!.recentlyPlayed}
                title='Recently played'
                showMore
              />
            )}

            {(recommendations?.songs ?? []).length > 0 && (
              <RecommendationGrid recommendations={recommendations!.songs} title='Made for you' />
            )}

            {trendingSongs.length > 0 && (
              <TrendingSongs songs={trendingSongs} title='Trending now' />
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
  hero: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },

  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    paddingRight: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  roomIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
