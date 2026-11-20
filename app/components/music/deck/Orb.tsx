import { SearchMusicIcon } from '@/components/icons/NavIcons';
import GlassSurface from '@/components/shell/GlassSurface';
import GlowSweep from '@/components/shell/GlowSweep';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, PRESS_IN, SPRING_PRESS } from '@/lib/motion';
import { EDGE_GUARD } from '@/lib/swipe';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useFullPlayerOpen } from '@/stores/playerStore';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CachedImage } from '@/components/ui/CachedImage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  Keyframe,
  LayoutAnimationConfig,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import {
  CAPSULE_CLOSE,
  DECK_SIDE,
  ORB_ART,
  PILL_HEIGHT,
  SKIP_OUT_TIMING,
  SKIP_RETURN_DELAY_MS,
} from './constants';
import { RoomOrbRing, SongOrbRing } from './OrbRing';

type Colors = ReturnType<typeof useTheme>['colors'];

export type OrbKind = 'song' | 'room' | 'idle';
export type OrbBadge = 'check' | 'monitor' | 'smartphone' | 'wifi-off';

/** A skipped song's artwork leaves the orb this far, faded out by then. */
const SKIP_OUT_ORB = 40;
const PRESS_OUT = { duration: 150, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;

/**
 * A song lands in the orb: the orb dips a little and springs back. Nothing leaves the orb, so it
 * never reads as a tap on something else.
 */
const ORB_DIP = 0.96;
const ORB_DIP_IN = { duration: 60, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const ORB_DIP_OUT = {
  duration: 300,
  dampingRatio: 0.55,
  reduceMotion: ReduceMotion.System,
} as const;
/**
 * A new cover turns in like a record, a quarter turn the way it was sent, sliding in from that
 * side as it turns so the two read as one movement.
 */
const turnIn = (from: string, dx: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateX: dx }, { rotate: from }] },
    45: { opacity: 1, easing: Easing.out(Easing.cubic) },
    100: { transform: [{ translateX: 0 }, { rotate: '0deg' }], easing: Easing.out(Easing.cubic) },
  })
    .duration(380)
    .reduceMotion(ReduceMotion.System);
const ORB_TURN_IN = { next: turnIn('-90deg', 14), prev: turnIn('90deg', -14) } as const;
/** The orb holds something new (music starts, a room, back to your song): it opens from the centre. */
const ORB_OPEN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.4 }] },
  40: { opacity: 1, easing: Easing.out(Easing.cubic) },
  100: { transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
})
  .duration(340)
  .reduceMotion(ReduceMotion.System);

/**
 * The badge on the orb: the device playing when it isn't this phone (for as long as it is), a
 * check for a moment once synced, or the room you're in. It grows in from a little smaller,
 * without overshoot, a beat after the ring starts drawing; a different icon cross-fades inside.
 */
const BADGE_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
})
  .duration(220)
  .delay(120)
  .reduceMotion(ReduceMotion.System);
const BADGE_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.6 }], easing: Easing.in(Easing.cubic) },
})
  .duration(160)
  .reduceMotion(ReduceMotion.System);
const BADGE_ICON_IN = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
const BADGE_ICON_OUT = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

/**
 * Playing, the cover turns slowly like a record; paused, it eases to a stop, a touch smaller and
 * dimmer. Starting, it gathers speed over half a second: an ease-in quadratic ends at exactly
 * the turning speed, so the hand-over to the steady turn has no jolt. The stop carries on about
 * as far as the record would coast.
 */
