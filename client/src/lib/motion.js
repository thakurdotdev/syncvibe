/**
 * Motion presets — the JS twin of the CSS tokens in index.css (--ease-snappy, .press).
 *
 * Rules of thumb used across the app:
 *  - UI enters with a strong ease-out in 150–250ms; exits are faster than enters.
 *  - Animate transform and opacity only.
 *  - Never scale from 0 — start around 0.96.
 *  - Indicators that move between items use SPRING so they stay interruptible.
 *  - Nothing animates on mount just to decorate; motion answers an action.
 */
export const EASE_OUT = [0.23, 1, 0.32, 1];
export const EASE_DRAWER = [0.32, 0.72, 0, 1];

export const SPRING = { type: 'spring', stiffness: 560, damping: 40, mass: 0.7 };

/** Pop-in for overlays and palettes. */
export const POP = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: EASE_OUT } },
};

/** Backdrop fade for overlays. */
export const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
};

/** Crossfade between whole views (e.g. room ↔ welcome). */
export const VIEW = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
};
