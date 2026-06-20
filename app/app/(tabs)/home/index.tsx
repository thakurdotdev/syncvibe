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
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const HEADER_HEIGHT = 360;

export default function HomeScreen() {
  const { selectedLanguages, user } = useUser();
  const { colors, theme } = useTheme();
  const scrollViewRef = useRef(null);

  // Animation values
  const scrollY = useSharedValue(0);
  const searchBarTranslateY = useSharedValue(-12);
  const headerScale = useSharedValue(1);

  // Tracks whether the header blur/gradient is still in view, so we can
  // unmount the BlurView once it's fully scrolled past — blur is one of
  // the more expensive things to keep compositing on a phone GPU.
  const [headerVisible, setHeaderVisible] = useState(true);

  const { data: homePageData, isLoading: loading, error } = useHomePageMusic();
  const { data: recommendations, refetch, isLoading } = useRecentMusic();

  // Entrance animation for the search bar — was previously a translateY
  // snap with no easing context; this now matches the header's timing
  // so both pieces of chrome settle in together instead of separately.
  useEffect(() => {
    searchBarTranslateY.value = withTiming(0, { duration: 500 });
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
      headerScale.value = interpolate(y, [0, HEADER_HEIGHT], [1, 0.95], Extrapolation.CLAMP);
    },
  });

  // Mount/unmount the BlurView outside the worklet thread — reading
  // scrollY here would be a no-op since this isn't a derived value, so
  // we drive it from the same onScroll callback via runOnJS-free state
  // is avoided; instead we just gate on a coarse threshold using the
  // scroll handler's JS-thread sibling below.
  const handleHeaderVisibility = useCallback((y: number) => {
    const shouldShow = y < HEADER_HEIGHT;
    setHeaderVisible((prev) => (prev === shouldShow ? prev : shouldShow));
  }, []);

  const headerOpacity = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        scrollY.value,
        [0, HEADER_HEIGHT * 0.6, HEADER_HEIGHT],
        [1, 0.5, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        { scale: headerScale.value },
        {
          translateY: interpolate(scrollY.value, [0, HEADER_HEIGHT], [0, -30], Extrapolation.CLAMP),
        },
      ],
    };
  });

  // Search bar now eases symmetrically around the rest position and
  // settles into a steady 1 instead of drifting to 0.9 — a search bar
  // that never returns to full opacity reads as a rendering bug on
  // first glance.
  const searchBarStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: searchBarTranslateY.value },
        { scale: interpolate(scrollY.value, [-40, 0, 120], [1.04, 1, 0.97], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(scrollY.value, [-40, 0, 160], [1, 1, 0.85], Extrapolation.CLAMP),
    };
  });

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.userid) {
      refetch();
    }
  }, [user?.userid, refetch]);

  const trendingSongs = useMemo(() => {
    return homePageData?.trending?.data?.filter((item) => item?.type === 'song') || [];
  }, [homePageData?.trending]);

  // Header gradient comes from the active palette's dedicated `header`
  // token — a calibrated wash of primary, distinct from both the loud
  // full-strength `primary` gradient and the near-invisible `background`
  // gradient (which is meant for flat page depth, not a hero header).
  const headerGradientColors = useMemo(() => {
    return colors.gradients.header as readonly [string, string, ...string[]];
  }, [colors.gradients.header]);

  const blurIntensity = theme === 'light' ? 20 : 25;
  const blurTint = theme === 'light' ? 'light' : 'dark';

  // Search bar fill: a translucent layer over the card color rather
  // than a hardcoded white/black mix, so it sits correctly on any
  // future palette without manual per-theme classes.
  const searchBarBackground = theme === 'light' ? `${colors.card}E6` : `${colors.cardForeground}1A`;
  const searchPlaceholderColor = colors.mutedForeground;
  const searchIconColor = colors.mutedForeground;

  return (
    <View className='flex-1' style={{ backgroundColor: colors.background }}>
      <StatusBar
        barStyle={theme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor='transparent'
        translucent
      />

      <SafeAreaView className='flex-1'>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: HEADER_HEIGHT,
              zIndex: 0,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
              overflow: 'hidden',
            },
            headerOpacity,
          ]}
        >
          <LinearGradient
            colors={headerGradientColors}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.8, y: 0.85 }}
            style={{ height: '100%', width: '100%' }}
          />
          {headerVisible && (
            <BlurView
              intensity={blurIntensity}
              tint={blurTint}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
            />
          )}
        </Animated.View>

        <View className='z-10 pb-3'>
          <Animated.View className='px-4 pt-2' style={searchBarStyle}>
            <TouchableOpacity
              style={{
                backgroundColor: searchBarBackground,
                borderWidth: theme === 'light' ? 0.5 : 0,
                borderColor: colors.border,
              }}
              className='flex-row items-center rounded-full px-4 h-11'
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/search');
              }}
              accessible={true}
              accessibilityRole='button'
              accessibilityLabel='Search for songs'
            >
              <Ionicons name='search' size={20} color={searchIconColor} />
              <Text
                style={{ color: searchPlaceholderColor }}
                className='flex-1 h-11 px-3 flex justify-center py-3'
                numberOfLines={1}
              >
                Search for songs...
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {loading ? (
          <HomeSkeleton colors={colors} />
        ) : (
          <Animated.ScrollView
            ref={scrollViewRef}
            className='flex-1'
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            onMomentumScrollEnd={(e) => handleHeaderVisibility(e.nativeEvent.contentOffset.y)}
            onScrollEndDrag={(e) => handleHeaderVisibility(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: 20, paddingTop: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            <View className='px-2 pb-10'>
              {typeof error === 'string' ? (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  style={{ backgroundColor: colors.muted }}
                  className='py-5 my-2 rounded-2xl items-center px-4'
                >
                  <Ionicons name='cloud-offline-outline' size={28} color={colors.mutedForeground} />
                  <Text style={{ color: colors.foreground }} className='text-center mt-2'>
                    {error}
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.accent }}
                    className='mt-3 px-4 py-2 rounded-full'
                    onPress={onRefresh}
                    accessibilityRole='button'
                    accessibilityLabel='Try again'
                  >
                    <Text style={{ color: colors.accentForeground, fontWeight: '500' }}>
                      Try again
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}

              {(recommendations?.recentlyPlayed ?? []).length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(0)}>
                  <RecommendationGrid
                    recommendations={recommendations?.recentlyPlayed ?? []}
                    title='Recently Played'
                    showMore={true}
                  />
                </Animated.View>
              )}

              {(recommendations?.songs || []).length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(60)}>
                  <RecommendationGrid
                    recommendations={recommendations?.songs ?? []}
                    title='Your Favorite'
                    showMore={true}
                  />
                </Animated.View>
              )}

              {trendingSongs.length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(120)}>
                  <TrendingSongs songs={trendingSongs} title='Trending Now' />
                </Animated.View>
              )}

              {homePageData?.playlists && homePageData.playlists.data.length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(180)}>
                  <PlaylistsGrid
                    playlists={homePageData.playlists.data}
                    title='Popular Playlists'
                  />
                </Animated.View>
              )}

              {homePageData?.charts && homePageData.charts.data.length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(240)}>
                  <PlaylistsGrid playlists={homePageData.charts.data} title='Top Charts' />
                </Animated.View>
              )}

              {homePageData?.albums && homePageData.albums.data.length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(300)}>
                  <AlbumsGrid albums={homePageData.albums.data} title='New Albums' />
                </Animated.View>
              )}

              {homePageData?.artist_recos && homePageData.artist_recos.data.length > 0 && (
                <Animated.View entering={FadeInDown.duration(400).delay(360)}>
                  <ArtistGrid
                    artists={homePageData.artist_recos.data}
                    title="Artists You'll Love"
                  />
                </Animated.View>
              )}
            </View>
          </Animated.ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// Lightweight themed skeleton — replaces the bare centered spinner.
