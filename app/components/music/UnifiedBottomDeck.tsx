import {
  HomeIcon,
  LibraryIcon,
  MessagesIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  RoomsIcon,
  SearchMusicIcon,
} from '@/components/icons/NavIcons';
import GlassSurface from '@/components/shell/GlassSurface';
import GlowSweep from '@/components/shell/GlowSweep';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import {
  BUTTON_PRESS_SCALE,
  EASE_IN_OUT,
  EASE_OUT,
  PRESS_IN,
  ROW_PRESS_SCALE,
  SPRING_PRESS,
} from '@/lib/motion';
import { EDGE_GUARD, isSkipSwipe, SWIPE_ACTIVATE, SWIPE_DIRECTION_DECIDED } from '@/lib/swipe';
import { selectUnreadTotal, useChatStore } from '@/stores/chatStore';
import { useDeckStore } from '@/stores/deckStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import {
  openFullPlayer,
  useFullPlayerOpen,
  usePlaybackState,
  usePlayerControls,
  usePlayerStore,
} from '@/stores/playerStore';
import { usePlayerProgress } from '@/hooks/usePlayerProgress';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cubicBezier,
  Easing,
  FadeInLeft,
  FadeInRight,
  interpolate,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

export const TAB_BAR_HEIGHT = 110;
/** Bottom padding scrollable pages need so their last item clears the deck (card + tabs). */
export const DECK_CLEARANCE = 172;
/** The tab pill and the gap above it, excluding the bottom safe-area inset. */
export const DECK_NAV_HEIGHT = 70;

const PILL_HEIGHT = 58;
/** Space between the pill and the bottom inset. */
const DECK_BOTTOM_GAP = 4;

type TabIcon = typeof HomeIcon;

const TAB_ITEMS: { name: string; label: string; Icon: TabIcon }[] = [
  { name: 'home', label: 'Home', Icon: HomeIcon },
  { name: 'group-music', label: 'Rooms', Icon: RoomsIcon },
  { name: 'playlist', label: 'Library', Icon: LibraryIcon },
  { name: 'chat', label: 'Messages', Icon: MessagesIcon },
];

type Colors = ReturnType<typeof useTheme>['colors'];

/** Thin line along the card's bottom edge. Glides between the 1s ticks (transform only). */
const MiniProgressBar = memo(function MiniProgressBar({
  color,
  trackColor,
}: {
  color: string;
  trackColor: string;
}) {
  const { position, duration } = usePlayerProgress();
  const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const shown = useSharedValue(fraction);
  // Under the full player nobody sees it, and its glide would update a view on every frame.
  const covered = useFullPlayerOpen((s) => s.open);

  useEffect(() => {
    // A normal tick glides; a new song or a seek jumps straight there.
    const glide = !covered && fraction >= shown.get() && (fraction - shown.get()) * duration < 2.5;
    shown.set(glide ? withTiming(fraction, { duration: 1000, easing: Easing.linear }) : fraction);
  }, [covered, fraction, duration, shown]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: shown.get() }] }));

  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.progressFill, { backgroundColor: color }, fill]} />
    </View>
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
 * Now playing, inside the floating card above the tabs. Tap or swipe up opens the
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
          {isPlaying ? (
            <PauseIcon size={24} color={colors.foreground} />
          ) : (
            <PlayIcon size={24} color={colors.foreground} />
          )}
        </PressableScale>
        <PressableScale
          onPress={skipNext}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel='Next song'
          style={styles.miniControl}
        >
          <NextIcon size={22} color={colors.foreground} />
        </PressableScale>
      </View>
    </GestureDetector>
  );
});