const RECORD_TURN_MS = 8000;
const SPIN_UP = { duration: 500, easing: Easing.in(Easing.quad) } as const;
const SPIN_UP_DEG = (360 / RECORD_TURN_MS) * (SPIN_UP.duration / 2);
const RECORD_COAST = { duration: 600, easing: EASE_OUT } as const;
const RECORD_COAST_DEG = (360 / RECORD_TURN_MS) * (RECORD_COAST.duration / 2);
const PAUSED_ART_SCALE = 0.9;
const PAUSED_ART_OPACITY = 0.6;
const PLAY_STATE = { duration: 280, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
/** Back to full size as the music starts, with a little lift. */
const PLAY_LIFT = { duration: 360, dampingRatio: 0.65, reduceMotion: ReduceMotion.System } as const;

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
/** A swipe up opens the full player: a short drag, or a shorter flick. */
const ORB_OPEN_DISTANCE = 28;
const ORB_OPEN_FLICK_DISTANCE = 12;
const ORB_OPEN_FLICK_VELOCITY = 500;
/** How far the orb follows your finger up before it opens, as a hint of where it's going. */
const ORB_LIFT_MAX = 14;
const isOrbOpen = (dy: number, vy: number) => {
  'worklet';
  if (vy > ORB_REVERSE_VELOCITY) return false;
  return (
    dy <= -ORB_OPEN_DISTANCE || (dy <= -ORB_OPEN_FLICK_DISTANCE && vy <= -ORB_OPEN_FLICK_VELOCITY)
  );
};
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
 * While you hold, a hairline fills round the orb, ending as the capsule opens. It waits a beat
 * first, so an ordinary tap shows nothing.
 */
const CHARGE_DELAY_MS = 150;
const CHARGE_FILL = {
  duration: ORB_HOLD_MS - CHARGE_DELAY_MS,
  easing: Easing.linear,
  reduceMotion: ReduceMotion.System,
} as const;
const CHARGE_SHOW = { duration: 80, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const CHARGE_HIDE = { duration: 140, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const CHARGE_R = 28.3;
const CHARGE_C = 2 * Math.PI * CHARGE_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Joining a room: one ripple of the live colour spreads from the orb. */
const RIPPLE = { duration: 720, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const RIPPLE_DELAY_MS = 240;

const ChargeRing = memo(function ChargeRing({
  charge,
  shown,
  color,
}: {
  charge: SharedValue<number>;
  shown: SharedValue<number>;
  color: string;
}) {
  const props = useAnimatedProps(() => ({
    strokeDashoffset: CHARGE_C * (1 - charge.get()),
    strokeOpacity: shown.get(),
  }));
  return (
    <View style={styles.ring} pointerEvents='none'>
      <Svg width={58} height={58} viewBox='0 0 58 58'>
        <AnimatedCircle
          cx={29}
          cy={29}
          r={CHARGE_R}
          stroke={color}
          strokeWidth={1.4}
          strokeLinecap='round'
          fill='none'
          strokeDasharray={CHARGE_C}
          animatedProps={props}
          transform='rotate(-90 29 29)'
        />
      </Svg>
    </View>
  );
});

type OrbProps = {
  kind: OrbKind;
  artworkUri?: string;
  songId?: string;
  direction: 'next' | 'prev';
  expanded: boolean;
  onTap: () => void;
  /** Swipe up: the full player (or the room, or Search). */
  onOpen: () => void;
  onHold: () => void;
  onSkip: (dir: 'next' | 'prev') => void;
  glowPlay: number;
  colors: Colors;
  syncing: boolean;
  badge: OrbBadge | null;
  /** Your own song is playing (the room's state is read here). */
  playing: boolean;
  /** The app just opened: the ring draws round once the deck has risen into place. */
  entering?: boolean;
  /** False while the app is in the background: a new song just appears, without its entrance. */
  animate?: boolean;
};

/**
 * The round button left of the tabs: what's playing (your song or the room's), or Search when
 * nothing is. With your song, tap plays or pauses and a swipe up opens the full player; the room's
 * orb and Search open on either. Hold shows the capsule. Swipe sideways to skip: the artwork
 * follows your finger, and the next one slides in from the side you swiped.
 */
export const Orb = memo(function Orb({
  kind,
  artworkUri,
  songId,
  direction,
  expanded,
  onTap,
  onOpen,
  onHold,
  onSkip,
  glowPlay,
  colors,
  syncing,
  badge,
  playing,
  entering = false,
  animate = true,
}: OrbProps) {
  const roomPlaying = useGroupPlaybackStore((s) => s.isPlaying);
  const isPlaying = kind === 'room' ? roomPlaying : kind === 'song' && playing;

  // How the next cover comes in, worked out while rendering so it's right on its first frame:
  // the orb holding something new opens from the centre, a new song turns in the way it was sent.
  const [seen, setSeen] = useState({ kind, songId });
  const [enter, setEnter] = useState<'open' | 'next' | 'prev' | 'none'>(direction);
  const [kindChanged, setKindChanged] = useState(false);
  if (seen.kind !== kind || seen.songId !== songId) {
    if (!animate) {
      // In the background nobody sees it; animating then only plays it late, on return.
      setEnter('none');
      setKindChanged(false);
    } else if (seen.kind !== kind) {
      setEnter('open');
      setKindChanged(true);
    } else setEnter(direction);
    setSeen({ kind, songId });
  }

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const skipped = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lift = useSharedValue(0);
  /** Which way this drag goes, fixed by its first clear movement: 0 not yet, 1 sideways, 2 up. */
  const axis = useSharedValue(0);

  // Its own value, so a landing never fights the press scale.
  const landScale = useSharedValue(1);
  const dip = useCallback(
    (delay: number) => {
      landScale.set(
        withDelay(delay, withSequence(withTiming(ORB_DIP, ORB_DIP_IN), withSpring(1, ORB_DIP_OUT)))
      );
    },
    [landScale]
  );

  // The capsule lands back in the orb.
  const wasExpanded = useRef(expanded);
  useEffect(() => {
    if (wasExpanded.current && !expanded) dip(CAPSULE_CLOSE.duration - 20);
    wasExpanded.current = expanded;
  }, [expanded, dip]);

  // A new song lands in the orb (its cover turns in on its own). Not for the first song shown,
  // and not while the capsule is out: its light sweep says it, and the dip follows when it closes.
  const dippedFor = useRef(songId);
  useEffect(() => {
    if (kind !== 'song' || songId === dippedFor.current) return;
    if (dippedFor.current !== undefined && !expanded && animate) dip(0);
    dippedFor.current = songId;
  }, [expanded, kind, dip, songId, animate]);

  // Joining a room: one ripple of the live colour.
  const ripple = useSharedValue(1);
  const prevKind = useRef(kind);
  useEffect(() => {
    if (kind === 'room' && prevKind.current !== 'room') {
      ripple.set(0);
      ripple.set(withDelay(RIPPLE_DELAY_MS, withTiming(1, RIPPLE)));
    }
    prevKind.current = kind;
  }, [kind, ripple]);
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.get() < 1 ? 0.75 * (1 - ripple.get()) : 0,
    transform: [{ scale: 1 + 0.8 * ripple.get() }],
  }));

  // A new song starts centred; whatever the old one was doing is over.
  useLayoutEffect(() => {
    x.set(0);
  }, [songId, x]);

  const charge = useSharedValue(0);
  const chargeShown = useSharedValue(0);
  const canCharge = useSharedValue(kind === 'song' && !expanded);
  useEffect(() => {
    canCharge.set(kind === 'song' && !expanded);
  }, [kind, expanded, canCharge]);

  // Built only when what it calls changes, not on every render of the deck.
  const canSkip = kind === 'song';
  const gesture = useMemo(() => {
    const base = Gesture.Pan()
      // The first few points of the screen edge belong to Android's back gesture.
      .hitSlop({ left: -(EDGE_GUARD - DECK_SIDE) })
      // Up opens; dragging down is left alone.
      .activeOffsetY(-8)
      .failOffsetY(14);
    // Sideways skips, for your song only.
    const pan = (canSkip ? base.activeOffsetX([-8, 8]) : base.failOffsetX([-14, 14]))
      .onBegin((e) => {
        skipped.set(false);
        axis.set(0);
        startX.set(e.absoluteX);
        startY.set(e.absoluteY);
      })
      .onUpdate((e) => {
        const dx = e.absoluteX - startX.get();
        const dy = e.absoluteY - startY.get();
        if (axis.get() === 0) axis.set(canSkip && Math.abs(dx) > Math.abs(dy) ? 1 : 2);
        if (axis.get() === 1) x.set(dx * 0.5);
        else lift.set(Math.max(-ORB_LIFT_MAX, Math.min(0, dy * 0.4)));
      })
      .onEnd((e, success) => {
        if (!success) return;
        if (axis.get() === 2) {
          if (isOrbOpen(e.absoluteY - startY.get(), e.velocityY)) scheduleOnRN(onOpen);
          return;
        }
        const dx = e.absoluteX - startX.get();
        if (!isOrbSkip(dx, e.velocityX)) return;
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
        lift.set(withSpring(0, SPRING_PRESS));
      });
    const hold = Gesture.LongPress()
      .minDuration(ORB_HOLD_MS)
      .onBegin(() => {
        if (!canCharge.get()) return;
        charge.set(0);
        charge.set(withDelay(CHARGE_DELAY_MS, withTiming(1, CHARGE_FILL)));
        chargeShown.set(withDelay(CHARGE_DELAY_MS, withTiming(1, CHARGE_SHOW)));
      })
      .onStart(() => {
        scale.set(withTiming(1, PRESS_OUT));
        chargeShown.set(withTiming(0, CHARGE_HIDE));
        scheduleOnRN(onHold);
      })
      .onFinalize(() => {
        chargeShown.set(withTiming(0, CHARGE_HIDE));
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
    return Gesture.Race(pan, hold, tap);
  }, [
    canSkip,
    canCharge,
    charge,
    chargeShown,
    onHold,
    onOpen,
    onSkip,
    onTap,
    scale,
    skipped,
    startX,
    startY,
    lift,
    axis,
    x,
  ]);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.get() }, { scale: scale.get() * landScale.get() }],
  }));

  // The record: turns while the music plays and the orb is in view, coasts to a stop on pause.
  const reduceMotion = useReducedMotion();
  const covered = useFullPlayerOpen((st) => st.open);
  const spinning = kind !== 'idle' && isPlaying && !covered && !reduceMotion;
  const angle = useSharedValue(0);
  useEffect(() => {
    const from = angle.get() % 360;
    cancelAnimation(angle);
    angle.set(from);
    if (spinning) {
      const steady = from + SPIN_UP_DEG;
      angle.set(
        withTiming(steady, SPIN_UP, (finished) => {
          'worklet';
          // Repeats from where it is, so a turn ends where the next begins.
          if (finished) {
            angle.set(
              withRepeat(
                withTiming(steady + 360, { duration: RECORD_TURN_MS, easing: Easing.linear }),
                -1
              )
            );
          }
        })
      );
    } else if (!reduceMotion) {
      angle.set(withTiming(from + RECORD_COAST_DEG, RECORD_COAST));
    }
  }, [spinning, reduceMotion, angle]);

  const pausedLook = useSharedValue(kind !== 'idle' && !isPlaying ? 1 : 0);
  useEffect(() => {
    const paused = kind !== 'idle' && !isPlaying;
    pausedLook.set(paused ? withTiming(1, PLAY_STATE) : withSpring(0, PLAY_LIFT));
  }, [kind, isPlaying, pausedLook]);
  const pausedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pausedLook.get(), [0, 1], [1, PAUSED_ART_OPACITY], 'clamp'),
    // Not clamped: the spring's overshoot lifts the cover a touch past full size.
    transform: [{ scale: interpolate(pausedLook.get(), [0, 1], [1, PAUSED_ART_SCALE]) }],
  }));
  // Innermost, so a swipe still slides the cover straight sideways whatever its angle.
  const turnStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  const artStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(x.get()), [0, 30, SKIP_OUT_ORB], [1, 0.5, 0], 'clamp'),
    transform: [{ translateX: x.get() }],
  }));

  const label =
    kind === 'idle' ? 'Search' : kind === 'room' ? 'Back to room' : isPlaying ? 'Pause' : 'Play';

  // The room wears its own badge, the Rooms icon in the theme's live colour. The icon is what
  // says "a room": in Mono the live colour is the same as the accent, so colour alone can't.
  const shownBadge = kind === 'room' ? 'radio' : kind === 'song' ? badge : null;
  const badgeLook =
    shownBadge === 'radio'
      ? { box: colors.live, icon: colors.liveForeground }
      : shownBadge === 'wifi-off'
        ? { box: colors.muted, icon: colors.mutedForeground }
        : { box: colors.foreground, icon: colors.background };
  // Draw the ring round as it appears, except when the deck just comes back (after the keyboard).
  const drawIn = entering || kindChanged;
  const drawDelay = kindChanged ? 120 : 380;

  return (
    <LayoutAnimationConfig skipEntering>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={pressStyle}
          accessible
          accessibilityRole='button'
          accessibilityLabel={label}
          accessibilityHint={
            kind === 'song'
              ? 'Swipe up to open the player, left or right to change song'
              : undefined
          }
          accessibilityActions={
            kind === 'song'
              ? [
                  { name: 'activate' },
                  { name: 'open', label: 'Open player' },
                  { name: 'longpress', label: 'Show song and controls' },
                  { name: 'next', label: 'Next song' },
                  { name: 'previous', label: 'Previous song' },
                ]
              : [{ name: 'activate' }]
          }
          onAccessibilityAction={(e) => {
            const a = e.nativeEvent.actionName;
            if (a === 'activate') onTap();
            else if (a === 'open') onOpen();
            else if (a === 'longpress') onHold();
            else if (a === 'next') onSkip('next');
            else if (a === 'previous') onSkip('prev');
          }}
        >
          <Animated.View
            pointerEvents='none'
            style={[styles.ripple, { borderColor: colors.live }, rippleStyle]}
          />
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
                {kind === 'song' ? (
                  <SongOrbRing
                    key='song'
                    color={colors.primary}
                    trackColor={colors.hairline}
                    syncing={syncing}
                    drawIn={drawIn}
                    drawDelay={drawDelay}
                  />
                ) : (
                  <RoomOrbRing
                    key='room'
                    color={colors.live}
                    trackColor={colors.hairline}
                    syncing={false}
                    drawIn={drawIn}
                    drawDelay={drawDelay}
                  />
                )}
                {kind === 'song' && (
                  <ChargeRing charge={charge} shown={chargeShown} color={colors.primary} />
                )}
                <Animated.View style={[styles.orbArtBox, pausedStyle]}>
                  <Animated.View
                    key={`${kind}:${songId}`}
                    entering={
                      enter === 'none'
                        ? undefined
                        : enter === 'open'
                          ? ORB_OPEN
                          : ORB_TURN_IN[enter]
                    }
                    style={styles.orbArt}
                  >
                    <Animated.View style={[styles.orbArt, artStyle]}>
                      <Animated.View style={[styles.orbArt, turnStyle]}>
                        <CachedImage
                          source={{ uri: artworkUri }}
                          style={[styles.orbArt, { backgroundColor: colors.raised }]}
                        />
                      </Animated.View>
                    </Animated.View>
                  </Animated.View>
                </Animated.View>
              </>
            )}
          </GlassSurface>
          {shownBadge && (
            <Animated.View
              entering={BADGE_IN}
              exiting={BADGE_OUT}
              pointerEvents='none'
              style={[
                styles.orbBadge,
                { backgroundColor: badgeLook.box, borderColor: colors.background },
              ]}
            >
              <Animated.View
                key={shownBadge}
                entering={BADGE_ICON_IN}
                exiting={BADGE_ICON_OUT}
                style={styles.orbBadgeIcon}
              >
                <Feather
                  name={shownBadge}
                  size={shownBadge === 'check' || shownBadge === 'radio' ? 11 : 10}
                  color={badgeLook.icon}
                />
              </Animated.View>
            </Animated.View>
          )}
          <GlowSweep
            width={PILL_HEIGHT}
            height={PILL_HEIGHT}
            radius={PILL_HEIGHT / 2}
            colors={colors.gradients.primary}
            play={glowPlay}
          />
        </Animated.View>
      </GestureDetector>
    </LayoutAnimationConfig>
  );
});

const styles = StyleSheet.create({
  orb: { width: PILL_HEIGHT, height: PILL_HEIGHT },
  orbInner: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: -0.5, left: -0.5 },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 2,
  },
  orbBadgeIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbArtBox: { width: ORB_ART, height: ORB_ART, borderRadius: ORB_ART / 2, overflow: 'hidden' },
  orbArt: { width: ORB_ART, height: ORB_ART },
  orbIdle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
