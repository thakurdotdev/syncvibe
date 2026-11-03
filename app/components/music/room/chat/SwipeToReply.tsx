import { useTheme } from '@/context/ThemeContext';
import { SPRING_SNAP } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const TRIGGER = 56;
const MAX = 72;

/** Linear up to the trigger, then rubber-band resistance instead of a hard stop. */
const resist = (dx: number) => {
  'worklet';
  if (dx <= 0) return 0;
  if (dx <= MAX) return dx;
  return MAX + (dx - MAX) * 0.2;
};

const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * Drag a message right to reply. Horizontal-only so the list keeps its vertical scroll;
 * everything per-frame stays on the UI thread. The haptic fires once, on the frame the
 * drag crosses the reply point, and the bubble springs home with the finger's velocity.
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
  const armed = useDerivedValue(() => x.get() >= TRIGGER);

  // Threshold crossing, not per frame: one haptic when the reply point is reached.
  useAnimatedReaction(
    () => armed.get(),
    (now, prev) => {
      if (now && prev === false) scheduleOnRN(tick);
    }
  );

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(14)
    .failOffsetX(-12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.set(resist(e.translationX * 0.75));
    })
    .onEnd((e) => {
      if (armed.get()) scheduleOnRN(onReply);
      x.set(withSpring(0, { ...SPRING_SNAP, velocity: e.velocityX }));
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [12, TRIGGER], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(x.get(), [12, TRIGGER], [0.9, 1], 'clamp') }],
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
