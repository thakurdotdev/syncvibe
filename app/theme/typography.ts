import { TextStyle } from 'react-native';

export const typography = {
  displayLg: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 36,
  } as TextStyle,
  displayMd: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 30,
  } as TextStyle,

  headingLg: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 26 } as TextStyle,
  headingMd: { fontSize: 18, fontWeight: '600', letterSpacing: -0.1, lineHeight: 24 } as TextStyle,
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
