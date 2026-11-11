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
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import {
  BUTTON_PRESS_SCALE,
  EASE_IN_OUT,
  EASE_OUT,
  ROW_PRESS_SCALE,
  SPRING_PRESS,
} from '@/lib/motion';
import { EDGE_GUARD, isSkipSwipe, SWIPE_ACTIVATE, SWIPE_DIRECTION_DECIDED } from '@/lib/swipe';
import { selectUnreadTotal, useChatStore } from '@/stores/chatStore';
import { useDeckStore, type DeckCardKind } from '@/stores/deckStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import {
  openFullPlayer,
  useFullPlayerOpen,
  usePlaybackState,
  usePlayerControls,
  usePlayerStore,
} from '@/stores/playerStore';
import { useProgress } from '@rntp/player';
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
  useReducedMotion,
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
  const { position, duration } = useProgress();
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

const EASE = cubicBezier(0.23, 1, 0.32, 1);
// Reanimated CSS transitions: state-driven, so nothing runs until the value changes.
const ORB_ART_TRANSITION = {
  transitionProperty: 'transform',
  transitionDuration: 160,
  transitionTimingFunction: EASE,
} as const;
const CARD_TRANSITION = {
  transformOrigin: '12% 100%',
  transitionProperty: ['opacity', 'transform'],
  transitionTimingFunction: EASE,
} as const;
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
  const { position, duration } = useProgress();
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
 * The round button left of the tabs. It holds what's playing (your song or the room) and shows or
 * hides the card above the tabs; with nothing playing it's Search.
 */
const Orb = memo(function Orb({
  kind,
  artworkUri,
  open,
  onPress,
  disabled,
  colors,
}: {
  kind: OrbKind;
  artworkUri?: string;
  open: boolean;
  onPress: () => void;
  disabled?: boolean;
  colors: Colors;
}) {
  const label =
    kind === 'idle'
      ? 'Search'
      : open
        ? 'Hide player'
        : kind === 'room'
          ? 'Show room'
          : 'Show player';

  return (
    <PressableScale
      onPress={onPress}
      onLongPress={kind === 'song' ? openFullPlayer : undefined}
      disabled={disabled}
      scaleTo={BUTTON_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={kind === 'idle' ? undefined : { expanded: open }}
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
            <Animated.View
              style={[
                styles.orbArtBox,
                // Settles in a touch while the card is out: the orb and the card read as a pair.
                { transform: [{ scale: open ? 0.9 : 1 }] },
                ORB_ART_TRANSITION,
              ]}
            >
              <Image
                source={{ uri: artworkUri }}
                style={[styles.orbArt, { backgroundColor: colors.raised }]}
                fadeDuration={0}
              />
            </Animated.View>
          </>
        )}
      </GlassSurface>
    </PressableScale>
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
 * The floating card. The orb shows and hides it: a short ease-out fade and lift toward the orb
 * (200ms in, 140ms out), transform and opacity only, never the blur itself. Reduce Motion keeps
 * just the fade.
 */
const DeckCard = memo(function DeckCard({
  kind,
  open,
  children,
}: {
  kind: DeckCardKind;
  open: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      key={kind}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[
        CARD_TRANSITION,
        {
          opacity: open ? 1 : 0,
          transform: reduced ? [] : [{ translateY: open ? 0 : 10 }, { scale: open ? 1 : 0.96 }],
          transitionDuration: open ? 200 : 140,
        },
      ]}
    >
      <GlassSurface radius={20} style={styles.card}>
        {children}
      </GlassSurface>
    </Animated.View>
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
  const open = useDeckStore((s) => s.open);
  const toggle = useDeckStore((s) => s.toggle);

  // In a room the room owns playback; your own song waits on Home under the room card.
  const showSong = !inRoom && activePlayerMode === 'normal' && !!currentSong;
  const orbKind: OrbKind = showSong ? 'song' : inRoom ? 'room' : 'idle';
  const onRoomTab = activeSegment === 'group-music';
  // On the Rooms tab the room is already on screen, so there's no card for it.
  const cardKind: DeckCardKind | null = showSong ? 'song' : inRoom && !onRoomTab ? 'room' : null;
  const cardOpen = cardKind ? open[cardKind] : false;

  const artworkUri = showSong
    ? currentSong?.image?.[1]?.link || currentSong?.image?.[2]?.link
    : roomSong?.image?.[1]?.link || roomSong?.image?.[2]?.link;

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

  const onOrb = useCallback(() => {
    if (orbKind === 'idle') router.push('/search');
    else toggle(orbKind);
  }, [orbKind, toggle]);

  return (
    <View
      pointerEvents='box-none'
      style={[styles.deck, { bottom: Math.max(6, insets.bottom) + DECK_BOTTOM_GAP }]}
    >
      {cardKind && (
        <DeckCard kind={cardKind} open={cardOpen}>
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

      <View style={styles.navLine}>
        <Orb
          kind={orbKind}
          artworkUri={artworkUri}
          open={cardOpen}
          onPress={onOrb}
          disabled={orbKind === 'room' && onRoomTab}
          colors={colors}
        />
        <GlassSurface radius={PILL_HEIGHT / 2} style={styles.pill} contentStyle={styles.pillInner}>
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

  pill: { flex: 1, height: PILL_HEIGHT },
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
