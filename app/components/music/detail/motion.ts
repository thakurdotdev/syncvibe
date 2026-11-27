import { EASE_OUT } from '@/lib/motion';
import { useEffect } from 'react';
import {
  Easing,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/*
 * How a detail page arrives: the art first, then its words and buttons one beat after another,
 * then the first songs. Every step is short and plays once; with Reduce Motion it's all there
 * at once.
 */

const system = ReduceMotion.System;

/** Gap between one piece of the page arriving and the next. */
export const STAGGER = 45;
/** The first songs follow the buttons. */
export const ROWS_AFTER = 260;
/** Songs after this many arrive without a step of their own (they're below the fold anyway). */
export const STAGGERED_ROWS = 8;

export const RISE = { duration: 380, easing: EASE_OUT, reduceMotion: system } as const;

/** Fades a piece of the page in while lifting it the last few points into place. */
export function useRise(delay: number, distance = 10) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, RISE), system));
  }, [delay, t]);
  return useAnimatedStyle(() => ({
    opacity: t.get(),
    transform: [{ translateY: (1 - t.get()) * distance }],
  }));
}

const makeRowRise = (delay: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 8 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
  })
    .duration(320)
    .delay(delay)
    .reduceMotion(system);

// A layout animation can't change its delay once made, so there's one per step, made as needed.
const rowRises = new Map<number, ReturnType<typeof makeRowRise>>();

/** A song row arriving `delay` ms from now. */
export const rowRise = (delay: number) => {
  const step = Math.round(delay / 10) * 10;
  let frame = rowRises.get(step);
  if (!frame) {
    frame = makeRowRise(step);
    rowRises.set(step, frame);
  }
  return frame;
};

/** The play button's icon swapping: the new one turns in from a little smaller. */
export const ICON_IN = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }, { rotate: '-40deg' }] },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }, { rotate: '0deg' }],
    easing: Easing.out(Easing.cubic),
  },
})
  .duration(200)
  .reduceMotion(system);

export const ICON_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.6 }] },
})
  .duration(120)
  .reduceMotion(system);
