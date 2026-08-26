import { TextStyle } from 'react-native';

export const typography = {
  displayLg: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  displayMd: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,

  headingLg: { fontSize: 20, fontWeight: '700' } as TextStyle,
  headingMd: { fontSize: 18, fontWeight: '600' } as TextStyle,
  headingSm: { fontSize: 16, fontWeight: '600' } as TextStyle,

  bodyLg: { fontSize: 16, fontWeight: '400' } as TextStyle,
  bodyMd: { fontSize: 14, fontWeight: '400' } as TextStyle,
  bodySm: { fontSize: 13, fontWeight: '400' } as TextStyle,

  labelLg: { fontSize: 15, fontWeight: '600' } as TextStyle,
  labelMd: { fontSize: 13, fontWeight: '600' } as TextStyle,
  labelSm: { fontSize: 11, fontWeight: '600' } as TextStyle,

  caption: { fontSize: 12, fontWeight: '400' } as TextStyle,
  tabLabel: { fontSize: 10, letterSpacing: 0.1 } as TextStyle,
} as const;
