import { usePlayerProgress } from '@/hooks/usePlayerProgress';
import { EASE_OUT } from '@/lib/motion';
import { LANDED, playerOpenness } from '@/lib/playerMorph';
import { useFullPlayerOpen } from '@/stores/playerStore';
import { useProgress } from '@rntp/player';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const RING_R = 26.5;
const RING_C = 2 * Math.PI * RING_R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The ring drawing round to the song's position: as the player lands back in the orb, or as it appears. */
const RING_DRAW = { duration: 480, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const RING_TRACK_IN = {
  duration: 160,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
/** A skip or a seek: the ring moves there (unwinding to the start on a new song) instead of jumping. */
const RING_JUMP = { duration: 280, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
/** A song that played to the end: its finished lap fades while the next one starts from the top. */
const LAP_FADE = { duration: 420, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const LAP_DONE = 0.97;

/** Syncing with your other devices: a short arc circling the orb, about a turn a second. */
const SPIN_ARC = 0.22;
const SPIN_TURN = {
  duration: 900,
  easing: Easing.linear,
  reduceMotion: ReduceMotion.System,
} as const;
const SPIN_OUT = { duration: 160, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;

type RingProps = {
  color: string;
  trackColor: string;
  syncing: boolean;
  /** Draw round from 12 o'clock as it appears (first launch, or the orb changing what it holds). */
  drawIn: boolean;
  drawDelay?: number;
};

/** Progress round the orb, with the card's glide. While syncing, a circling arc instead. */
const RingView = memo(function RingView({
  fraction,
  duration,
  color,
  trackColor,
  syncing,
  drawIn,
  drawDelay = 0,
}: RingProps & { fraction: number; duration: number }) {
  const shown = useSharedValue(fraction);
  const lap = useSharedValue(0);
  const covered = useFullPlayerOpen((s) => s.open);

  useEffect(() => {
    const was = shown.get();
    // Under the full player nobody sees it, and its glide would update a view on every frame.
    if (covered) {
      shown.set(fraction);
      return;
    }
    if (fraction >= was && (fraction - was) * duration < 2.5) {
      // A normal tick glides between the 1 s updates.
      shown.set(withTiming(fraction, { duration: 1000, easing: Easing.linear }));
    } else if (was >= LAP_DONE && fraction < 0.05) {
      lap.set(1);
      lap.set(withTiming(0, LAP_FADE));
      shown.set(fraction);
    } else {
      shown.set(withTiming(fraction, RING_JUMP));
    }
  }, [covered, fraction, duration, shown, lap]);

  // 1 when the ring is fully drawn. Hidden while the player covers the orb, then drawn from
  // 12 o'clock to the song's position as the player lands.
  const drawn = useSharedValue(drawIn ? 0 : 1);
  const trackIn = useSharedValue(drawIn ? 0 : 1);
  // Only as it appears; later changes of `drawIn` don't redraw it.
  const drewIn = useRef(!drawIn);
  useEffect(() => {
    if (drewIn.current) return;
    drewIn.current = true;
    trackIn.set(withDelay(drawDelay, withTiming(1, RING_TRACK_IN)));
    drawn.set(withDelay(drawDelay + 20, withTiming(1, RING_DRAW)));
  }, [drawDelay, drawn, trackIn]);
  useAnimatedReaction(
    () => playerOpenness.get() < LANDED,
    (landed, wasLanded) => {
      if (landed === wasLanded || wasLanded === null) return;
      if (landed) {
        trackIn.set(withTiming(1, RING_TRACK_IN));
        drawn.set(withTiming(1, RING_DRAW));
      } else {
        trackIn.set(0);
        drawn.set(0);
      }
    }
  );

  // Syncing: the progress arc gives way to a circling one. Done: the progress draws back in.
  const spin = useSharedValue(0);
  const spinIn = useSharedValue(0);
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (syncing === wasSyncing.current) return;
    wasSyncing.current = syncing;
    if (syncing) {
      spin.set(0);
      spin.set(withRepeat(withTiming(360, SPIN_TURN), -1, false));
      spinIn.set(withTiming(1, RING_TRACK_IN));
      drawn.set(0);
    } else {
      spinIn.set(withTiming(0, SPIN_OUT, (finished) => finished && cancelAnimation(spin)));
      drawn.set(withTiming(1, RING_DRAW));
    }
  }, [syncing, spin, spinIn, drawn]);
  const spinStyle = useAnimatedStyle(() => ({
    opacity: spinIn.get(),
    transform: [{ rotate: `${spin.get()}deg` }],
  }));

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - shown.get() * drawn.get()),
    // A round cap draws a dot even at zero length.
    strokeOpacity: shown.get() * drawn.get() > 0.002 ? 1 : 0,
  }));
  const lapProps = useAnimatedProps(() => ({ strokeOpacity: lap.get() }));
  const trackStyle = useAnimatedStyle(() => ({ opacity: trackIn.get() }));

  return (
    <Animated.View style={[styles.ring, trackStyle]} pointerEvents='none'>
      <Svg width={58} height={58} viewBox='0 0 58 58'>
        <Circle cx={29} cy={29} r={RING_R} stroke={trackColor} strokeWidth={2.5} fill='none' />
        <AnimatedCircle
          cx={29}
          cy={29}
          r={RING_R}
          stroke={color}
          strokeWidth={2.5}
          fill='none'
          animatedProps={lapProps}
        />
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
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={58} height={58} viewBox='0 0 58 58'>
          <Circle
            cx={29}
            cy={29}
            r={RING_R}
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap='round'
            fill='none'
            strokeDasharray={[RING_C * SPIN_ARC, RING_C]}
            transform='rotate(-90 29 29)'
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
});

const fractionOf = (position: number, duration: number) =>
  duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

/** Your song: this phone's progress, or the other device's while one of yours plays. */
export const SongOrbRing = memo(function SongOrbRing(props: RingProps) {
  const { position, duration } = usePlayerProgress();
  return <RingView {...props} fraction={fractionOf(position, duration)} duration={duration} />;
});

/**
 * A room's song. This phone plays the room through the native player, so its progress is the
 * room's; your other devices' playback has nothing to do with it.
 */
export const RoomOrbRing = memo(function RoomOrbRing(props: RingProps) {
  const { position, duration } = useProgress();
  return <RingView {...props} fraction={fractionOf(position, duration)} duration={duration} />;
});

const styles = StyleSheet.create({
  ring: { position: 'absolute', top: -0.5, left: -0.5 },
});
