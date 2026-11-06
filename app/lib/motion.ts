import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * Motion presets for the app (the native twin of client/src/lib/motion.js).
 *
 * Rules these encode:
 *  - Finger involved → spring (carries velocity through interruptions). Otherwise timing.
 *  - Springs use the designer form { duration, dampingRatio }; no overshoot unless a
 *    gesture carried momentum.
 *  - Timing is ease-out for enter/exit, ease-in-out for on-screen movement, never ease-in.
 *  - Press feedback 100–150ms; small state changes 150–200ms; sheets ~300ms; all UI < 300ms.
 *  - Every preset honours the system Reduce Motion setting.
 */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

const system = ReduceMotion.System;

/** Default settle, no overshoot: indicators, things that move after a tap. */
export const SPRING = { duration: 300, dampingRatio: 1, reduceMotion: system } as const;
/** Snap back after a drag (pass `velocity` from the gesture). */
export const SPRING_SNAP = { duration: 400, dampingRatio: 0.8, reduceMotion: system } as const;
/** Sheets and drawers (pass `velocity` when a drag released it). */
export const SPRING_SHEET = { duration: 300, dampingRatio: 0.8, reduceMotion: system } as const;
/** Release after a press: settles back to rest without bounce. */
export const SPRING_PRESS = { duration: 250, dampingRatio: 1, reduceMotion: system } as const;

/** Press-in feedback: shown immediately on touch, under 150ms. */
export const PRESS_IN = { duration: 120, easing: EASE_OUT, reduceMotion: system } as const;
/** Selection indicators switched often (tens of times a session): barely-there move. */
export const INDICATOR = { duration: 140, easing: EASE_IN_OUT, reduceMotion: system } as const;
/** Small state changes (chips, toggles). */
export const STATE = { duration: 180, easing: EASE_OUT, reduceMotion: system } as const;
/** Popovers and menus appearing; exits are faster than enters. */
export const ENTER = { duration: 200, easing: EASE_OUT, reduceMotion: system } as const;
export const EXIT = { duration: 140, easing: EASE_OUT, reduceMotion: system } as const;

/** Sheet opening from a tap: starts fast so the first frame already moves, then settles. */
export const SHEET_OPEN = { duration: 280, easing: EASE_SHEET, reduceMotion: system } as const;
/** Sheet leaving on its own; quicker than it arrived. */
export const SHEET_CLOSE = { duration: 180, easing: EASE_OUT, reduceMotion: system } as const;

/** Press-down scale: cards and buttons, full-width rows (less, they're wide), small icon buttons. */
export const PRESS_SCALE = 0.97;
export const ROW_PRESS_SCALE = 0.98;
export const BUTTON_PRESS_SCALE = 0.92;
/** Popovers start here, never from 0. */
export const POP_FROM_SCALE = 0.95;

/** Where a flick would come to rest: a fast short swipe commits, a slow long one doesn't. */
export function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The further past an edge, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