const DECK_SIDE = 12;
/** A skipped song's artwork leaves the orb this far, faded out by then. */
const SKIP_OUT_ORB = 40;
const PRESS_OUT = { duration: 150, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
/**
 * How long the capsule stays out on its own: after a song change, and after a hold. Long enough to
 * read a title; a swipe or play/pause restarts it, so it never closes under your finger.
 */
const SHOW_SONG_MS = 2500;
const HOLD_SONG_MS = 3000;
const CAPSULE_OPEN = {
  duration: 250,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
// Closing is quicker than opening: the capsule is drawn back into the orb.
const CAPSULE_CLOSE = {
  duration: 160,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
const CAPSULE_SHOW = {
  duration: 60,
  easing: Easing.linear,
  reduceMotion: ReduceMotion.System,
} as const;
const CAPSULE_CONTENT_IN = {
  duration: 170,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
const CAPSULE_CONTENT_OUT = {
  duration: 80,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
/** The orb takes the capsule back in: a small swell as it arrives. */
const ORB_ABSORB_UP = {
  duration: 110,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
const ORB_ABSORB_DOWN = {
  duration: 170,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
const TABS_HIDE = { duration: 150, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
/**
 * Switching tabs: Emil Kowalski's segmented-indicator recipe. Every tab is the same width; only the
 * pill moves (translateX, 220ms ease-in-out, because it travels across the bar), and each icon
 * cross-fades between its outline and filled form on the same clock, so it's never dark on glass
 * mid-way. A fast second tap retargets from where the pill is. Reduce Motion makes it a jump.
 */
const TAB_MOVE = { duration: 220, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System } as const;
const TAB_ICON_FADE = {
  transitionProperty: 'opacity',
  transitionDuration: 220,
  transitionTimingFunction: cubicBezier(0.77, 0, 0.175, 1),
} as const;
const RING_R = 26.5;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Progress around the orb, same glide as the card's line. */
const OrbRing = memo(function OrbRing({
  color,
  trackColor,
}: {
  color: string;
  trackColor: string;
}) {
  const { position, duration } = usePlayerProgress();
  const fraction = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const shown = useSharedValue(fraction);
  const covered = useFullPlayerOpen((s) => s.open);

  useEffect(() => {
    const glide = !covered && fraction >= shown.get() && (fraction - shown.get()) * duration < 2.5;
    shown.set(glide ? withTiming(fraction, { duration: 1000, easing: Easing.linear }) : fraction);
  }, [covered, fraction, duration, shown]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_C * (1 - shown.get()) }));

  return (
    <Svg width={58} height={58} viewBox='0 0 58 58' style={styles.ring} pointerEvents='none'>
      <Circle cx={29} cy={29} r={RING_R} stroke={trackColor} strokeWidth={2.5} fill='none' />
      <AnimatedCircle
        cx={29}
        cy={29}
        r={RING_R}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap='round'
        fill='none'
        strokeDasharray={RING_C}
        animatedProps={ringProps}
        // Start at 12 o'clock.
        transform='rotate(-90 29 29)'
      />
    </Svg>
  );
});

type OrbKind = 'song' | 'room' | 'idle';

/**
 * When a swipe on the orb skips. The orb sits about 40dp from the left edge, so a leftward swipe has
 * little room: a short drag, or a shorter flick, is enough. Travel is measured from where the finger
 * landed, because Android zeroes the pan's translation when it activates.
 */
const ORB_SKIP_DISTANCE = 24;
const ORB_FLICK_DISTANCE = 10;
const ORB_FLICK_VELOCITY = 450;
/** Moving back this fast at release means you changed your mind. */
const ORB_REVERSE_VELOCITY = 300;
const isOrbSkip = (dx: number, vx: number) => {
  'worklet';
  const speedOut = dx < 0 ? -vx : vx;
  if (speedOut < -ORB_REVERSE_VELOCITY) return false;
  const distance = Math.abs(dx);
  return (
    distance >= ORB_SKIP_DISTANCE ||
    (distance >= ORB_FLICK_DISTANCE && speedOut >= ORB_FLICK_VELOCITY)
  );
};
/** Hold this long to show the song and its controls. */
const ORB_HOLD_MS = 420;

/**
 * The round button left of the tabs: what's playing, or Search when nothing is.
 * Tap opens the full player (or the room), or shrinks the capsule when it's out. Hold shows the
 * capsule. Swipe sideways to skip: the artwork follows your finger, and the next one slides in
 * from the side you swiped.
 */
const Orb = memo(function Orb({
  kind,
  artworkUri,
  songId,
  direction,
  expanded,
  onTap,
  onHold,
  onSkip,
  glowPlay,
  colors,
}: {
  kind: OrbKind;
  artworkUri?: string;
  songId?: string;
  direction: 'next' | 'prev';
  expanded: boolean;
  onTap: () => void;
  onHold: () => void;
  onSkip: (dir: 'next' | 'prev') => void;
  glowPlay: number;
  colors: Colors;
}) {
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const skipped = useSharedValue(false);
  const startX = useSharedValue(0);

  // When the capsule closes, it lands back in the orb, which swells a touch to take it in.
  const wasExpanded = useRef(expanded);
  useEffect(() => {
    if (wasExpanded.current && !expanded) {
      scale.set(
        withDelay(
          CAPSULE_CLOSE.duration - 50,
          withSequence(withTiming(1.07, ORB_ABSORB_UP), withTiming(1, ORB_ABSORB_DOWN))
        )
      );
    }
    wasExpanded.current = expanded;
  }, [expanded, scale]);

  // A new song starts centred; whatever the old one was doing is over.
  useLayoutEffect(() => {
    x.set(0);
  }, [songId, x]);

  const canSwipe = kind === 'song';
  const pan = Gesture.Pan()
    .enabled(canSwipe)
    // The first few points of the screen edge belong to Android's back gesture.
    .hitSlop({ left: -(EDGE_GUARD - DECK_SIDE) })
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      skipped.set(false);
      startX.set(e.absoluteX);
    })
    .onUpdate((e) => {
      x.set((e.absoluteX - startX.get()) * 0.5);
    })
    .onEnd((e, success) => {
      const dx = e.absoluteX - startX.get();
      if (!success || !isOrbSkip(dx, e.velocityX)) return;
      const forward = dx < 0;
      skipped.set(true);
      x.set(
        withSequence(
          withTiming(forward ? -SKIP_OUT_ORB : SKIP_OUT_ORB, SKIP_OUT_TIMING),
          withDelay(SKIP_RETURN_DELAY_MS, withSpring(0, SPRING_PRESS))
        )
      );
      scheduleOnRN(onSkip, forward ? 'next' : 'prev');
    })
    .onFinalize(() => {
      if (!skipped.get()) x.set(withSpring(0, SPRING_PRESS));
    });
  const hold = Gesture.LongPress()
    .minDuration(ORB_HOLD_MS)
    .onStart(() => {
      scale.set(withTiming(1, PRESS_OUT));
      scheduleOnRN(onHold);
    });
  const tap = Gesture.Tap()
    .onBegin(() => {
      scale.set(withTiming(BUTTON_PRESS_SCALE, PRESS_IN));
    })
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(onTap);
    })
    .onFinalize(() => {
      scale.set(withTiming(1, PRESS_OUT));
    });
  const gesture = Gesture.Race(pan, hold, tap);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.get()), [0, 30, SKIP_OUT_ORB], [1, 0.5, 0], 'clamp'),
    transform: [{ translateX: x.get() }],
  }));

  const label =
    kind === 'idle'
      ? 'Search'
      : expanded
        ? 'Hide song'
        : kind === 'room'
          ? 'Back to room'
          : 'Open player';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={pressStyle}
        accessible
        accessibilityRole='button'
        accessibilityLabel={label}
        accessibilityHint={kind === 'song' ? 'Swipe left or right to change song' : undefined}
        accessibilityActions={
          kind === 'song'
            ? [
                { name: 'activate' },
                { name: 'longpress', label: 'Show song and controls' },
                { name: 'next', label: 'Next song' },
                { name: 'previous', label: 'Previous song' },
              ]
            : [{ name: 'activate' }]
        }
        onAccessibilityAction={(e) => {
          const a = e.nativeEvent.actionName;
          if (a === 'activate') onTap();
          else if (a === 'longpress') onHold();
          else if (a === 'next') onSkip('next');
          else if (a === 'previous') onSkip('prev');
        }}
      >
        <GlassSurface radius={PILL_HEIGHT / 2} style={styles.orb} contentStyle={styles.orbInner}>
          {kind === 'idle' ? (
            // Nothing playing: an ember orb that invites you to find something, the bar's one
            // spot of colour. A soft highlight on the upper left gives it some depth.
            <View style={styles.orbIdle}>
              <LinearGradient
                colors={colors.gradients.primary as [string, string, ...string[]]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.85, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.38)', 'rgba(255, 255, 255, 0)']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.6, y: 0.6 }}
                style={StyleSheet.absoluteFill}
              />
              <SearchMusicIcon size={24} color={colors.primaryForeground} />
            </View>
          ) : (
            <>
              {kind === 'song' && <OrbRing color={colors.primary} trackColor={colors.hairline} />}
              <View style={styles.orbArtBox}>
                <Animated.View key={songId} entering={SONG_ENTER[direction]} style={styles.orbArt}>
                  <Animated.View style={[styles.orbArt, artStyle]}>
                    <Image
                      source={{ uri: artworkUri }}
                      style={[styles.orbArt, { backgroundColor: colors.raised }]}
                      fadeDuration={0}
                    />
                  </Animated.View>
                </Animated.View>
              </View>
            </>
          )}
        </GlassSurface>
        <GlowSweep
          width={PILL_HEIGHT}
          height={PILL_HEIGHT}
          radius={PILL_HEIGHT / 2}
          colors={colors.gradients.primary}
          play={glowPlay}
        />
      </Animated.View>
    </GestureDetector>
  );
});

