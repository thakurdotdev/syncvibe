import { usePlayerStore, usePlaybackState, usePlaylistState, usePlayerControls } from '@/stores/playerStore';
import { useSongRecommendationsQuery } from '@/queries/useMusic';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../ui/button';
import { ProgressBar, SongControls } from './MusicCards';
import { MusicQueue } from './MusicLists';
import NewPlayerDrawer from './NewPlayerDrawer';
import { Song } from '@/types/song';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height } = Dimensions.get('window');
const ANIMATION_DURATION = 350;
const SWIPE_THRESHOLD = 120;

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 250,
  mass: 0.8,
};

const TABS = ['player', 'queue'] as const;
type TabType = (typeof TABS)[number];

const PlayerTab = React.memo(
  ({ currentSong, artistName }: { currentSong: Song | null; artistName: string }) => {
    const { colors } = useTheme();
    const { playlist } = usePlaylistState();
    const { handleNextSong } = usePlayerControls();
    const insets = useSafeAreaInsets();

    const currentIndex = playlist.findIndex((song) => song.id === currentSong?.id);
    const nextSong = currentIndex !== -1 && currentIndex < playlist.length - 1 ? playlist[currentIndex + 1] : null;

    return (
      <View style={playerTabStyles.container}>
        <View style={playerTabStyles.mainContent}>
          <View style={playerTabStyles.artworkWrapper}>
            <View
              style={[
                playerTabStyles.artworkShadow,
                {
                  shadowColor: '#000000',
                },
              ]}
            >
              <Image
                source={{ uri: currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link || currentSong?.image?.[0]?.link }}
                style={playerTabStyles.albumArt}
                resizeMode='cover'
              />
            </View>
          </View>
          <View style={playerTabStyles.songInfoContainer}>
            <Text
              style={[playerTabStyles.songTitle, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {currentSong?.name}
            </Text>
            <Text
              style={[playerTabStyles.artistName, { color: colors.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {artistName}
            </Text>
          </View>
          <SongControls />
        </View>

        <View
          style={[
            playerTabStyles.upNextWrapper,
            { bottom: Math.max(16, insets.bottom) },
          ]}
        >
          {nextSong ? (
            <Pressable
              style={[
                playerTabStyles.upNextCard,
                {
                  backgroundColor: colors.card + '20',
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                handleNextSong();
              }}
            >
              <Image
                source={{ uri: nextSong.image?.[1]?.link || nextSong.image?.[0]?.link || nextSong.image?.[2]?.link }}
                style={playerTabStyles.upNextArt}
                resizeMode='cover'
              />
              <Text
                style={[playerTabStyles.upNextText, { color: colors.text }]}
                numberOfLines={1}
              >
                Next: {nextSong.name}
              </Text>
              <Ionicons name='play-skip-forward' size={12} color={colors.text} style={playerTabStyles.upNextIcon} />
            </Pressable>
          ) : (
            <View style={playerTabStyles.endOfQueueCard}>
              <Ionicons name='musical-notes-outline' size={12} color={colors.mutedForeground} style={{ marginRight: 4 }} />
              <Text style={[playerTabStyles.endOfQueueText, { color: colors.mutedForeground }]}>
                End of Queue
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }
);

const playerTabStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 40,
  },
  artworkWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  artworkShadow: {
    borderRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  albumArt: {
    width: SCREEN_WIDTH - 48,
    aspectRatio: 1,
    borderRadius: 16,
    maxHeight: height * 0.40,
  },
  songInfoContainer: {
    width: '100%',
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  artistName: {
    fontSize: 16,
    marginTop: 6,
    fontWeight: '500',
  },
  upNextWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    opacity: 0.6,
  },
  upNextArt: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  upNextText: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 8,
    maxWidth: SCREEN_WIDTH * 0.5,
  },
  upNextIcon: {
    opacity: 0.8,
  },
  endOfQueueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    opacity: 0.4,
  },
  endOfQueueText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

const QueueTab = React.memo(() => (
  <View style={{ flex: 1 }}>
    <MusicQueue />
  </View>
));

export default function Player() {
  const { colors } = useTheme();
  const { addToQueue, handleNextSong, handlePlayPause } = usePlayerControls();
  const { currentSong, isPlaying, isLoading } = usePlaybackState();
  const { playlist } = usePlaylistState();
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('player');
  const insets = useSafeAreaInsets();
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);
  const lastFetchedForId = React.useRef<string | null>(null);

  const translateY = useSharedValue(height);
  const gestureTranslateY = useSharedValue(0);
  const miniPlayerOpacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const startY = useSharedValue(0);
  const miniPressScale = useSharedValue(1);

  const handlePlayPauseSong = () => {
    handlePlayPause();
  };

  const pathname = usePathname();
  const isHomeActive = pathname.includes('/home');

  const currentIndex = playlist.findIndex((song) => song.id === currentSong?.id);
  const needsRecommendations = currentIndex === -1 || currentIndex >= playlist.length - 2;
  const shouldFetch =
    autoFetchRecommendations &&
    !!currentSong?.id &&
    needsRecommendations &&
    lastFetchedForId.current !== currentSong?.id;

  const { data: recommendations = [], isLoading: loading } = useSongRecommendationsQuery(
    currentSong?.id,
    { enabled: shouldFetch },
  );

  useEffect(() => {
    if (recommendations.length > 0 && shouldFetch) {
      lastFetchedForId.current = currentSong?.id ?? null;
      addToQueue(recommendations);
    }
  }, [recommendations, shouldFetch, currentSong?.id, addToQueue]);

  const queueCount = useMemo(() => {
    if (!currentSong) return playlist.length;
    return playlist.filter((s) => s.id !== currentSong.id).length;
  }, [playlist, currentSong]);

  const openPlayer = useCallback(() => {
    setIsExpanded(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    translateY.value = withTiming(0, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.2, 0.65, 0.2, 1),
    });
    miniPlayerOpacity.value = withTiming(0, {
      duration: ANIMATION_DURATION * 0.5,
      easing: Easing.out(Easing.ease),
    });
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [translateY, miniPlayerOpacity, scale]);

  const closePlayer = useCallback(() => {
    translateY.value = withTiming(
      height,
      {
        duration: ANIMATION_DURATION,
        easing: Easing.bezier(0.3, 0.0, 0.6, 1),
      },
      () => {
        runOnJS(setIsExpanded)(false);
        gestureTranslateY.value = 0;
      }
    );
    miniPlayerOpacity.value = withTiming(1, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.3, 0.0, 0.6, 1),
    });
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [translateY, miniPlayerOpacity, gestureTranslateY, scale]);

  const handleTabPress = useCallback(
    (tab: TabType) => {
      if (tab !== activeTab) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTab(tab);
      }
    },
    [activeTab]
  );

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(', ') || '',
    [currentSong]
  );

  const verticalGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startY.value = gestureTranslateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      if (e.translationY > 0) {
        const dampenedDrag = e.translationY * 0.7;
        gestureTranslateY.value = startY.value + dampenedDrag;
      }
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > SWIPE_THRESHOLD || e.velocityY > 400) {
        runOnJS(closePlayer)();
      } else {
        gestureTranslateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const expandedPlayerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value + gestureTranslateY.value },
      { scale: scale.value },
    ],
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: isExpanded ? 10 : -1,
  }));

  const miniPlayerStyle = useAnimatedStyle(() => {
    const calculatedOpacity = interpolate(
      translateY.value,
      [0, height * 0.2, height * 0.5],
      [0, 0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: isExpanded ? calculatedOpacity : miniPlayerOpacity.value,
      transform: [
        {
          translateY: interpolate(
            translateY.value,
            [height * 0.7, height],
            [10, 0],
            Extrapolation.CLAMP
          ),
        },
        { scale: miniPressScale.value },
      ],
    };
  });



  const dragHandleOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      gestureTranslateY.value,
      [0, 30],
      [0.4, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const renderExpandedPlayer = () => (
    <Animated.View
      style={[
        expandedPlayerStyle,
        { backfaceVisibility: 'hidden' },
      ]}
    >
      <View
        style={[
          styles.expandedPlayerBackground,
          {
            paddingTop: insets.top,
            backgroundColor: colors.background,
          },
        ]}
      >
        <GestureDetector gesture={verticalGesture}>
          <Animated.View>
            <Animated.View style={[styles.dragHandleRow, dragHandleOpacity]}>
              <View style={[styles.dragHandle, { backgroundColor: colors.mutedForeground + '40' }]} />
            </Animated.View>
            <View style={styles.header}>
              <Button onPress={closePlayer} variant='ghost' size='icon'>
                <Ionicons name='chevron-down' size={24} color={colors.text} />
              </Button>

              <View style={styles.headerTabs}>
                <Pressable
                  onPress={() => handleTabPress('player')}
                  style={styles.headerTab}
                >
                  <Text
                    style={[
                      styles.headerTabText,
                      {
                        color: activeTab === 'player' ? colors.text : colors.mutedForeground,
                        fontWeight: activeTab === 'player' ? '700' : '500',
                      },
                    ]}
                  >
                    Playing
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleTabPress('queue')}
                  style={styles.headerTab}
                >
                  <Text
                    style={[
                      styles.headerTabText,
                      {
                        color: activeTab === 'queue' ? colors.text : colors.mutedForeground,
                        fontWeight: activeTab === 'queue' ? '700' : '500',
                      },
                    ]}
                  >
                    Queue
                  </Text>
                  {queueCount > 0 && (
                    <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.headerBadgeText, { color: colors.primaryForeground }]}>
                        {queueCount > 99 ? '99+' : queueCount}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <Button
                variant='ghost'
                size='icon'
                onPress={() => setPlayerDrawerOpen(true)}
              >
                <Ionicons name='ellipsis-horizontal' size={20} color={colors.text} />
              </Button>
            </View>
          </Animated.View>
        </GestureDetector>

        <Animated.View style={styles.contentContainer}>
          <View style={{ flex: 1 }}>
            <View
              pointerEvents={activeTab === 'player' ? 'auto' : 'none'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: activeTab === 'player' ? 1 : 0,
              }}
            >
              <PlayerTab currentSong={currentSong!} artistName={artistName} />
            </View>

            <View
              pointerEvents={activeTab === 'queue' ? 'auto' : 'none'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: activeTab === 'queue' ? 1 : 0,
              }}
            >
              <QueueTab />
            </View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );

  const renderMiniPlayer = () => (
    <Animated.View
      style={[
        styles.miniPlayerContainer,
        miniPlayerStyle,
        {
          bottom: isHomeActive ? 70 : 10,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      ]}
    >
      <ProgressBar />
      <Pressable
        style={styles.miniPlayerContent}
        onPress={openPlayer}
        onPressIn={() => {
          miniPressScale.value = withTiming(0.98, { duration: 100 });
        }}
        onPressOut={() => {
          miniPressScale.value = withSpring(1, { damping: 15, stiffness: 300 });
        }}
        android_ripple={{ color: colors.primary + '10', borderless: false }}
      >
        <Image
          source={{ uri: currentSong?.image[1]?.link }}
          style={styles.miniPlayerImage}
        />
        <View style={styles.miniPlayerTextContainer}>
          <Text
            style={[styles.miniPlayerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {currentSong?.name}
          </Text>
          <Text
            style={[styles.miniPlayerArtist, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {artistName}
          </Text>
        </View>
        <Pressable
          onPress={handlePlayPauseSong}
          hitSlop={8}
          style={styles.miniPlayerControl}
        >
          {isLoading ? (
            <ActivityIndicator size={20} color={colors.text} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={colors.text}
            />
          )}
        </Pressable>
        <Pressable
          onPress={() => handleNextSong()}
          hitSlop={8}
          style={styles.miniPlayerControl}
        >
          <Ionicons name='play-skip-forward' size={20} color={colors.text} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  useEffect(() => {
    const backAction = () => {
      if (isExpanded) {
        closePlayer();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isExpanded, closePlayer]);

  if (!currentSong || !isHomeActive) return null;

  return (
    <>
      {renderExpandedPlayer()}
      {renderMiniPlayer()}
      {playerDrawerOpen && (
        <NewPlayerDrawer
          isVisible={playerDrawerOpen}
          onClose={() => setPlayerDrawerOpen(false)}
          song={currentSong}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  miniPlayerContainer: {
    position: 'absolute',
    width: '100%',
    overflow: 'hidden',
    zIndex: 5,
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
  },
  miniPlayerImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  miniPlayerTextContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  miniPlayerTitle: {
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  miniPlayerArtist: {
    fontSize: 12,
    marginTop: 2,
  },
  miniPlayerControl: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  expandedPlayerBackground: {
    flex: 1,
    height: '100%',
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flex: 1,
  },
  headerTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  headerTabText: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
  headerBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  contentContainer: {
    flex: 1,
    paddingHorizontal: 6,
  },
});
