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

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Defaults to 0.97 (cards, rows). */
  scaleTo?: number;
};

/**
 * Pressable with press feedback that runs entirely on the UI thread: it scales down in
 * ~80ms on touch and springs back on release. No JS re-render per press, so lists stay
 * smooth while scrolling and tapping.
 */
const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { children, style, scaleTo = PRESS_SCALE, onPressIn, onPressOut, disabled, ...rest },
  ref
) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!reduceMotion) scale.value = withTiming(scaleTo, PRESS_IN);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    scale.value = withSpring(1, SPRING_PRESS);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

export default memo(PressableScale);
