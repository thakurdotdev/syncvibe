import type { View } from 'react-native';
import { makeMutable } from 'react-native-reanimated';

/*
 * The full player grows out of the place you opened it from (the orb, the capsule or the card
 * in the bottom deck) and shrinks back into the orb when it closes. The deck measures those
 * places here; the player reads them on the UI thread while it animates.
 */

export interface MorphRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface MorphOrigin {
  /** The shape the player starts as and ends as. */
  box: MorphRect;
  /** Where the song's artwork sits in it, for the cover to fly from and back to. */
  art: MorphRect;
}

/** The orb, as last measured: where the player closes into. */
export const orbOrigin = makeMutable<MorphOrigin | null>(null);
/** Where the player opens from this time. */
export const openOrigin = makeMutable<MorphOrigin | null>(null);
/** How open the full player is, 0 (closed) to 1. The orb watches it to know when it lands. */
export const playerOpenness = makeMutable(0);
/**
 * Below this the closing player is about the orb's size. It fades out over the last stretch
 * instead of covering the orb until its spring fully settles, and the orb's ring starts there.
 */
export const LANDED = 0.12;

/** Artwork of `size`, centred vertically and `inset` from the left of a box. */
export const artAt = (box: MorphRect, size: number, radius: number, inset?: number): MorphRect => ({
  x: box.x + (inset ?? (box.height - size) / 2),
  y: box.y + (box.height - size) / 2,
  width: size,
  height: size,
  radius,
});

/** Measures a view on screen. Null if it isn't laid out (or has no size). */
export const measureRect = (view: View | null, radius: number) =>
  new Promise<MorphRect | null>((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height, radius } : null)
    );
  });
