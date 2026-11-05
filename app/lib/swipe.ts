/**
 * Rules for swiping between songs, shared by the full player's artwork and the mini player.
 * A skip changes what you're listening to, so it has to be unmistakably on purpose.
 */

/** A touch starting this close to a screen edge belongs to the system back gesture. */
export const EDGE_GUARD = 32;
/** Sideways travel before a touch counts as a swipe at all. */
export const SWIPE_ACTIVATE = 24;

/** Drag at least this share of the width, at any speed... */
const COMMIT_DISTANCE = 0.3;
/** ...or flick: this far, and this fast in the same direction. */
const FLICK_DISTANCE = 0.12;
const FLICK_VELOCITY = 900;
/** Moving back this fast at release means you changed your mind. */
const REVERSE_VELOCITY = 300;

export const isSkipSwipe = (translation: number, velocity: number, width: number) => {
  'worklet';
  const distance = Math.abs(translation);
  const speedOut = translation < 0 ? -velocity : velocity;
  if (speedOut < -REVERSE_VELOCITY) return false;
  return (
    distance >= width * COMMIT_DISTANCE ||
    (distance >= width * FLICK_DISTANCE && speedOut >= FLICK_VELOCITY)
  );
};
