import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, ROW_PRESS_SCALE, SPRING_PRESS } from '@/lib/motion';
import { EDGE_GUARD, isSkipSwipe, SWIPE_ACTIVATE, SWIPE_DIRECTION_DECIDED } from '@/lib/swipe';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import PressableScale from '@/components/ui/PressableScale';
import {
  openFullPlayer,
  usePlaybackState,
  usePlayerControls,
  usePlayerStore,
} from '@/stores/playerStore';
import { Ionicons } from '@expo/vector-icons';
import { useProgress } from '@rntp/player';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
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

/** Thin line along the dock's top edge. Glides between the 1s ticks (transform only). */
const MiniProgressBar = memo(function MiniProgressBar({
  color,
  trackColor,
}: {
  color: string;
  trackColor: string;
}) {
  const { position, duration } = useProgress();
  const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const shown = useSharedValue(fraction);

  useEffect(() => {
    // A normal tick glides; a new song or a seek jumps straight there.
    const glide = fraction >= shown.get() && (fraction - shown.get()) * duration < 2.5;
    shown.set(glide ? withTiming(fraction, { duration: 1000, easing: Easing.linear }) : fraction);
  }, [fraction, duration, shown]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: shown.get() }] }));

  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.progressFill, { backgroundColor: color }, fill]} />
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
        {/* Tab switches happen 100+ times a day, so nothing animates: the icon just fills in. */}
        <View style={styles.tabIconBox}>
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
  handlePrevSong: (force?: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
};

const SWIPE_OPEN_DISTANCE = 24;
const SWIPE_OPEN_VELOCITY = 400;
/** A committed skip carries the song this far out, where it has faded away. */
const SKIP_OUT = 120;
const SKIP_OUT_TIMING = { duration: 110, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
/** If no new song arrives (end of the queue), the old one comes back after this. */
const SKIP_RETURN_DELAY_MS = 400;
// The new song comes in from the side the swipe came from, like the full player's artwork.
const SONG_ENTER = {
  next: FadeInRight.duration(200).easing(EASE_OUT).reduceMotion(ReduceMotion.System),
  prev: FadeInLeft.duration(200).easing(EASE_OUT).reduceMotion(ReduceMotion.System),
} as const;

/**
 * Now playing, sitting directly on the dock: no card of its own. Tap or swipe up opens the
 * full player, swipe sideways skips, and the song slides with your finger while you do.
 */
export const MiniPlayerRow = memo(function MiniPlayerRow({
  currentSong,
  isPlaying,
  handlePlayPause,
  handleNextSong,
  handlePrevSong,
  colors,
}: MiniPlayerRowProps) {
  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 2)
        ?.map((a: any) => a.name)
        .join(', ') || 'Unknown Artist',
    [currentSong]
  );

  const artworkUri = currentSong?.image?.[1]?.link || currentSong?.image?.[2]?.link;

  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  // 0 undecided, 1 sideways (skip), 2 upwards (open). Locked once for each swipe.
  const axis = useSharedValue(0);
  /** This swipe skipped: the song keeps going out instead of springing back. */
  const skipped = useSharedValue(false);
  const skipNext = useCallback(() => handleNextSong(), [handleNextSong]);
  const skipPrev = useCallback(() => handlePrevSong(true), [handlePrevSong]);

  // Which way the song changed, worked out while rendering so the new one enters from the right
  // side on its first frame. Only one step back is "previous"; auto-advance and jumps read as next.
  const queueIndex = usePlayerStore((s) =>
    s.currentSong ? s.playlist.findIndex((i) => i.id === s.currentSong?.id) : -1
  );
  const songId: string | undefined = currentSong?.id;
  const [shown, setShown] = useState({ id: songId, index: queueIndex });
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  if (shown.id !== songId || shown.index !== queueIndex) {
    if (shown.id !== songId) setDirection(queueIndex === shown.index - 1 ? 'prev' : 'next');
    setShown({ id: songId, index: queueIndex });
  }

  // The new song starts centred; whatever the old one was doing is over.
  useLayoutEffect(() => {
    x.set(0);
  }, [songId, x]);

  const swipe = Gesture.Pan()
    .hitSlop({ left: -EDGE_GUARD, right: -EDGE_GUARD })
    .activeOffsetX([-SWIPE_ACTIVATE, SWIPE_ACTIVATE])
    .activeOffsetY([-14, 1000])
    .onStart(() => {
      axis.set(0);
      skipped.set(false);
    })
    .onUpdate((e) => {
      if (
        axis.get() === 0 &&
        Math.max(Math.abs(e.translationX), Math.abs(e.translationY)) >= SWIPE_DIRECTION_DECIDED
      ) {
        axis.set(Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2);
      }
      if (axis.get() === 1) x.set(e.translationX * 0.6);
    })
    .onEnd((e, success) => {
      // Not successful: the system took the touch over (its back gesture). Nothing was asked for.
      if (!success) return;
      // Barely moved before lifting: a flick can still say which way it was going.
      const swipedSideways =
        axis.get() === 1 || (axis.get() === 0 && Math.abs(e.velocityX) > Math.abs(e.velocityY));
      if (swipedSideways) {
        if (isSkipSwipe(e.translationX, e.velocityX, width)) {
          const forward = e.translationX < 0;
          skipped.set(true);
          x.set(
            withSequence(
              withTiming(forward ? -SKIP_OUT : SKIP_OUT, SKIP_OUT_TIMING),
              withDelay(SKIP_RETURN_DELAY_MS, withSpring(0, SPRING_PRESS))
            )
          );
          scheduleOnRN(forward ? skipNext : skipPrev);
        }
      } else if (e.translationY < -SWIPE_OPEN_DISTANCE || e.velocityY < -SWIPE_OPEN_VELOCITY) {
        scheduleOnRN(openFullPlayer);
      }
    })
    .onFinalize(() => {
      if (!skipped.get()) x.set(withSpring(0, SPRING_PRESS));
    });

  const songStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.get()), [0, 90, SKIP_OUT], [1, 0.35, 0], 'clamp'),
    transform: [{ translateX: x.get() }],
  }));

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.miniRow}>
        <PressableScale
          onPress={openFullPlayer}
          scaleTo={ROW_PRESS_SCALE}
          style={styles.miniSong}
          accessibilityRole='button'
          accessibilityLabel={`Open player: ${currentSong?.name ?? ''}`}
        >
          <Animated.View key={songId} entering={SONG_ENTER[direction]} style={styles.miniSongEnter}>
            <Animated.View style={[styles.miniSongInner, songStyle]}>
              <Image
                source={{ uri: artworkUri }}
                style={[styles.artwork, { backgroundColor: colors.raised }]}
                fadeDuration={0}
              />
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
            </Animated.View>
          </Animated.View>
        </PressableScale>

        <PressableScale
          onPress={handlePlayPause}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          style={styles.miniControl}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={colors.foreground} />
        </PressableScale>
        <PressableScale
          onPress={skipNext}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel='Next song'
          style={styles.miniControl}
        >
          <Ionicons name='play-skip-forward' size={22} color={colors.foreground} />
        </PressableScale>
      </View>
    </GestureDetector>
  );
});

type UnifiedBottomDeckProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  insets: ReturnType<typeof useSafeAreaInsets>;
  activeSegment: string;
};

export const UnifiedBottomDeck = memo(function UnifiedBottomDeck({
  colors,
  insets,
  activeSegment,
}: UnifiedBottomDeckProps) {
  const { currentSong, isPlaying, activePlayerMode } = usePlaybackState();
  const { handlePlayPause, handleNextSong, handlePrevSong } = usePlayerControls();

  const goHome = useCallback(() => router.navigate('/(tabs)/home'), []);
  const goGroup = useCallback(() => router.navigate('/(tabs)/group-music'), []);
  const goPlaylist = useCallback(() => router.navigate('/(tabs)/playlist'), []);
  const goChat = useCallback(() => router.navigate('/(tabs)/chat'), []);
  const handlers = useMemo(
    () => [goHome, goGroup, goPlaylist, goChat],
    [goHome, goGroup, goPlaylist, goChat]
  );

  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));

  // In a room the room owns playback; your own song waits on Home under the room card.
  const showMiniPlayer = !inRoom && activePlayerMode === 'normal' && !!currentSong;

  return (
    // One opaque surface for the song and the tabs: nothing shows through or sits on top.
    <View
      style={[
        styles.dock,
        { backgroundColor: colors.card, paddingBottom: Math.max(6, insets.bottom) },
      ]}
    >
      {showMiniPlayer ? (
        <>
          <MiniProgressBar color={colors.primary} trackColor={colors.border} />
          <MiniPlayerRow
            currentSong={currentSong}
            isPlaying={isPlaying}
            handlePlayPause={handlePlayPause}
            handleNextSong={handleNextSong}
            handlePrevSong={handlePrevSong}
            colors={colors}
          />
        </>
      ) : (
        <View style={[styles.dockEdge, { backgroundColor: colors.border }]} />
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
  );
});

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dockEdge: { height: StyleSheet.hairlineWidth },

  progressTrack: { height: 2, overflow: 'hidden' },
  progressFill: {
    height: '100%',
    width: '100%',
    transformOrigin: 'left',
  },

  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingLeft: 12,
    paddingRight: 6,
  },
  miniSong: { flex: 1, minWidth: 0, height: '100%' },
  miniSongEnter: { flex: 1 },
  miniSongInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  artwork: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  songInfo: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 12.5,
    marginTop: 1,
  },
  miniControl: {
    width: 44,
    height: 44,
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
    width: 48,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    position: 'absolute',
    top: 2,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: 0.1,
  },
});
