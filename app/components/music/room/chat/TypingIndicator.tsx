import { useTheme } from '@/context/ThemeContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const Dot = ({ delay, color }: { delay: number; color: string }) => {
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withDelay(delay, withRepeat(withTiming(-3, { duration: 320 }), -1, true)));
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

const label = (names: string[]) =>
  names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names.length} people are typing`;

/** "Pankaj is typing" with bouncing dots; renders nothing when nobody is. */
export const TypingIndicator = memo(function TypingIndicator() {
  const { colors } = useTheme();
  const typingUsers = useGroupSessionStore((s) => s.typingUsers);
  const names = Object.values(typingUsers);
  if (!names.length) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      style={styles.row}
    >
      <View style={[styles.bubble, { backgroundColor: colors.raised }]}>
        {[0, 120, 240].map((d) => (
          <Dot key={d} delay={d} color={colors.mutedForeground} />
        ))}
      </View>
      <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label(names)}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  bubble: {
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 12 },
});
