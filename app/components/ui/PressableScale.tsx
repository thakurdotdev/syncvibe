import { PRESS_IN, PRESS_SCALE, SPRING_PRESS } from '@/lib/motion';
import { forwardRef, memo, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// A finger drifting a little shouldn't cancel a press the user meant.
const RETENTION = { top: 16, bottom: 16, left: 16, right: 16 };

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Defaults to 0.97 (cards, rows). */
  scaleTo?: number;
};

/**
 * Pressable with press feedback that runs entirely on the UI thread: it scales down in
 * ~120ms on touch and springs back on release. No JS re-render per press, so lists stay
 * smooth while scrolling and tapping.
 */
const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { children, style, scaleTo = PRESS_SCALE, onPressIn, onPressOut, disabled, ...rest },
  ref
) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: dim.get(),
    transform: [{ scale: scale.get() }],
  }));

  // Feedback on press-in (what the user perceives as latency), settle on release.
  // With Reduce Motion, a gentle opacity dip replaces the scale.
  const handlePressIn = (e: GestureResponderEvent) => {
    if (reduceMotion) dim.set(withTiming(0.7, PRESS_IN));
    else scale.set(withTiming(scaleTo, PRESS_IN));
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    if (reduceMotion) dim.set(withTiming(1, PRESS_IN));
    else scale.set(withSpring(1, SPRING_PRESS));
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={RETENTION}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

export default memo(PressableScale);