// A blank screen with a spinner reads as "stuck"; shaped placeholder
// blocks that match the real layout read as "loading," which is a
// meaningfully different feeling on first paint and on every cold start.
function HomeSkeleton({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withTiming(1, { duration: 900 });
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0.5, 1], [0.4, 0.8]),
  }));

  const Block = ({ w, h, style }: { w: number | `${number}%`; h: number; style?: object }) => (
    <Animated.View
      style={[{ width: w, height: h, backgroundColor: colors.muted, borderRadius: 12 }, pulseStyle, style]}
    />
  );

  return (
    <View className='flex-1 px-4 pt-6'>
      <View className='flex-row mb-6'>
        {[0, 1, 2].map((i) => (
          <Block key={i} w={104} h={104} style={{ marginRight: 12, borderRadius: 14 }} />
        ))}
      </View>
      <Block w='40%' h={16} style={{ marginBottom: 14 }} />
      <View className='flex-row mb-8'>
        {[0, 1, 2, 3].map((i) => (
          <Block key={i} w={88} h={88} style={{ marginRight: 10, borderRadius: 10 }} />
        ))}
      </View>
      <Block w='55%' h={16} style={{ marginBottom: 14 }} />
      <View className='flex-row'>
        {[0, 1, 2].map((i) => (
          <Block key={i} w={120} h={140} style={{ marginRight: 12, borderRadius: 14 }} />
        ))}
      </View>
    </View>
  );
}