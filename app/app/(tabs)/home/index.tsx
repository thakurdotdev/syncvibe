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
 * The room tile is the most important thing on Home: it's what SyncVibe is for. In a room it
 * becomes a live "back to the room" card tinted by the artwork; otherwise it invites you to
 * start one.
 */
const RoomTile = memo(function RoomTile({ colors }: { colors: Colors }) {
  const group = useGroupSessionStore((s) => s.currentGroup);
  const memberCount = useGroupSessionStore((s) => s.groupMembers.length);
  const art = useGroupPlaybackStore(
    (s) => s.currentSong?.image?.[2]?.link || s.currentSong?.image?.[1]?.link
  );

  return (
    <PressableScale
      onPress={goRooms}
      accessibilityRole='button'
      accessibilityLabel={group ? `Back to room ${group.name}` : 'Start a room'}
      style={[styles.roomTile, { backgroundColor: colors.foreground }]}
    >
      {group && art ? <Image source={{ uri: art }} style={styles.roomArt} blurRadius={40} /> : null}
      <View style={styles.roomBody}>
        <View style={{ flex: 1 }}>
          {group ? (
            <>
              <View style={[styles.livePill, { backgroundColor: colors.live }]}>
                <View style={[styles.liveDot, { backgroundColor: colors.liveForeground }]} />
                <Text style={[styles.livePillText, { color: colors.liveForeground }]}>
                  {memberCount} listening now
                </Text>
              </View>
              <Text style={[styles.roomTitle, { color: colors.background }]} numberOfLines={1}>
                Back to {group.name}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.roomTitle, { color: colors.background }]}>Start a room</Text>
              <Text style={[styles.roomCopy, { color: colors.background }]}>
                Invite friends and play the same song, in sync, while you chat.
              </Text>
            </>
          )}
        </View>
        <View style={[styles.roomCta, { backgroundColor: colors.primary }]}>
          <Ionicons
            name={group ? 'arrow-forward' : 'add'}
            size={22}
            color={colors.primaryForeground}
          />
        </View>
      </View>
    </PressableScale>
  );
});

const SHORTCUTS = [
  {
    key: 'history',
    label: 'History',
    icon: 'time-outline',
    go: () => router.push('/song-history'),
  },
  {
    key: 'library',
    label: 'Playlists',
    icon: 'albums-outline',
    go: () => router.navigate('/(tabs)/playlist'),
  },
  {
    key: 'languages',
    label: 'Languages',
    icon: 'language-outline',
    go: () => router.push('/music-language'),
  },
] as const;

const Shortcuts = memo(function Shortcuts({ colors }: { colors: Colors }) {
  return (
    <View style={styles.shortcuts}>
      {SHORTCUTS.map((s) => (
        <PressableScale
          key={s.key}
          onPress={s.go}
          accessibilityRole='button'
          accessibilityLabel={s.label}
          style={[styles.shortcut, { backgroundColor: colors.raised }]}
        >
          <Ionicons name={s.icon} size={18} color={colors.primary} />
          <Text style={[styles.shortcutText, { color: colors.foreground }]}>{s.label}</Text>
        </PressableScale>
      ))}
    </View>
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
      <TabHeader brand showAvatar />

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
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <RoomTile colors={colors} />
          <Shortcuts colors={colors} />
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
  hero: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, gap: 16 },
  greeting: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 38, letterSpacing: -1 },

  roomTile: { borderRadius: 24, overflow: 'hidden', minHeight: 124 },
  roomArt: { ...StyleSheet.absoluteFill, opacity: 0.45, transform: [{ scale: 1.3 }] },
  roomBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    padding: 18,
  },
  roomTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.5, marginTop: 10 },
  roomCopy: { fontSize: 14, lineHeight: 19, opacity: 0.72, marginTop: 4, maxWidth: 260 },
  roomCta: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  livePillText: { fontSize: 12, fontWeight: '700' },

  shortcuts: { flexDirection: 'row', gap: 8 },
  shortcut: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  shortcutText: { fontSize: 13.5, fontWeight: '600' },

  skeleton: { paddingHorizontal: 16 },
});

export default memo(HomeScreen);
