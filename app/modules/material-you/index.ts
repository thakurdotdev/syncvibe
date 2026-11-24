import { requireOptionalNativeModule } from 'expo';

/** Shades 0, 10, 50, 100, 200 … 900, 1000 of one palette, as `#RRGGBB`. */
export type Shades = string[];

export interface MaterialYouPalettes {
  accent1: Shades;
  accent2: Shades;
  accent3: Shades;
  neutral1: Shades;
  neutral2: Shades;
}

interface MaterialYouNative {
  /** Null before Android 12. */
  getPalettes(): MaterialYouPalettes | null;
}

/** Null on iOS and on any build made before this module existed. */
export const MaterialYou = requireOptionalNativeModule<MaterialYouNative>('MaterialYou');
