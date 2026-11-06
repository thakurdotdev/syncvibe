import { EASE_OUT } from '@/lib/motion';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';

const POP = { duration: 250, dampingRatio: 0.6, reduceMotion: ReduceMotion.System } as const;
const RISE = { duration: 800, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const FADE = { duration: 250, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;

const FloatingEmoji = React.memo(({ emoji, userName }: { emoji: string; userName: string }) => {
  const seed = useRef({
    // Over the controls, not the artwork.
    left: 45 + Math.random() * 45,
    sway: (Math.random() - 0.5) * 36,
    rotation: `${((Math.random() - 0.5) * 20).toFixed(1)}deg`,
  }).current;

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Instant crisp spring pop
    scale.set(withSpring(1, POP));

    // Balanced 800ms upward rise
    translateY.set(withTiming(-180, RISE));

    // Natural organic sway
    translateX.set(withTiming(seed.sway, RISE));

    // Smooth fade out near top of flight
    opacity.set(withDelay(550, withTiming(0, FADE)));
  }, [seed.sway, scale, translateY, translateX, opacity]);

  const rotationStr = seed.rotation;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.get() },
      { translateX: translateX.get() },
      { scale: scale.get() },
      { rotate: rotationStr },
    ],
    opacity: opacity.get(),
  }));

  return (
    <Animated.View style={[styles.floatingEmoji, { left: `${seed.left}%` }, animatedStyle]}>
      <Text style={styles.emojiText}>{emoji}</Text>
      {userName ? (
        <Text style={styles.nameText} numberOfLines={1}>
          {userName}
        </Text>
      ) : null}
    </Animated.View>
  );
});

FloatingEmoji.displayName = 'FloatingEmoji';

export const FloatingReactions: React.FC = () => {
  const reactions = useGroupSessionStore((s) => s.floatingReactions);

  if (reactions.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents='none'>
      {reactions.map((r) => (
        <FloatingEmoji key={r.id} emoji={r.emoji} userName={r.userName} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
  },
  floatingEmoji: {
    position: 'absolute',
    // Starts by the reaction buttons, so a tap and its emoji read as one thing.
    bottom: 30,
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 36,
    lineHeight: 42,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  nameText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 1,
    maxWidth: 80,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
