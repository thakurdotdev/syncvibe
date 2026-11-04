import { useTheme } from '@/context/ThemeContext';
import { typography } from '@/theme/typography';
import * as Haptics from 'expo-haptics';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const BAR_COUNT = 17;
const BAR_HEIGHT = 170;
const LOOP_MS = 2400;
const HAPTIC_PULSE_MS = 260;

interface BarProps {
  index: number;
  clock: SharedValue<number>;
  energy: SharedValue<number>;
}

const Bar = memo(function Bar({ index, clock, energy }: BarProps) {
  const { colors } = useTheme();

  const style = useAnimatedStyle(() => {
    // Whole-number frequencies, so the wave lines up again when the clock loops.
    const frequency = 1 + (index % 3);
    const wave = (Math.sin(clock.value * 2 * Math.PI * frequency + index * 0.9) + 1) / 2;
    const resting = 0.14 + wave * 0.3;
    const excited = 0.35 + wave * 0.65;

    return {
      transform: [{ scaleY: resting + (excited - resting) * energy.value }],
      backgroundColor: interpolateColor(
        energy.value,
        [0, 1],
        [colors.mutedForeground, colors.primary]
      ),
    };
  });

  return <Animated.View style={[styles.bar, style]} />;
});

/** Equaliser that idles on its own and comes alive, with haptics, while it's held down. */
export const BeatHero = memo(function BeatHero({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const clock = useSharedValue(0);
  const energy = useSharedValue(0);
  const pulseTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!active) return;
    clock.value = 0;
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(clock);
  }, [active, clock]);

  const stopPulse = () => {
    if (pulseTimer.current) clearInterval(pulseTimer.current);
    pulseTimer.current = null;
  };

  useEffect(() => stopPulse, []);

  const pulse = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePressIn = () => {
    setHolding(true);
    energy.value = withSpring(1, { damping: 12, stiffness: 140 });
    pulse();
    stopPulse();
    pulseTimer.current = setInterval(pulse, HAPTIC_PULSE_MS);
  };

  const handlePressOut = () => {
    setHolding(false);
    energy.value = withSpring(0, { damping: 18, stiffness: 120 });
    stopPulse();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel='Animated equaliser. Press and hold to feel the beat.'
      style={styles.hero}
    >
      <View style={styles.bars}>
        {Array.from({ length: BAR_COUNT }, (_, index) => (
          <Bar key={index} index={index} clock={clock} energy={energy} />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        {holding ? 'That’s the vibe' : 'Press and hold to feel the beat'}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 12,
  },
  bars: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  bar: {
    width: 7,
    height: BAR_HEIGHT,
    borderRadius: 4,
  },
  hint: {
    ...typography.labelMd,
  },
});
