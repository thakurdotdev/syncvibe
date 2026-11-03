import { TextStyle } from 'react-native';

/**
 * Display face shared with the web app (Bricolage Grotesque), loaded in app/_layout.tsx.
 * Each weight is its own family on Android, so display styles set fontFamily and leave
 * fontWeight unset. Body text stays on the platform font.
 */
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
} as const;

export const typography = {
  displayXl: {
    fontFamily: fonts.displayHeavy,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 38,
  } as TextStyle,
  displayLg: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
  } as TextStyle,
  displayMd: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 30,
  } as TextStyle,

  headingLg: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
  } as TextStyle,
  headingMd: {
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    letterSpacing: -0.2,
    lineHeight: 24,
  } as TextStyle,
  headingSm: { fontSize: 16, fontWeight: '600', lineHeight: 22 } as TextStyle,

  bodyLg: { fontSize: 16, fontWeight: '400', lineHeight: 24 } as TextStyle,
  bodyMd: { fontSize: 14, fontWeight: '400', lineHeight: 20 } as TextStyle,
  bodySm: { fontSize: 13, fontWeight: '400', lineHeight: 18 } as TextStyle,

  labelLg: { fontSize: 15, fontWeight: '600', lineHeight: 20 } as TextStyle,
  labelMd: { fontSize: 13, fontWeight: '600', lineHeight: 18 } as TextStyle,
  labelSm: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, lineHeight: 14 } as TextStyle,

  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 } as TextStyle,
  tabLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2, lineHeight: 14 } as TextStyle,
} as const;
