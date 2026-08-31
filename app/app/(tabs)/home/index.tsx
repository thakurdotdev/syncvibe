import {
  AlbumsGrid,
  ArtistGrid,
  PlaylistsGrid,
  RecommendationGrid,
  TrendingSongs,
} from '@/components/music/MusicLists';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useHomePageMusic, useRecentMusic } from '@/queries/useMusic';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';

const SearchBar = memo(function SearchBar({
  colors,
  theme,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  theme: string;
}) {
  const bg = theme === 'light' ? `${colors.card}F0` : `${colors.muted}CC`;

  const handlePress = useCallback(() => {
    router.navigate('/search');
  }, []);

  return (
    <Pressable
      onPress={handlePress}
      style={{
        backgroundColor: bg,
        borderWidth: theme === 'light' ? 0.5 : 0,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 100,
        paddingHorizontal: 16,
        height: 44,
        marginHorizontal: 16,
        marginBottom: 4,
      }}
      accessible
      accessibilityRole='button'
      accessibilityLabel='Search for songs'
    >
      <Ionicons name='search' size={18} color={colors.mutedForeground} />
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 15,
          marginLeft: 10,
          flex: 1,
        }}
        numberOfLines={1}
      >
        Search for songs…
      </Text>
    </Pressable>
  );
});

function HomeSkeleton({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.85, { duration: 750 }), withTiming(0.45, { duration: 750 })),
      -1,
      false
    );

    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const Block = ({
    w,
    h,
    r = 12,
    mb = 0,
    mr = 0,
  }: {
    w: number | `${number}%`;
    h: number;
    r?: number;
    mb?: number;
    mr?: number;
  }) => (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          backgroundColor: colors.muted,
          borderRadius: r,
          marginBottom: mb,
          marginRight: mr,
        },
        pulseStyle,
      ]}
    />
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
      <Block w='38%' h={14} r={8} mb={12} />
      <View style={{ flexDirection: 'row', marginBottom: 24 }}>
        {[0, 1, 2].map((i) => (
          <Block key={i} w={108} h={108} r={14} mr={12} />
        ))}
      </View>
      <Block w='44%' h={14} r={8} mb={12} />
      <View style={{ flexDirection: 'row', marginBottom: 24 }}>
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} w={86} h={86} r={10} mr={10} />
        ))}
      </View>
      <Block w='52%' h={14} r={8} mb={12} />
      <View style={{ flexDirection: 'row' }}>
        {[0, 1, 2].map((i) => (
          <Block key={i} w={130} h={148} r={14} mr={12} />
        ))}
      </View>
    </View>
  );
}

const HEADER_H = 360;

function HomeScreen() {
  const { user } = useUser();
  const { colors, theme } = useTheme();
  const scrollY = useSharedValue(0);
  const scrollRef = useRef<any>(null);

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

  const headerGradient = useMemo(
    () => colors.gradients.header as unknown as readonly [string, string, ...string[]],
    [colors.gradients.header]
  );

  const onRefresh = useCallback(() => {
    const requests: Promise<unknown>[] = [refetchHome()];
    if (user?.userid) requests.push(refetchRecent());
    return Promise.allSettled(requests).then(() => undefined);
  }, [user?.userid, refetchHome, refetchRecent]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_H * 0.5, HEADER_H],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, HEADER_H],
          [0, -HEADER_H * 0.2],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Search bar barely moves — stays readable at all times
  const searchStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 100], [1, 0.88], Extrapolation.CLAMP),
  }));

  const trendingSongs = useMemo(
    () => homePageData?.trending?.data?.filter((i) => i?.type === 'song') ?? [],
    [homePageData?.trending]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabSafeAreaView style={{ flex: 1 }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: HEADER_H,
              zIndex: 0,
              borderBottomLeftRadius: 28,
              borderBottomRightRadius: 28,
              overflow: 'hidden',
            },
            headerStyle,
          ]}
          pointerEvents='none'
        >
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <Animated.View style={[{ zIndex: 10, paddingTop: 6, paddingBottom: 6 }, searchStyle]}>
          <SearchBar colors={colors} theme={theme} />
        </Animated.View>

        {loadingHome ? (
          <HomeSkeleton colors={colors} />
        ) : (
          <Animated.ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 130, paddingTop: 12 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetchingHome || isRefetchingRecent}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            <View style={{ paddingBottom: 16 }}>
              {/* Sections — rendered directly, no FadeInDown delays */}
              {(recommendations?.recentlyPlayed ?? []).length > 0 && (
                <RecommendationGrid
                  recommendations={recommendations!.recentlyPlayed}
                  title='Recently Played'
                  showMore
                />
              )}

              {(recommendations?.songs ?? []).length > 0 && (
                <RecommendationGrid
                  recommendations={recommendations!.songs}
                  title='Your Favourite'
                  showMore
                />
              )}

              {trendingSongs.length > 0 && (
                <TrendingSongs songs={trendingSongs} title='Trending Now' />
              )}

              {(homePageData?.playlists?.data?.length ?? 0) > 0 && (
                <PlaylistsGrid playlists={homePageData!.playlists.data} title='Popular Playlists' />
              )}

              {(homePageData?.charts?.data?.length ?? 0) > 0 && (
                <PlaylistsGrid playlists={homePageData!.charts.data} title='Top Charts' />
              )}

              {(homePageData?.albums?.data?.length ?? 0) > 0 && (
                <AlbumsGrid albums={homePageData!.albums.data} title='New Albums' />
              )}

              {(homePageData?.artist_recos?.data?.length ?? 0) > 0 && (
                <ArtistGrid artists={homePageData!.artist_recos.data} title="Artists You'll Love" />
              )}
            </View>
          </Animated.ScrollView>
        )}
      </TabSafeAreaView>
    </View>
  );
}

export default memo(HomeScreen);
