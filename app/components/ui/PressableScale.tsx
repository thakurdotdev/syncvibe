import { PRESS_SCALE } from '@/lib/motion';
import { forwardRef, memo, useState, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// A finger drifting a little shouldn't cancel a press the user meant.
const RETENTION = { top: 16, bottom: 16, left: 16, right: 16 };

const TIMING = {
  transitionDuration: 120,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;
const SCALE_TRANSITION = { ...TIMING, transitionProperty: 'transform' } as const;
// With Reduce Motion, a gentle opacity dip replaces the scale.
const DIM_TRANSITION = { ...TIMING, transitionProperty: 'opacity' } as const;
const DIMMED = { opacity: 0.7 };
const REST = { transform: [{ scale: 1 }] };

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Defaults to PRESS_SCALE (cards, buttons). */
  scaleTo?: number;
};

/**
 * Pressable with the app's press feedback: a CSS transition, so a row costs nothing until it's
 * touched. Screens can hold hundreds of these, and a shared value and animated style for each one
 * is what slows lists down on Android. It renders twice per press, never per frame.
 */
const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { children, style, scaleTo = PRESS_SCALE, onPressIn, onPressOut, ...rest },
  ref
) {
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReducedMotion();

  // Feedback on press-in (what the user perceives as latency), settle on release.
  const handlePressIn = (e: GestureResponderEvent) => {
    setPressed(true);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    setPressed(false);
    onPressOut?.(e);
  };

  const feedback = reduceMotion
    ? [DIM_TRANSITION, pressed && DIMMED]
    : [SCALE_TRANSITION, pressed ? { transform: [{ scale: scaleTo }] } : REST];

  return (
    <AnimatedPressable
      ref={ref}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      pressRetentionOffset={RETENTION}
      style={[style, feedback]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

export default memo(PressableScale);
