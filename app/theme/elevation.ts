import type { ViewStyle } from 'react-native';

/**
 * Elevation for surfaces that float over scrolling content (the mini player, menus).
 * Regular cards stay flat (solid surface, like the default Card). Shadows are static:
 * never animate elevation (Android re-renders the shadow every frame).
 */
export const elevation = {
  /** Floating surfaces: the mini player, menus. */
  float: {
    shadowColor: '#1A1423',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  } satisfies ViewStyle,
} as const;

/** Dark surfaces need a stronger, neutral shadow to read at all. */
export const darkShadow: ViewStyle = { shadowColor: '#000', shadowOpacity: 0.35 };
