import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SPRING } from '@/lib/motion';

const TRIGGER = 56;
const MAX = 80;

/**
 * Drag a message to the right to reply, like most chat apps. Horizontal-only so it never
 * fights the list's vertical scroll; a light haptic marks the point where releasing replies.
 */
export const SwipeToReply = memo(function SwipeToReply({
  children,
  onReply,
  enabled = true,
}: {
  children: ReactNode;
  onReply: () => void;
  enabled?: boolean;
}) {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);

  const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(14)
    .failOffsetX(-12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(MAX, e.translationX * 0.6));
      const nowArmed = x.value >= TRIGGER;
      if (nowArmed && !armed.value) runOnJS(tick)();
      armed.value = nowArmed;
    })
    .onEnd(() => {
      if (armed.value) runOnJS(onReply)();
      armed.value = false;
      x.value = withSpring(0, SPRING);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [10, TRIGGER], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(x.value, [10, TRIGGER], [0.6, 1], 'clamp') }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View>
        <Animated.View style={[styles.icon, { backgroundColor: colors.raised }, iconStyle]}>
          <Ionicons name='arrow-undo' size={15} color={colors.primary} />
        </Animated.View>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
