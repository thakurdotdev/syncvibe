import { useTheme } from '@/context/ThemeContext';
import { EASE_OUT, SPRING_PRESS } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How far your finger moves to go one word along. */
const DRAG_PER_WORD = 95;
const RESTING_SCALE = 0.6;
const RESTING_OPACITY = 0.34;
const WORD_GAP = 14;
/** How far a flick carries the dial, in words for each 1000dp/s. */
const FLICK_CARRY = 2.2;
const HINT_KEY = 'syncvibe_vibe_dial_hint_seen';
const HINT_DELAY_MS = 900;
const HINT_DISTANCE = 0.22;
const HINT_MOTION = { duration: 260, easing: EASE_OUT, reduceMotion: ReduceMotion.Never } as const;
const SETTLE = { ...SPRING_PRESS, duration: 300 } as const;
const JUMP = { duration: 240, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;

type DialLayout = { x: number[]; scale: number[]; opacity: number[] };

const DialWord = memo(function DialWord({
  title,
  index,
  layout,
  onMeasure,
}: {
  title: string;
  index: number;
  layout: SharedValue<DialLayout>;
  onMeasure: (index: number, width: number) => void;
}) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const now = layout.get();
    return {
      opacity: now.opacity[index] ?? 0,
      transform: [{ translateX: now.x[index] ?? 0 }, { scale: now.scale[index] ?? RESTING_SCALE }],
    };
  });

  return (
    <Animated.Text
      numberOfLines={1}
      onLayout={(e) => onMeasure(index, e.nativeEvent.layout.width)}
      accessibilityRole='tab'
      style={[styles.word, { color: colors.foreground }, style]}
    >
      {title}
    </Animated.Text>
  );
});

/**
 * The page's title is its control: drag the big word and the next one grows into its place. It
 * runs entirely on the UI thread, so it keeps up with your finger whatever the rest of the screen
 * is doing, and only tells React when the nearest word changes. Words are scaled, never resized,
 * so nothing re-runs layout.
 */
export const VibeDial = memo(function VibeDial({
  titles,
  index,
  onChange,
}: {
  titles: string[];
  index: number;
  onChange: (index: number) => void;
}) {
  const { colors } = useTheme();
  const count = titles.length;
  const position = useSharedValue(index);
  const start = useSharedValue(index);
  const nearest = useSharedValue(index);
  const widths = useSharedValue<number[]>([]);
  const measured = useRef<number[]>([]);
  const reported = useRef(index);

  const report = useCallback(
    (next: number) => {
      reported.current = next;
      onChange(next);
    },
    [onChange]
  );

  // Stations can change under the dial, when the language does for instance. Only then: `index`
  // arrives through a low-priority update, so during a drag it's often behind your finger, and
  // following it would pull the dial back.
  const stationList = titles.join('|');
  useEffect(() => {
    if (reported.current === index) return;
    reported.current = index;
    nearest.set(index);
    position.set(withTiming(index, JUMP));
  }, [stationList]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMeasure = useCallback(
    (i: number, width: number) => {
      measured.current[i] = width;
      widths.set(measured.current.slice());
    },
    [widths]
  );

  const layout = useDerivedValue<DialLayout>(() => {
    const at = position.get();
    const sizes = widths.get();
    const scale: number[] = [];
    const opacity: number[] = [];
    const left: number[] = [0];
    for (let i = 0; i < count; i++) {
      const distance = i - at;
      const away = Math.min(1, Math.abs(distance));
      scale[i] = 1 - (1 - RESTING_SCALE) * away;
      opacity[i] = !sizes[i]
        ? 0
        : distance < 0
          ? Math.max(0, 1 + distance * 1.6)
          : 1 - (1 - RESTING_OPACITY) * away;
      left[i + 1] = left[i] + (sizes[i] ?? 0) * scale[i] + WORD_GAP;
    }
    const held = clamp(at, 0, Math.max(0, count - 1));
    const lower = Math.floor(held);
    const upper = Math.min(count - 1, lower + 1);
    const anchor = left[lower] + (left[upper] - left[lower]) * (held - lower);
    return { x: left.slice(0, count).map((value) => value - anchor), scale, opacity };
  });

  const gesture = useMemo(() => {
    const last = Math.max(0, count - 1);

    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart(() => {
        start.set(position.get());
      })
      .onUpdate((e) => {
        const raw = start.get() - e.translationX / DRAG_PER_WORD;
        // Past either end it resists, instead of stopping dead.
        position.set(raw < 0 ? raw * 0.25 : raw > last ? last + (raw - last) * 0.25 : raw);
        const closest = clamp(Math.round(raw), 0, last);
        if (closest !== nearest.get()) {
          nearest.set(closest);
          scheduleOnRN(report, closest);
        }
      })
      .onEnd((e) => {
        const flick = (-e.velocityX / 1000) * FLICK_CARRY;
        const target = clamp(Math.round(position.get() + flick), 0, last);
        position.set(withSpring(target, { ...SETTLE, velocity: -e.velocityX / DRAG_PER_WORD }));
        if (target !== nearest.get()) {
          nearest.set(target);
          scheduleOnRN(report, target);
        }
      });

    const tap = Gesture.Tap().onEnd((e) => {
      const now = layout.get();
      const sizes = widths.get();
      for (let i = 0; i < count; i++) {
        const from = now.x[i];
        if (e.x >= from - WORD_GAP / 2 && e.x <= from + (sizes[i] ?? 0) * now.scale[i]) {
          if (i !== nearest.get()) {
            nearest.set(i);
            position.set(withTiming(i, JUMP));
            scheduleOnRN(report, i);
          }
          return;
        }
      }
    });

    return Gesture.Exclusive(pan, tap);
  }, [count, layout, nearest, position, report, start, widths]);

  // A word doesn't look draggable, so show it moving once, the first time.
  useEffect(() => {
    if (count < 2) return;
    let cancelled = false;
    AsyncStorage.getItem(HINT_KEY)
      .then((seen) => {
        if (seen || cancelled) return;
        AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
        const from = position.get();
        position.set(
          withDelay(
            HINT_DELAY_MS,
            withSequence(
              withTiming(from + HINT_DISTANCE, HINT_MOTION),
              withTiming(from, HINT_MOTION)
            )
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [count > 1, position]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.dial} accessibilityRole='tablist' accessibilityLabel='Choose a vibe'>
        {titles.map((title, i) => (
          <DialWord
            key={`${i}-${title}`}
            title={title}
            index={i}
            layout={layout}
            onMeasure={onMeasure}
          />
        ))}
        <LinearGradient
          pointerEvents='none'
          colors={[`${colors.background}00`, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fade}
        />
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  dial: { flex: 1, minWidth: 0, height: 48, overflow: 'hidden', justifyContent: 'center' },
  word: {
    position: 'absolute',
    left: 0,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -1,
    transformOrigin: 'left',
  },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 56 },
});
