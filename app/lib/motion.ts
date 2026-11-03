import { Easing } from 'react-native-reanimated';

/**
 * Motion presets — the native twin of client/src/lib/motion.js, so the app and the web
 * feel like one product.
 *
 *  - Press feedback is instant (≈80ms) and runs on the UI thread.
 *  - Things that move between positions use SPRING (snappy, barely any overshoot).
 *  - Enters use a strong ease-out in 150–250ms; exits are faster than enters.
 *  - Nothing fades in just because a screen mounted.
 */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const SPRING = { damping: 28, stiffness: 420, mass: 0.6 } as const;
export const SPRING_PRESS = { damping: 22, stiffness: 520, mass: 0.5 } as const;

export const PRESS_IN = { duration: 80, easing: EASE_OUT } as const;
export const ENTER = { duration: 200, easing: EASE_OUT } as const;
export const EXIT = { duration: 140, easing: EASE_OUT } as const;

/** Default press-down scale for cards and rows; buttons use a slightly deeper one. */
export const PRESS_SCALE = 0.97;
export const BUTTON_PRESS_SCALE = 0.92;
