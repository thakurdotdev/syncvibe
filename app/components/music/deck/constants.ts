import { EASE_MAGNET, EASE_OUT } from '@/lib/motion';
import { ReduceMotion } from 'react-native-reanimated';

/** Shared by the bottom deck's parts: the orb, the tab pill, the capsule and the card. */

export const PILL_HEIGHT = 58;
/** The orb's artwork, and the card's: matched by the full player's cover as it flies. */
export const ORB_ART = 44;
/** The deck's distance from the screen's sides. */
export const DECK_SIDE = 12;

/** A committed skip carries the song out, quickly. */
export const SKIP_OUT_TIMING = {
  duration: 110,
  easing: EASE_OUT,
  reduceMotion: ReduceMotion.System,
} as const;
/** If no new song arrives (end of the queue), the old one comes back after this. */
export const SKIP_RETURN_DELAY_MS = 400;

/**
 * Closing is a magnet: the capsule starts back gently and gathers speed into the orb, so it ends
 * on a snap rather than drifting to a stop. Quicker than opening.
 */
export const CAPSULE_CLOSE = {
  duration: 170,
  easing: EASE_MAGNET,
  reduceMotion: ReduceMotion.System,
} as const;