type TabButtonProps = {
  name: string;
  isFocused: boolean;
  onPress: () => void;
  label: string;
  Icon: TabIcon;
  colors: Colors;
  live?: boolean;
  /** Unread count shown as a pill on the icon. */
  badge?: number;
  onTabLayout: (name: string, x: number, width: number) => void;
};

const TabButton = memo(function TabButton({
  name,
  isFocused,
  onPress,
  label,
  Icon,
  colors,
  live,
  badge = 0,
  onTabLayout,
}: TabButtonProps) {
  return (
    // Same width selected or not, so nothing re-lays-out when you switch: the bar's pill moves.
    <View
      style={styles.tab}
      onLayout={(e: LayoutChangeEvent) =>
        onTabLayout(name, e.nativeEvent.layout.x, e.nativeEvent.layout.width)
      }
    >
      <PressableScale
        onPress={onPress}
        scaleTo={BUTTON_PRESS_SCALE}
        style={styles.tabPress}
        accessibilityRole='tab'
        accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
        accessibilityState={{ selected: isFocused }}
      >
        <View style={styles.tabIcon}>
          <Animated.View style={[TAB_ICON_FADE, { opacity: isFocused ? 0 : 1 }]}>
            <Icon color={colors.mutedForeground} />
          </Animated.View>
          <Animated.View style={[styles.tabIconOn, TAB_ICON_FADE, { opacity: isFocused ? 1 : 0 }]}>
            <Icon color={colors.background} filled knock={colors.foreground} />
          </Animated.View>
          {live && <View style={[styles.liveDot, { backgroundColor: colors.live }]} />}
          {badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
    </View>
  );
});

/** The room you're in, when you're on another tab. Tap to go back to it. */
const RoomCardRow = memo(function RoomCardRow({ colors }: { colors: Colors }) {
  const name = useGroupSessionStore((s) => s.currentGroup?.name ?? 'Room');
  const song = useGroupSessionStore((s) => s.currentItem?.song);
  const listeners = useGroupSessionStore((s) => s.groupMembers.length);
  const artworkUri = song?.image?.[1]?.link || song?.image?.[2]?.link;
  const goRoom = useCallback(() => router.navigate('/(tabs)/group-music'), []);

  return (
    <PressableScale
      onPress={goRoom}
      scaleTo={ROW_PRESS_SCALE}
      style={styles.roomRow}
      accessibilityRole='button'
      accessibilityLabel={`Back to ${name}`}
    >
      <Image
        source={{ uri: artworkUri }}
        style={[styles.artwork, { backgroundColor: colors.raised }]}
        fadeDuration={0}
      />
      <View style={styles.songInfo}>
        <Text style={[styles.songTitle, { color: colors.foreground }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.roomLine}>
          <View style={[styles.livePill, { backgroundColor: colors.live }]}>
            <Text style={[styles.livePillText, { color: colors.liveForeground }]}>LIVE</Text>
          </View>
          <Text
            style={[styles.artistName, styles.roomSong, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {song?.name ?? 'Nothing playing yet'}
          </Text>
        </View>
      </View>
      <Text style={[styles.listeners, { color: colors.mutedForeground }]}>
        {listeners} listening
      </Text>
    </PressableScale>
  );
});

/**
 * The orb stretching over the tabs to show the song: on a new song (for a few seconds) or when you
 * hold the orb. The mask's width grows from the orb's (it re-lays-out only itself); the glass
 * inside is full width from the start, so the blur never resizes. Content fades in a beat after
 * the mask starts, so it's never seen squashed. In 250ms, out 180ms, both ease-out.
 */
const Capsule = memo(function Capsule({
  expanded,
  width,
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onOpen,
  onSkip,
  onKeepOpen,
  songId,
  direction,
  glowPlay,
  colors,
}: {
  expanded: boolean;
  width: number;
  currentSong: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onOpen: () => void;
  onSkip: (dir: 'next' | 'prev') => void;
  /** A swipe started: hold the capsule open while the finger is on it. */
  onKeepOpen: () => void;
  songId?: string;
  direction: 'next' | 'prev';
  glowPlay: number;
  colors: Colors;
}) {
  // Swipe anywhere on the open capsule, like the old card: sideways skips (the song follows your
  // finger and the next one comes in from that side), up opens the full player.
  const x = useSharedValue(0);
  const axis = useSharedValue(0); // 0 undecided, 1 sideways, 2 up
  const startX = useSharedValue(0);
  const skipped = useSharedValue(false);
  useLayoutEffect(() => {
    x.set(0);
  }, [songId, x]);
  const swipe = Gesture.Pan()
    .enabled(expanded)
    .hitSlop({ left: -(EDGE_GUARD - DECK_SIDE), right: -(EDGE_GUARD - DECK_SIDE) })
    .activeOffsetX([-10, 10])
    .activeOffsetY([-14, 1000])
    .onBegin((e) => {
      axis.set(0);
      skipped.set(false);
      startX.set(e.absoluteX);
    })
    .onStart(() => {
      scheduleOnRN(onKeepOpen);
    })
    .onUpdate((e) => {
      const dx = e.absoluteX - startX.get();
      if (axis.get() === 0 && Math.max(Math.abs(dx), Math.abs(e.translationY)) >= 6) {
        axis.set(Math.abs(dx) > Math.abs(e.translationY) ? 1 : 2);
      }
      if (axis.get() === 1) x.set(dx * 0.6);
    })
    .onEnd((e, success) => {
      if (!success) return;
      const dx = e.absoluteX - startX.get();
      const sideways =
        axis.get() === 1 || (axis.get() === 0 && Math.abs(e.velocityX) > Math.abs(e.velocityY));
      if (sideways) {
        if (!isSkipSwipe(dx, e.velocityX, width)) return;
        const forward = dx < 0;
        skipped.set(true);
        x.set(
          withSequence(
            withTiming(forward ? -SKIP_OUT : SKIP_OUT, SKIP_OUT_TIMING),
            withDelay(SKIP_RETURN_DELAY_MS, withSpring(0, SPRING_PRESS))
          )
        );
        scheduleOnRN(onSkip, forward ? 'next' : 'prev');
      } else if (e.translationY < -SWIPE_OPEN_DISTANCE || e.velocityY < -SWIPE_OPEN_VELOCITY) {
        scheduleOnRN(onOpen);
      }
    })
    .onFinalize(() => {
      if (!skipped.get()) x.set(withSpring(0, SPRING_PRESS));
    });
  const songStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.get()), [0, 90, SKIP_OUT], [1, 0.35, 0], 'clamp'),
    transform: [{ translateX: x.get() }],
  }));

  const maskW = useSharedValue(PILL_HEIGHT);
  const maskOpacity = useSharedValue(0);
  const content = useSharedValue(0);

  useEffect(() => {
    if (width <= 0) return;
    if (expanded) {
      maskOpacity.set(withTiming(1, CAPSULE_SHOW));
      maskW.set(withTiming(width, CAPSULE_OPEN));
      content.set(withDelay(80, withTiming(1, CAPSULE_CONTENT_IN)));
    } else {
      content.set(withTiming(0, CAPSULE_CONTENT_OUT));
      maskW.set(withTiming(PILL_HEIGHT, CAPSULE_CLOSE));
      maskOpacity.set(withDelay(CAPSULE_CLOSE.duration - 60, withTiming(0, CAPSULE_SHOW)));
    }
  }, [expanded, width, maskW, maskOpacity, content]);

  const maskStyle = useAnimatedStyle(() => ({ width: maskW.get(), opacity: maskOpacity.get() }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.get(),
    // Out of the orb on the way in, back toward it on the way out.
    transform: [{ translateX: (1 - content.get()) * -14 }],
  }));

  const artist =
    currentSong?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((a: any) => a.name)
      .join(', ') || 'Unknown Artist';

  if (width <= 0) return null;

  return (
    <Animated.View
      pointerEvents={expanded ? 'box-none' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      style={[styles.capsuleMask, maskStyle]}
    >
      <GestureDetector gesture={swipe}>
        <View style={{ width, height: PILL_HEIGHT }}>
          <GlassSurface radius={PILL_HEIGHT / 2} style={styles.fill}>
            <Animated.View style={[styles.capsuleContent, contentStyle]}>
              <PressableScale
                onPress={onOpen}
                scaleTo={ROW_PRESS_SCALE}
                style={styles.capsuleMeta}
                accessibilityRole='button'
                accessibilityLabel={`Open player: ${currentSong?.name ?? ''}`}
              >
                <Animated.View key={songId} entering={SONG_ENTER[direction]}>
                  <Animated.View style={songStyle}>
                    <Text
                      style={[styles.songTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {currentSong?.name}
                    </Text>
                    <Text
                      style={[styles.artistName, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {artist}
                    </Text>
                  </Animated.View>
                </Animated.View>
              </PressableScale>
              <PressableScale
                onPress={onPlayPause}
                scaleTo={BUTTON_PRESS_SCALE}
                hitSlop={6}
                accessibilityRole='button'
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                style={styles.miniControl}
              >
                {isPlaying ? (
                  <PauseIcon size={24} color={colors.foreground} />
                ) : (
                  <PlayIcon size={24} color={colors.foreground} />
                )}
              </PressableScale>
              <PressableScale
                onPress={onNext}
                scaleTo={BUTTON_PRESS_SCALE}
                hitSlop={6}
                accessibilityRole='button'
                accessibilityLabel='Next song'
                style={styles.miniControl}
              >
                <NextIcon size={22} color={colors.foreground} />
              </PressableScale>
            </Animated.View>
          </GlassSurface>
          <GlowSweep
            width={width}
            height={PILL_HEIGHT}
            radius={PILL_HEIGHT / 2}
            colors={colors.gradients.primary}
            play={glowPlay}
            delay={120}
          />
        </View>
      </GestureDetector>
    </Animated.View>
  );
});

/** The optional card above the tabs (Settings → Player card): your song, or the room. */
const DeckCard = memo(function DeckCard({ children }: { children: React.ReactNode }) {
  return (
    <GlassSurface radius={20} style={styles.card}>
      {children}
    </GlassSurface>
  );
});

type UnifiedBottomDeckProps = {
  colors: Colors;
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
  const fullPlayerOpen = useFullPlayerOpen((s) => s.open);

  const goHome = useCallback(() => router.navigate('/(tabs)/home'), []);
  const goGroup = useCallback(() => router.navigate('/(tabs)/group-music'), []);
  const goPlaylist = useCallback(() => router.navigate('/(tabs)/playlist'), []);
  const goChat = useCallback(() => router.navigate('/(tabs)/chat'), []);
  const handlers = useMemo(
    () => [goHome, goGroup, goPlaylist, goChat],
    [goHome, goGroup, goPlaylist, goChat]
  );

  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const roomSong = useGroupSessionStore((s) => s.currentItem?.song);
  const unread = useChatStore(selectUnreadTotal);
  const showCard = useDeckStore((s) => s.showCard);
  const songPopup = useDeckStore((s) => s.songPopup);

  // In a room the room owns playback; your own song waits on Home under the room card.
  const showSong = !inRoom && activePlayerMode === 'normal' && !!currentSong;
  const orbKind: OrbKind = showSong ? 'song' : inRoom ? 'room' : 'idle';
  const onRoomTab = activeSegment === 'group-music';
  // On the Rooms tab the room is already on screen, so there's no card for it.
  const cardKind = !showCard ? null : showSong ? 'song' : inRoom && !onRoomTab ? 'room' : null;

  const artworkUri = showSong
    ? currentSong?.image?.[1]?.link || currentSong?.image?.[2]?.link
    : roomSong?.image?.[1]?.link || roomSong?.image?.[2]?.link;

  // Which way the song changed, so the orb's new artwork enters from the side it was sent.
  // Only one step back is "previous"; auto-advance and jumps read as next.
  const queueIndex = usePlayerStore((s) =>
    s.currentSong ? s.playlist.findIndex((i) => i.id === s.currentSong?.id) : -1
  );
  const songId: string | undefined = showSong ? currentSong?.id : roomSong?.id;

  // The capsule: out for a few seconds when the song changes, or while you hold the orb. Each
  // `key` restarts its timer. Changes below are worked out while rendering, like `direction`.
  const [capsule, setCapsule] = useState({ on: false, ms: 0, key: 0 });
  const [glowPlay, setGlowPlay] = useState(0);
  const expanded = capsule.on;
  const expand = useCallback(
    (ms: number) => setCapsule((c) => ({ on: true, ms, key: c.key + 1 })),
    []
  );
  const collapse = useCallback(() => setCapsule((c) => (c.on ? { ...c, on: false } : c)), []);
  useEffect(() => {
    if (!capsule.on) return;
    const t = setTimeout(() => setCapsule((c) => ({ ...c, on: false })), capsule.ms);
    return () => clearTimeout(t);
  }, [capsule.on, capsule.ms, capsule.key]);

  const [shown, setShown] = useState({ id: songId, index: queueIndex });
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  if (shown.id !== songId || shown.index !== queueIndex) {
    if (shown.id !== songId) {
      setDirection(queueIndex === shown.index - 1 ? 'prev' : 'next');
      // A new song (not the first one this deck sees): show it, with one sweep of light.
      if (showSong && shown.id !== undefined && !fullPlayerOpen && !showCard && songPopup) {
        setCapsule((c) => ({ on: true, ms: SHOW_SONG_MS, key: c.key + 1 }));
        setGlowPlay((n) => n + 1);
      }
    }
    setShown({ id: songId, index: queueIndex });
  }

  // Going anywhere, opening the player, or the orb no longer holding your song puts it away.
  const context = `${activeSegment}|${orbKind}|${fullPlayerOpen}`;
  const [lastContext, setLastContext] = useState(context);
  if (lastContext !== context) {
    setLastContext(context);
    if (capsule.on) setCapsule((c) => ({ ...c, on: false }));
    // Nothing playing: the ember orb catches the light once as it appears.
    if (orbKind === 'idle' && !lastContext.includes('|idle|')) setGlowPlay((n) => n + 1);
  }

  const onOrbTap = useCallback(() => {
    if (expanded) collapse();
    else if (orbKind === 'song') openFullPlayer();
    else if (orbKind === 'room') {
      if (!onRoomTab) router.navigate('/(tabs)/group-music');
    } else router.push('/search');
  }, [expanded, collapse, orbKind, onRoomTab]);
  const onOrbHold = useCallback(() => {
    if (orbKind === 'song') expand(HOLD_SONG_MS);
  }, [orbKind, expand]);
  const onSkip = useCallback(
    (dir: 'next' | 'prev') => (dir === 'next' ? handleNextSong() : handlePrevSong(true)),
    [handleNextSong, handlePrevSong]
  );
  const onCapsulePlayPause = useCallback(() => {
    handlePlayPause();
    expand(SHOW_SONG_MS);
  }, [handlePlayPause, expand]);
  const onCapsuleNext = useCallback(() => handleNextSong(), [handleNextSong]);
  const onCapsuleSkip = useCallback(
    (dir: 'next' | 'prev') => {
      expand(SHOW_SONG_MS);
      if (dir === 'next') handleNextSong();
      else handlePrevSong(true);
    },
    [expand, handleNextSong, handlePrevSong]
  );
  const onCapsuleKeepOpen = useCallback(() => expand(SHOW_SONG_MS), [expand]);
  const onCapsuleOpen = useCallback(() => {
    collapse();
    openFullPlayer();
  }, [collapse]);

  const [navWidth, setNavWidth] = useState(0);
  const onNavLayout = useCallback(
    (e: LayoutChangeEvent) => setNavWidth(e.nativeEvent.layout.width),
    []
  );

  // The selected-tab pill: measured from each tab's onLayout (once, not per frame), then slid with
  // translateX. Width follows too (absolute, no children, so it's safe) for a resize or rotation.
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const placed = useRef(false);
  const movePill = useCallback(
    (x: number, width: number) => {
      if (!placed.current) {
        pillX.set(x);
        pillW.set(width);
        placed.current = true;
        return;
      }
      pillX.set(withTiming(x, TAB_MOVE));
      pillW.set(withTiming(width, TAB_MOVE));
    },
    [pillX, pillW]
  );
  const activeRef = useRef(activeSegment);
  useLayoutEffect(() => {
    activeRef.current = activeSegment;
  }, [activeSegment]);
  const onTabLayout = useCallback(
    (name: string, x: number, width: number) => {
      tabLayouts.current[name] = { x, width };
      if (name === activeRef.current) movePill(x, width);
    },
    [movePill]
  );
  useEffect(() => {
    const l = tabLayouts.current[activeSegment];
    if (l) movePill(l.x, l.width);
  }, [activeSegment, movePill]);
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillW.get() > 0 ? 1 : 0,
    transform: [{ translateX: pillX.get() }],
    width: pillW.get(),
  }));

  // The tabs step back while the capsule covers them.
  const tabsShown = useSharedValue(1);
  useEffect(() => {
    tabsShown.set(expanded ? withTiming(0, TABS_HIDE) : withDelay(60, withTiming(1, TABS_HIDE)));
  }, [expanded, tabsShown]);
  const tabsStyle = useAnimatedStyle(() => ({ opacity: tabsShown.get() }));

  return (
    <View
      pointerEvents='box-none'
      style={[styles.deck, { bottom: Math.max(6, insets.bottom) + DECK_BOTTOM_GAP }]}
    >
      {cardKind && (
        <DeckCard>
          {cardKind === 'song' ? (
            <>
              <MiniPlayerRow
                currentSong={currentSong}
                isPlaying={isPlaying}
                handlePlayPause={handlePlayPause}
                handleNextSong={handleNextSong}
                handlePrevSong={handlePrevSong}
                colors={colors}
              />
              <MiniProgressBar color={colors.primary} trackColor={colors.hairline} />
            </>
          ) : (
            <RoomCardRow colors={colors} />
          )}
        </DeckCard>
      )}

      <View style={styles.navLine} onLayout={onNavLayout} pointerEvents='box-none'>
        <View style={styles.orbSlot}>
          <Orb
            kind={orbKind}
            artworkUri={artworkUri}
            songId={songId}
            direction={direction}
            expanded={expanded}
            onTap={onOrbTap}
            onHold={onOrbHold}
            onSkip={onSkip}
            glowPlay={orbKind === 'idle' ? glowPlay : 0}
            colors={colors}
          />
        </View>
        <Animated.View style={[styles.pill, tabsStyle]} pointerEvents={expanded ? 'none' : 'auto'}>
          <GlassSurface
            radius={PILL_HEIGHT / 2}
            style={styles.fill}
            contentStyle={styles.pillInner}
          >
            <Animated.View
              pointerEvents='none'
              style={[styles.tabPill, { backgroundColor: colors.foreground }, pillStyle]}
            />
            {TAB_ITEMS.map((tab, index) => (
              <TabButton
                key={tab.name}
                name={tab.name}
                onTabLayout={onTabLayout}
                onPress={handlers[index]}
                label={tab.label}
                Icon={tab.Icon}
                isFocused={activeSegment === tab.name}
                colors={colors}
                live={tab.name === 'group-music' && inRoom}
                badge={tab.name === 'chat' ? unread : 0}
              />
            ))}
          </GlassSurface>
        </Animated.View>
        {showSong && (
          <Capsule
            expanded={expanded}
            width={navWidth}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlayPause={onCapsulePlayPause}
            onNext={onCapsuleNext}
            onOpen={onCapsuleOpen}
            onSkip={onCapsuleSkip}
            onKeepOpen={onCapsuleKeepOpen}
            songId={songId}
            direction={direction}
            glowPlay={orbKind === 'song' ? glowPlay : 0}
            colors={colors}
          />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  deck: {
    position: 'absolute',
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 1000,
  },
  navLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orbSlot: { zIndex: 3 },
  fill: { flex: 1 },
  capsuleMask: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    zIndex: 2,
  },
  capsuleContent: {
    position: 'absolute',
    left: PILL_HEIGHT + 8,
    right: 6,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  capsuleMeta: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 4, height: '100%' },

  pill: { flex: 1, height: PILL_HEIGHT, zIndex: 1 },
  pillInner: { flexDirection: 'row', alignItems: 'center', padding: 5, gap: 2 },
  tab: { flex: 1, height: '100%' },
  tabIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  tabIconOn: { position: 'absolute' },
  tabPill: { position: 'absolute', left: 0, top: 5, bottom: 5, borderRadius: 999 },
  tabPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badge: {
    position: 'absolute',
    top: -6,
    left: 14,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liveDot: { position: 'absolute', top: -1, right: -2, width: 7, height: 7, borderRadius: 4 },

  orb: { width: PILL_HEIGHT, height: PILL_HEIGHT },
  orbInner: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -0.5, left: -0.5 },
  orbArtBox: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  orbArt: { width: 44, height: 44 },
  orbIdle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: { height: 58 },

  progressTrack: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    transformOrigin: 'left',
  },

  miniRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 4,
  },
  miniSong: { flex: 1, minWidth: 0, height: '100%' },
  miniSongEnter: { flex: 1 },
  miniSongInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 11,
  },
  songInfo: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 11,
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

  roomRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 14,
  },
  roomLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  roomSong: { flex: 1, marginTop: 0 },
  livePill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  livePillText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  listeners: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
