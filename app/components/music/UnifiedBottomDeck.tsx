import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { darkShadow, elevation } from '@/theme/elevation';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import PressableScale from '@/components/ui/PressableScale';
import { openFullPlayer, usePlaybackState, usePlayerControls } from '@/stores/playerStore';
import { Ionicons } from '@expo/vector-icons';
import { useProgress } from '@rntp/player';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const TAB_BAR_HEIGHT = 110;
/** Bottom padding scrollable pages need so their last item clears the deck (mini player + tabs). */
export const DECK_CLEARANCE = 160;
/** Height of the tab row alone (no mini player), excluding the bottom safe-area inset. */
export const DECK_NAV_HEIGHT = 62;

const TAB_ITEMS = [
  {
    name: 'home',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    name: 'group-music',
    label: 'Rooms',
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
    label: 'Messages',
    activeIcon: 'chatbubble-ellipses',
    inactiveIcon: 'chatbubble-ellipses-outline',
  },
] as const;

const PILL_WIDTH = 56;
const PILL_HEIGHT = 30;

const MiniProgressBar = memo(function MiniProgressBar({ color }: { color: string }) {
  const { position, duration } = useProgress();
  const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  // scaleX instead of width: no layout pass on every progress tick.
  return (
    <View style={styles.progressTrack}>
      <View
        style={[styles.progressFill, { backgroundColor: color, transform: [{ scaleX: fraction }] }]}
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
  live?: boolean;
  liveColor: string;
};

const TabButton = memo(function TabButton({
  isFocused,
  onPress,
  label,
  activeIcon,
  inactiveIcon,
  activeColor,
  inactiveColor,
  live,
  liveColor,
}: TabButtonProps) {
  const color = isFocused ? activeColor : inactiveColor;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      style={styles.tabButton}
      accessibilityRole='tab'
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
    >
      <View style={styles.tabInner}>
        {/* Tab switches happen 100+ times a day: the pill just appears, no slide. */}
        {/* Always set a background (transparent when inactive): on Android, a background
            added after first render can lose its borderRadius and draw square. */}
        <View
          style={[
            styles.tabIconBox,
            { backgroundColor: isFocused ? `${activeColor}26` : 'transparent' },
          ]}
        >
          <Ionicons name={isFocused ? activeIcon : inactiveIcon} size={21} color={color} />
          {live && <View style={[styles.liveDot, { backgroundColor: liveColor }]} />}
        </View>
        <Text
          style={[styles.tabLabel, { color, fontWeight: isFocused ? '700' : '500' }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
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

/**
 * Floating now-playing card above the tabs. The artwork's own colours tint the card, the
 * progress runs along its bottom edge, and every control uses UI-thread press feedback.
 */
export const MiniPlayerRow = memo(function MiniPlayerRow({
  currentSong,
  isPlaying,
  handlePlayPause,
  handleNextSong,
  colors,
  isDark,
}: MiniPlayerRowProps) {
  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 2)
        ?.map((a: any) => a.name)
        .join(', ') || 'Unknown Artist',
    [currentSong]
  );

  const artworkUri = currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link;

  return (
    <View style={styles.miniPlayerWrapper}>
      {/* Elevated solid surface: the shadow lives on the outer view, clipping on the inner. */}
      <View style={[styles.miniShadow, elevation.float, isDark && darkShadow]}>
        <View style={[styles.miniCard, { backgroundColor: isDark ? colors.popover : colors.card }]}>
          <PressableScale
            onPress={openFullPlayer}
            scaleTo={0.985}
            style={styles.miniPlayerPressable}
            accessibilityRole='button'
            accessibilityLabel={`Open player: ${currentSong?.name ?? ''}`}
          >
            <Image source={{ uri: artworkUri }} style={styles.artwork} fadeDuration={0} />

            <View style={styles.songInfo}>
              <Text style={[styles.songTitle, { color: colors.foreground }]} numberOfLines={1}>
                {currentSong?.name}
              </Text>
              <Text
                style={[styles.artistName, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {artistName}
              </Text>
            </View>

            <View style={styles.controls}>
              <PressableScale
                onPress={handlePlayPause}
                scaleTo={0.86}
                hitSlop={8}
                accessibilityRole='button'
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                style={[styles.playButton, { backgroundColor: colors.primary }]}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={18}
                  color={colors.primaryForeground}
                  style={{ marginLeft: isPlaying ? 0 : 2 }}
                />
              </PressableScale>

              <PressableScale
                onPress={handleNextSong}
                scaleTo={0.82}
                hitSlop={8}
                accessibilityRole='button'
                accessibilityLabel='Next song'
                style={styles.nextButton}
              >
                <Ionicons name='play-skip-forward' size={20} color={colors.foreground} />
              </PressableScale>
            </View>
          </PressableScale>

          <MiniProgressBar color={colors.primary} />
        </View>
      </View>
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
  const handlers = useMemo(
    () => [goHome, goGroup, goPlaylist, goChat],
    [goHome, goGroup, goPlaylist, goChat]
  );

  const isDark = theme === 'dark';
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));

  // Tinted to the aubergine surfaces so the deck reads as part of the app, not a grey slab.
  const glassBg = isDark ? 'rgba(16, 12, 22, 0.92)' : 'rgba(251, 250, 253, 0.94)';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';

  // In a room the room owns playback; your own song waits on Home under the room card.
  const showMiniPlayer = !inRoom && activePlayerMode === 'normal' && !!currentSong;

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
            <MiniPlayerRow
              currentSong={currentSong}
              isPlaying={isPlaying}
              handlePlayPause={handlePlayPause}
              handleNextSong={handleNextSong}
              colors={colors}
              isDark={isDark}
            />
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
                live={tab.name === 'group-music' && inRoom}
                liveColor={colors.live}
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    transformOrigin: 'left',
  },

  miniPlayerWrapper: {
    width: '100%',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  miniShadow: { borderRadius: 18 },
  miniCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  miniPlayerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 8,
    width: '100%',
  },
  artwork: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  songInfo: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 8,
    justifyContent: 'center',
  },
  songTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  artistName: {
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },

  navRow: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-around',
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
    gap: 3,
  },
  tabIconBox: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    top: 4,
    right: 14,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
});
