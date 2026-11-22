import { useTheme } from '@/context/ThemeContext';
import { typography } from '@/theme/typography';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const BAR_COUNT = 17;
const BAR_WIDTH = 7;
const BAR_GAP = 7;
const BAR_HEIGHT = 170;
const BARS_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
const LOOP_MS = 2400;
/** How far a tap spreads across the bars, in points. */
const SPOT_SPREAD = 34;
const FLOAT_MS = 1400;
const MAX_FLOATING = 10;
// The reactions people send in rooms, and now and then a cat.
const REACTIONS = ['🔥', '❤️', '👏', '😍', '🎵'];
const RARE = '😺';

const system = ReduceMotion.System;

interface BarProps {
  index: number;
  clock: SharedValue<number>;
  energy: SharedValue<number>;
  spotX: SharedValue<number>;
  kick: SharedValue<number>;
}

const Bar = memo(function Bar({ index, clock, energy, spotX, kick }: BarProps) {
  const { colors } = useTheme();
  const center = index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2;

  const style = useAnimatedStyle(() => {
    // Whole-number frequencies, so the wave lines up again when the clock loops.
    const frequency = 1 + (index % 3);
    const wave = (Math.sin(clock.get() * 2 * Math.PI * frequency + index * 0.9) + 1) / 2;
    const resting = 0.14 + wave * 0.3;
    const excited = 0.35 + wave * 0.65;
    // Bars under the finger jump the most.
    const distance = center - spotX.get();
    const spot = Math.exp(-(distance * distance) / (2 * SPOT_SPREAD * SPOT_SPREAD));
    const lift = spot * kick.get() * 0.45;

    return {
      transform: [{ scaleY: Math.min(1, resting + (excited - resting) * energy.get() + lift) }],
      backgroundColor: interpolateColor(
        Math.min(1, energy.get() + spot * kick.get()),
        [0, 1],
        [colors.mutedForeground, colors.primary]
      ),
    };
  });

  return <Animated.View style={[styles.bar, style]} />;
});

interface Floating {
  id: number;
  emoji: string;
  x: number;
  drift: number;
}

/** One reaction that rises from where you tapped and fades out. */
const FloatingReaction = memo(function FloatingReaction({
  item,
  onDone,
}: {
  item: Floating;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withTiming(
        1,
        { duration: FLOAT_MS, easing: Easing.out(Easing.cubic), reduceMotion: system },
        (finished) => {
          if (finished) scheduleOnRN(onDone, item.id);
        }
      )
    );
  }, [item.id, onDone, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.55) / 0.45),
      transform: [
        { translateX: item.drift * p },
        { translateY: -BAR_HEIGHT * 0.95 * p },
        { scale: 0.6 + Math.min(1, p * 4) * 0.5 },
        { rotate: `${item.drift * 0.4 * p}deg` },
      ],
    };
  });

  return (
    <Animated.Text
      pointerEvents='none'
      style={[styles.floating, { left: item.x - 14 }, style]}
      importantForAccessibility='no'
    >
      {item.emoji}
    </Animated.Text>
  );
});

const hintFor = (taps: number) => {
  if (taps === 0) return 'Tap the beat to send a reaction';
  if (taps < 4) return 'That’s how rooms feel';
  if (taps < 12) return 'Hold it down to turn it up';
  return 'Okay, DJ. Let’s get you in a room';
};

/**
 * Equaliser that idles on its own. A tap kicks the bars under your finger and sends up a room
 * reaction; holding brings every bar alive.
 */
export const BeatHero = memo(function BeatHero({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const clock = useSharedValue(0);
  const energy = useSharedValue(0);
  const spotX = useSharedValue(-1000);
  const kick = useSharedValue(0);
  const nextId = useRef(0);
  const [taps, setTaps] = useState(0);
  const [floating, setFloating] = useState<Floating[]>([]);

  useEffect(() => {
    if (!active) return;
    clock.set(0);
    clock.set(withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1));
    return () => cancelAnimation(clock);
  }, [active, clock]);

  const removeFloating = useCallback((id: number) => {
    setFloating((items) => items.filter((item) => item.id !== id));
  }, []);

  const handlePressIn = (event: GestureResponderEvent) => {
    const x = Math.max(0, Math.min(BARS_WIDTH, event.nativeEvent.locationX));
    spotX.set(x);
    kick.set(
      withSequence(
        withTiming(1, { duration: 90, reduceMotion: system }),
        withSpring(0, { duration: 700, dampingRatio: 0.5, reduceMotion: system })
      )
    );
    energy.set(withSpring(1, { duration: 600, dampingRatio: 0.7, reduceMotion: system }));

    const id = nextId.current++;
    const emoji = id > 0 && id % 7 === 0 ? RARE : REACTIONS[id % REACTIONS.length];
    const drift = ((id * 37) % 41) - 20;
    setFloating((items) => [...items.slice(-(MAX_FLOATING - 1)), { id, emoji, x, drift }]);
    setTaps((count) => count + 1);
  };

  const handlePressOut = () => {
    energy.set(withSpring(0, { duration: 500, dampingRatio: 1, reduceMotion: system }));
  };

  return (
    <View style={styles.hero}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole='button'
        accessibilityLabel='Animated equaliser. Tap to send a reaction, hold to turn it up.'
        style={styles.stage}
      >
        {/* Touches land on the stage itself, so locationX is measured across the bars. */}
        <View pointerEvents='none' style={styles.bars}>
          {Array.from({ length: BAR_COUNT }, (_, index) => (
            <Bar
              key={index}
              index={index}
              clock={clock}
              energy={energy}
              spotX={spotX}
              kick={kick}
            />
          ))}
        </View>
        {floating.map((item) => (
          <FloatingReaction key={item.id} item={item} onDone={removeFloating} />
        ))}
      </Pressable>
      <Text
        accessibilityLiveRegion='polite'
        style={[styles.hint, { color: colors.mutedForeground }]}
      >
        {hintFor(taps)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 12,
  },
  stage: {
    width: BARS_WIDTH,
    height: BAR_HEIGHT,
    // Reactions rise above the bars.
    overflow: 'visible',
  },
  bars: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: 4,
  },
  floating: {
    position: 'absolute',
    bottom: BAR_HEIGHT * 0.35,
    width: 28,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  hint: {
    ...typography.labelMd,
  },
});
