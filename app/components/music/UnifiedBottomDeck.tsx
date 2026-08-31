import { useTheme } from '@/context/ThemeContext';
import { openFullPlayer, usePlaybackState, usePlayerControls } from '@/stores/playerStore';
import { Ionicons } from '@expo/vector-icons';
import { useProgress } from '@rntp/player';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 110;

const TAB_ITEMS = [
  {
    name: 'home',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    name: 'group-music',
    label: 'Group',
    activeIcon: 'headset',
    inactiveIcon: 'headset-outline',
  },
  {
    name: 'playlist',
    label: 'Library',
    activeIcon: 'musical-notes',
    inactiveIcon: 'musical-notes-outline',
  },
  {
    name: 'chat',
    label: 'Chat',
    activeIcon: 'chatbubble-ellipses',
    inactiveIcon: 'chatbubble-ellipses-outline',
  },
  {
    name: 'profile',
    label: 'Profile',
    activeIcon: 'person-circle',
    inactiveIcon: 'person-circle-outline',
  },
] as const;

const SPRING_SNAPPY = { damping: 20, stiffness: 400, mass: 0.4 };

const MiniProgressBar = memo(function MiniProgressBar({ color }: { color: string }) {
  const { position, duration } = useProgress();
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));

  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clampedPercent}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
});

type TabButtonProps = {
  isFocused: boolean;
  onPress: () => void;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  activeColor: string;
  inactiveColor: string;
};

const TabButton = memo(function TabButton({
  isFocused,
  onPress,
  label,
  activeIcon,
  inactiveIcon,
  activeColor,
  inactiveColor,
}: TabButtonProps) {
  const focusAnim = useDerivedValue(() => {
    return withSpring(isFocused ? 1 : 0, SPRING_SNAPPY);
  }, [isFocused]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusAnim.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusAnim.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
  }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.tabButton}
      accessibilityRole='tab'
      accessibilityState={{ selected: isFocused }}
      android_ripple={{ color: activeColor + '12', borderless: true, radius: 28 }}
    >
      <View style={styles.tabInner}>
        <Animated.View style={iconStyle}>
          <Ionicons
            name={isFocused ? activeIcon : inactiveIcon}
            size={22}
            color={isFocused ? activeColor : inactiveColor}
          />
        </Animated.View>
        <Animated.Text
          style={[styles.tabLabel, { color: isFocused ? activeColor : inactiveColor }, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
});

type MiniPlayerRowProps = {
  currentSong: any;
  isPlaying: boolean;
  handlePlayPause: () => void;
  handleNextSong: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
};

export const MiniPlayerRow = memo(function MiniPlayerRow({
  currentSong,
  isPlaying,
  handlePlayPause,
  handleNextSong,
  colors,
  isDark,
}: MiniPlayerRowProps) {
  const pressScale = useSharedValue(1);
  const playBtnScale = useSharedValue(1);
  const nextBtnScale = useSharedValue(1);

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((a: any) => a.name)
        .join(', ') || 'Unknown Artist',
    [currentSong]
  );

  const artworkUri = currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link;

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const playBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playBtnScale.value }],
  }));

  const nextBtnAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextBtnScale.value }],
  }));

  const handleOpenPlayer = () => {
    openFullPlayer();
  };

  return (
    <View style={styles.miniPlayerWrapper}>
      <MiniProgressBar color={colors.primary} />

      <Animated.View style={[styles.miniPlayerRow, rowAnimatedStyle]}>
        <Pressable
          style={styles.miniPlayerPressable}
          onPress={handleOpenPlayer}
          onPressIn={() => {
            // oxlint-disable-next-line react/immutability
            pressScale.value = withTiming(0.98, { duration: 70 });
          }}
          onPressOut={() => {
            // oxlint-disable-next-line react/immutability
            pressScale.value = withSpring(1, { damping: 15, stiffness: 350 });
          }}
        >
          <View
            style={[
              styles.artworkContainer,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            ]}
          >
            <Image source={{ uri: artworkUri }} style={styles.artwork} />
          </View>

          <View style={styles.songInfo}>
            <Text style={[styles.songTitle, { color: colors.foreground }]} numberOfLines={1}>
              {currentSong?.name}
            </Text>
            <Text style={[styles.artistName, { color: colors.mutedForeground }]} numberOfLines={1}>
              {artistName}
            </Text>
          </View>

          <View style={styles.controls}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              onPressIn={() => {
                // oxlint-disable-next-line react/immutability
                playBtnScale.value = withTiming(0.85, { duration: 60 });
              }}
              onPressOut={() => {
                // oxlint-disable-next-line react/immutability
                playBtnScale.value = withSpring(1, SPRING_SNAPPY);
              }}
              hitSlop={8}
            >
              <Animated.View
                style={[styles.playButton, { backgroundColor: colors.primary }, playBtnAnimStyle]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={18}
                  color={colors.primaryForeground}
                  style={{ marginLeft: isPlaying ? 0 : 1.5 }}
                />
              </Animated.View>
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleNextSong();
              }}
              onPressIn={() => {
                // oxlint-disable-next-line react/immutability
                nextBtnScale.value = withTiming(0.82, { duration: 60 });
              }}
              onPressOut={() => {
                // oxlint-disable-next-line react/immutability
                nextBtnScale.value = withSpring(1, SPRING_SNAPPY);
              }}
              style={styles.nextButton}
              hitSlop={8}
            >
              <Animated.View style={nextBtnAnimStyle}>
                <Ionicons name='play-skip-forward' size={18} color={colors.mutedForeground} />
              </Animated.View>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
});

type UnifiedBottomDeckProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  theme: string;
  insets: ReturnType<typeof useSafeAreaInsets>;
  activeSegment: string;
};

export const UnifiedBottomDeck = memo(function UnifiedBottomDeck({
  colors,
  theme,
  insets,
  activeSegment,
}: UnifiedBottomDeckProps) {
  const { currentSong, isPlaying, activePlayerMode } = usePlaybackState();
  const { handlePlayPause, handleNextSong } = usePlayerControls();

  const goHome = useCallback(() => router.navigate('/(tabs)/home'), []);
  const goGroup = useCallback(() => router.navigate('/(tabs)/group-music'), []);
  const goPlaylist = useCallback(() => router.navigate('/(tabs)/playlist'), []);
  const goChat = useCallback(() => router.navigate('/(tabs)/chat'), []);
  const goProfile = useCallback(() => router.navigate('/(tabs)/profile'), []);
  const handlers = useMemo(
    () => [goHome, goGroup, goPlaylist, goChat, goProfile],
    [goHome, goGroup, goPlaylist, goChat, goProfile]
  );

  const isDark = theme === 'dark';

  const glassBg = isDark ? 'rgba(18, 18, 24, 0.88)' : 'rgba(255, 255, 255, 0.92)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';

  const showMiniPlayer = activePlayerMode === 'normal' && !!currentSong;

  return (
    <Animated.View style={styles.outerContainer}>
      <View style={styles.surfaceWrapper}>
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={45}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View
          style={[
            styles.blurContainer,
            {
              backgroundColor: glassBg,
              borderColor: borderColor,
              paddingBottom: Math.max(6, insets.bottom),
            },
          ]}
        >
          {showMiniPlayer && (
            <>
              <MiniPlayerRow
                currentSong={currentSong}
                isPlaying={isPlaying}
                handlePlayPause={handlePlayPause}
                handleNextSong={handleNextSong}
                colors={colors}
                isDark={isDark}
              />
              <View
                style={[
                  styles.divider,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                ]}
              />
            </>
          )}

          <View style={styles.navRow}>
            {TAB_ITEMS.map((tab, index) => (
              <TabButton
                key={tab.name}
                onPress={handlers[index]}
                label={tab.label}
                activeIcon={tab.activeIcon}
                inactiveIcon={tab.inactiveIcon}
                isFocused={activeSegment === tab.name}
                activeColor={colors.primary}
                inactiveColor={colors.mutedForeground}
              />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  surfaceWrapper: {
    width: '100%',
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  blurContainer: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },

  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
  },

  miniPlayerWrapper: {
    width: '100%',
  },
  miniPlayerRow: {
    width: '100%',
  },
  miniPlayerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  artworkContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  artwork: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  songInfo: {
    flex: 1,
    paddingLeft: 10,
    paddingRight: 8,
    justifyContent: 'center',
  },
  songTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    letterSpacing: 0.05,
  },
  artistName: {
    fontSize: 11.5,
    marginTop: 1,
    opacity: 0.7,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },

  navRow: {
    flexDirection: 'row',
    height: 52,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    flex: 1,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
});
