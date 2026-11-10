export interface ColorPalette {
  light: ThemeColors;
  dark: ThemeColors;
  name: string;
  description: string;
}

export interface ThemeColors {
  // Main palette
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  text: string;
  /** Live / presence signal (rooms, listeners). Never used for actions. */
  live: string;
  liveForeground: string;
  /** Surface one step above `card` — inputs, chips, pressed rows. */
  raised: string;
  /** Edge of a finished surface: a faint line of the text colour, so it works on any surface. */
  hairline: string;
  /** Light catching the top edge of a surface or button. Drawn as a 1px line. */
  sheen: string;

  // Button state variants
  primaryHover: string;
  primaryActive: string;
  primaryDisabled: string;
  secondaryHover: string;
  secondaryActive: string;
  secondaryDisabled: string;
  accentHover: string;
  accentActive: string;
  accentDisabled: string;
  destructiveHover: string;
  destructiveActive: string;
  destructiveDisabled: string;

  // Gradient colors
  gradients: {
    primary: string[];
    background: string[];
    card: string[];
    accent: string[];
    destructive: string[];
    header: string[];
    /** Filled (primary) buttons, top to bottom: the same finish as the web's `.btn-primary`. */
    button: string[];
    /** Quiet buttons and chips, top to bottom: the web's `.btn-surface`. */
    surface: string[];
  };
}

// Professional, vibrant music player palette — ember/coral accent variant.
// Same design system as the rose variant below: true neutral grays for
// structure, one accent used sparingly (play state, progress, selection),
// every foreground/background pair checked against WCAG AA (4.5:1+).
const emberPalette: ColorPalette = {
  name: 'Ember',
  description: 'Professional, vibrant music player palette with a refined ember accent',
  light: {
    background: '#F3F4F6',
    foreground: '#16161A',
    card: '#FFFFFF',
    cardForeground: '#16161A',
    popover: '#FFFFFF',
    popoverForeground: '#16161A',
    primary: '#CC4310',
    primaryForeground: '#FFFFFF',
    secondary: '#F3F3F4',
    secondaryForeground: '#16161A',
    muted: '#F3F3F4',
    mutedForeground: '#6B6B70',
    accent: '#FCE8DD',
    accentForeground: '#7A2B0A',
    destructive: '#C81E3A',
    destructiveForeground: '#FFFFFF',
    border: '#E5E5E7',
    input: '#E5E5E7',
    ring: '#CC4310',
    text: '#16161A',
    live: '#B86E00',
    liveForeground: '#FFFFFF',
    raised: '#EDEDEF',
    hairline: 'rgba(22, 22, 26, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    primaryHover: '#B23A0D',
    primaryActive: '#99310A',
    primaryDisabled: '#EBA987',

    secondaryHover: '#E8E8EA',
    secondaryActive: '#DCDCDE',
    secondaryDisabled: '#FAFAFA',

    accentHover: '#FAD9C5',
    accentActive: '#F7C7AC',
    accentDisabled: '#FEF3EC',

    destructiveHover: '#B01A33',
    destructiveActive: '#96162B',
    destructiveDisabled: '#EBA3AF',

    gradients: {
      primary: ['#E05A28', '#CC4310', '#99310A'],
      background: ['#F3F4F6', '#F3F4F6'],
      card: ['#FFFFFF', '#FCFCFC'],
      accent: ['#FCE8DD', '#FAD9C5'],
      destructive: ['#DB4259', '#C81E3A', '#96162B'],
      header: ['#FDEEE5', '#FBE0D0', '#FDF4EE'],
      button: ['#E05A28', '#CC4310'],
      surface: ['rgba(22, 22, 26, 0.05)', 'rgba(22, 22, 26, 0.02)'],
    },
  },
  dark: {
    background: '#0B0B0C',
    foreground: '#F4F4F5',
    card: '#19191B',
    cardForeground: '#F4F4F5',
    popover: '#202022',
    popoverForeground: '#F4F4F5',
    primary: '#FF6A35',
    primaryForeground: '#0B0B0C',
    secondary: '#222224',
    secondaryForeground: '#F4F4F5',
    muted: '#222224',
    mutedForeground: '#A0A0A4',
    accent: '#33201A',
    accentForeground: '#FF9B6E',
    destructive: '#FF5468',
    destructiveForeground: '#0B0B0C',
    border: '#2A2A2D',
    input: '#2A2A2D',
    ring: '#FF6A35',
    text: '#F4F4F5',
    live: '#FFB547',
    liveForeground: '#100C16',
    raised: '#26262A',
    hairline: 'rgba(244, 244, 245, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.07)',

    primaryHover: '#FF8456',
    primaryActive: '#E85A28',
    primaryDisabled: '#7A4530',

    secondaryHover: '#2B2B2E',
    secondaryActive: '#363639',
    secondaryDisabled: '#19191A',

    accentHover: '#3D2820',
    accentActive: '#4A3026',
    accentDisabled: '#241712',

    destructiveHover: '#FF7280',
    destructiveActive: '#E83B50',
    destructiveDisabled: '#7A2E38',

    gradients: {
      primary: ['#FF9166', '#FF6A35', '#E85A28'],
      background: ['#0B0B0C', '#141415'],
      card: ['#19191B', '#212123'],
      accent: ['#33201A', '#3D2820'],
      destructive: ['#FF8590', '#FF5468', '#E83B50'],
      header: ['#3D2014', '#27160E', '#0B0B0C'],
      button: ['#FF9166', '#FF6A35'],
      surface: ['rgba(244, 244, 245, 0.08)', 'rgba(244, 244, 245, 0.03)'],
    },
  },
};

// Professional, vibrant music player palette — refined magenta/rose accent variant.
// Kept registered as `rose`; the active default is Mono below.
// Calibration notes specific to this variant:
// - Primary is a slightly muted rose, so it feels premium instead of neon
//   while remaining easy to recognize for playback and active states.
// - Destructive was deliberately pulled to a true red (not the usual
//   rose-adjacent red) to keep ~30°+ of hue separation from primary —
//   with a pink primary, "delete" and "the brand color" sit too close
//   on the wheel unless destructive is pushed further away.
const rosePalette: ColorPalette = {
  name: 'Rose',
  description: 'Professional music player palette with a refined magenta-rose accent',
  light: {
    // Main palette
    background: '#F7F7F8',
    foreground: '#16161A', // True near-black, zero hue tint
    card: '#FFFFFF',
    cardForeground: '#16161A',
    popover: '#FFFFFF',
    popoverForeground: '#16161A',
    primary: '#C92D70', // Refined rose — strong contrast with white text
    primaryForeground: '#FFFFFF',
    secondary: '#F0F1F3', // Neutral gray, no hue cast
    secondaryForeground: '#16161A',
    muted: '#F0F1F3',
    mutedForeground: '#66676D', // Neutral mid-gray, AA-safe for secondary text
    accent: '#F9E5EE', // Quiet rose wash — selection / now-playing state only
    accentForeground: '#72173D',
    destructive: '#CC2819', // True red, deliberately hue-separated from primary
    destructiveForeground: '#FFFFFF',
    border: '#E3E4E8',
    input: '#E3E4E8',
    ring: '#C92D70',
    text: '#16161A',
    live: '#B86E00',
    liveForeground: '#FFFFFF',
    raised: '#EDEDEF',
    hairline: 'rgba(22, 22, 26, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    // Button state variants
    primaryHover: '#B62564',
    primaryActive: '#982052',
    primaryDisabled: '#E8A5C1',

    secondaryHover: '#E6E7EA',
    secondaryActive: '#D9DADF',
    secondaryDisabled: '#FAFAFA',

    accentHover: '#F5D1E1',
    accentActive: '#F0BCD3',
    accentDisabled: '#FCEFF5',

    destructiveHover: '#B32316',
    destructiveActive: '#991E12',
    destructiveDisabled: '#E9A89F',

    // Gradient colors
    gradients: {
      primary: ['#DF4D8A', '#C92D70', '#982052'],
      background: ['#FFF8FA', '#F7F7F8'],
      card: ['#FFFFFF', '#FCFCFC'],
      accent: ['#F9E5EE', '#F5D1E1'],
      destructive: ['#DC4A3D', '#CC2819', '#991E12'],
      // Soft warm header backdrop: low saturation wash (#FFF8FA -> #F8F8FF)
      header: ['#FFF7FA', '#FBF7FC', '#F7F7F8'],
      button: ['#DF4D8A', '#C92D70'],
      surface: ['rgba(22, 22, 26, 0.05)', 'rgba(22, 22, 26, 0.02)'],
    },
  },
  dark: {
    // Main palette
    background: '#0B0B0C', // True near-black, zero hue tint
    foreground: '#F4F4F5',
    card: '#19191B', // Neutral elevated surface — separates from bg without relying on color
    cardForeground: '#F4F4F5',
    popover: '#202022',
    popoverForeground: '#F4F4F5',
    primary: '#F05A9B', // Softer rose, calibrated for dark-surface legibility
    primaryForeground: '#0B0B0C',
    secondary: '#222224', // Neutral graphite — unselected chips, tabs, inactive controls
    secondaryForeground: '#F4F4F5',
    muted: '#222224',
    mutedForeground: '#A0A0A4', // Neutral light gray, AA-safe on dark bg
    accent: '#301723', // Quiet rose-on-black — now-playing row only
    accentForeground: '#FF9AC3',
    destructive: '#FF6052', // True red, hue-distinct from primary magenta
    destructiveForeground: '#0B0B0C',
    border: '#2A2A2D',
    input: '#2A2A2D',
    ring: '#F05A9B',
    text: '#F4F4F5',
    live: '#FFB547',
    liveForeground: '#100C16',
    raised: '#26262A',
    hairline: 'rgba(244, 244, 245, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.07)',

    // Button state variants
    primaryHover: '#F776AD',
    primaryActive: '#D94384',
    primaryDisabled: '#71354F',

    secondaryHover: '#2B2B2E',
    secondaryActive: '#363639',
    secondaryDisabled: '#19191A',

    accentHover: '#3B1C2B',
    accentActive: '#482237',
    accentDisabled: '#24121B',

    destructiveHover: '#FF7B70',
    destructiveActive: '#E84738',
    destructiveDisabled: '#7A332C',

    // Gradient colors
    gradients: {
      primary: ['#F982B6', '#F05A9B', '#D94384'],
      background: ['#0B0B0C', '#141415'],
      card: ['#19191B', '#212123'],
      accent: ['#301723', '#3B1C2B'],
      destructive: ['#FF8A7F', '#FF6052', '#E84738'],
      // Hero header backdrop: rose glow fading into the page background —
      // gives the header real depth without becoming a full-strength
      // saturated banner.
      header: ['#3F1D2D', '#28151F', '#0B0B0C'],
      button: ['#F982B6', '#F05A9B'],
      surface: ['rgba(244, 244, 245, 0.08)', 'rgba(244, 244, 245, 0.03)'],
    },
  },
};

// `default` points at the Mono palette (below) — the active theme ThemeContext reads via
// colorPalettes.default[theme]. Aubergine, Rose and Ember stay registered under their own keys
// so they aren't lost if you ever want to switch back or build a palette picker later.

// Aubergine — the SyncVibe brand palette, shared with the web app.
// Coloured darks instead of neutral black, magenta for actions, amber reserved
// for "live" presence (rooms, listeners).
const auberginePalette: ColorPalette = {
  name: 'Aubergine',
  description: 'SyncVibe brand palette: aubergine ink, magenta actions, amber live signals',
  light: {
    background: '#F7F5FA',
    foreground: '#1A1423',
    card: '#FFFFFF',
    cardForeground: '#1A1423',
    popover: '#FFFFFF',
    popoverForeground: '#1A1423',
    primary: '#D12F76',
    primaryForeground: '#FFFFFF',
    secondary: '#EFECF3',
    secondaryForeground: '#1A1423',
    muted: '#EFECF3',
    mutedForeground: '#655E70',
    accent: '#FBE4EF',
    accentForeground: '#7E1A47',
    destructive: '#C9302C',
    destructiveForeground: '#FFFFFF',
    border: '#E3DFE9',
    input: '#E3DFE9',
    ring: '#D12F76',
    text: '#1A1423',
    live: '#B86E00',
    liveForeground: '#FFFFFF',
    raised: '#F1EEF5',
    hairline: 'rgba(26, 20, 35, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    primaryHover: '#BB2969',
    primaryActive: '#A3235B',
    primaryDisabled: '#EBA9C6',
    secondaryHover: '#E7E3EC',
    secondaryActive: '#DDD8E4',
    secondaryDisabled: '#F7F5FA',
    accentHover: '#F8D5E6',
    accentActive: '#F4C3DA',
    accentDisabled: '#FDF2F7',
    destructiveHover: '#B32A27',
    destructiveActive: '#9C2421',
    destructiveDisabled: '#EBA9A7',

    gradients: {
      primary: ['#E2558F', '#D12F76', '#A3235B'],
      background: ['#F7F5FA', '#F7F5FA'],
      card: ['#FFFFFF', '#FBFAFD'],
      accent: ['#FBE4EF', '#F8D5E6'],
      destructive: ['#DA5450', '#C9302C', '#9C2421'],
      header: ['#F3EAF4', '#F7F5FA', '#F7F5FA'],
      button: ['#E2558F', '#D12F76'],
      surface: ['rgba(26, 20, 35, 0.05)', 'rgba(26, 20, 35, 0.02)'],
    },
  },
  // Dark: near-neutral graphite with a faint cool tint (not purple), three clearly
  // separated surface steps (background → card → raised), and the magenta kept for
  // actions only. Text pairs stay AA on every surface.
  dark: {
    background: '#0B0B0E',
    foreground: '#F3F2F6',
    card: '#16161B',
    cardForeground: '#F3F2F6',
    popover: '#1C1C22',
    popoverForeground: '#F3F2F6',
    primary: '#F0468F',
    primaryForeground: '#FFFFFF',
    secondary: '#1F1F25',
    secondaryForeground: '#F3F2F6',
    muted: '#1F1F25',
    mutedForeground: '#9C9AA5',
    accent: '#2B1520',
    accentForeground: '#FF9CC6',
    destructive: '#F95F5A',
    destructiveForeground: '#0B0B0E',
    border: '#26262D',
    input: '#26262D',
    ring: '#F0468F',
    text: '#F3F2F6',
    live: '#FFB547',
    liveForeground: '#0B0B0E',
    raised: '#222229',
    hairline: 'rgba(243, 242, 246, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.07)',

    primaryHover: '#F466A3',
    primaryActive: '#DA3A7E',
    primaryDisabled: '#6A2A47',
    secondaryHover: '#26262D',
    secondaryActive: '#2E2E36',
    secondaryDisabled: '#16161B',
    accentHover: '#36192A',
    accentActive: '#421F33',
    accentDisabled: '#1E1017',
    destructiveHover: '#FB7C78',
    destructiveActive: '#E04B46',
    destructiveDisabled: '#6E2E2C',

    gradients: {
      primary: ['#F56EA8', '#F0468F', '#DA3A7E'],
      background: ['#0B0B0E', '#101014'],
      card: ['#16161B', '#1A1A20'],
      accent: ['#2B1520', '#36192A'],
      destructive: ['#FB7C78', '#F95F5A', '#E04B46'],
      header: ['#1F1520', '#0B0B0E', '#0B0B0E'],
      button: ['#F56EA8', '#F0468F'],
      surface: ['rgba(243, 242, 246, 0.08)', 'rgba(243, 242, 246, 0.03)'],
    },
  },
};

// Mono — the active SyncVibe palette. Black and white with true neutral greys: hierarchy comes
// from surface steps and type weight, and colour is left to the artwork. Red stays for
// destructive actions only, because that's a warning rather than decoration. `primary` is the
// page's inverse, so every filled button reads as black on light and white on dark.
const monoPalette: ColorPalette = {
  name: 'Mono',
  description: 'Black and white with neutral greys; artwork supplies the colour',
  light: {
    background: '#F6F6F7',
    foreground: '#0E0E10',
    card: '#FFFFFF',
    cardForeground: '#0E0E10',
    popover: '#FFFFFF',
    popoverForeground: '#0E0E10',
    primary: '#0E0E10',
    primaryForeground: '#FFFFFF',
    secondary: '#EEEEF0',
    secondaryForeground: '#0E0E10',
    muted: '#EEEEF0',
    mutedForeground: '#67676E',
    accent: '#EEEEF0',
    accentForeground: '#0E0E10',
    destructive: '#C4302B',
    destructiveForeground: '#FFFFFF',
    border: '#E4E4E7',
    input: '#E4E4E7',
    ring: '#0E0E10',
    text: '#0E0E10',
    live: '#0E0E10',
    liveForeground: '#FFFFFF',
    raised: '#EEEEF0',
    hairline: 'rgba(14, 14, 16, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    primaryHover: '#2A2A2E',
    primaryActive: '#3A3A3F',
    primaryDisabled: '#B8B8BD',
    secondaryHover: '#E6E6E9',
    secondaryActive: '#DCDCE0',
    secondaryDisabled: '#F6F6F7',
    accentHover: '#E6E6E9',
    accentActive: '#DCDCE0',
    accentDisabled: '#F6F6F7',
    destructiveHover: '#AE2A26',
    destructiveActive: '#982420',
    destructiveDisabled: '#E9AAA8',

    gradients: {
      primary: ['#2A2A2E', '#0E0E10', '#000000'],
      background: ['#F6F6F7', '#F6F6F7'],
      card: ['#FFFFFF', '#FAFAFB'],
      accent: ['#EEEEF0', '#E6E6E9'],
      destructive: ['#D6524D', '#C4302B', '#982420'],
      header: ['#ECECEE', '#F6F6F7', '#F6F6F7'],
      button: ['#3B3B40', '#0E0E10'],
      surface: ['rgba(14, 14, 16, 0.05)', 'rgba(14, 14, 16, 0.02)'],
    },
  },
  dark: {
    background: '#0A0A0B',
    foreground: '#F5F5F6',
    card: '#151517',
    cardForeground: '#F5F5F6',
    popover: '#1B1B1E',
    popoverForeground: '#F5F5F6',
    primary: '#F5F5F6',
    primaryForeground: '#0A0A0B',
    secondary: '#1F1F22',
    secondaryForeground: '#F5F5F6',
    muted: '#1F1F22',
    mutedForeground: '#9B9BA3',
    accent: '#232326',
    accentForeground: '#F5F5F6',
    destructive: '#F2615C',
    destructiveForeground: '#0A0A0B',
    border: '#27272A',
    input: '#27272A',
    ring: '#F5F5F6',
    text: '#F5F5F6',
    live: '#F5F5F6',
    liveForeground: '#0A0A0B',
    raised: '#222225',
    hairline: 'rgba(245, 245, 246, 0.09)',
    sheen: 'rgba(255, 255, 255, 0.07)',

    primaryHover: '#E2E2E4',
    primaryActive: '#CFCFD2',
    primaryDisabled: '#55555A',
    secondaryHover: '#26262A',
    secondaryActive: '#2E2E32',
    secondaryDisabled: '#151517',
    accentHover: '#2A2A2E',
    accentActive: '#323236',
    accentDisabled: '#19191B',
    destructiveHover: '#F47F7B',
    destructiveActive: '#DB4B46',
    destructiveDisabled: '#6B2E2C',

    gradients: {
      primary: ['#3A3A3F', '#1F1F22', '#0A0A0B'],
      background: ['#0A0A0B', '#101012'],
      card: ['#151517', '#19191B'],
      accent: ['#232326', '#2A2A2E'],
      destructive: ['#F47F7B', '#F2615C', '#DB4B46'],
      header: ['#1B1B1E', '#0A0A0B', '#0A0A0B'],
      button: ['#FFFFFF', '#D5D5D8'],
      surface: ['rgba(245, 245, 246, 0.08)', 'rgba(245, 245, 246, 0.03)'],
    },
  },
};

export type ColorPaletteName = 'default' | 'mono' | 'aubergine' | 'rose' | 'ember';

export const colorPalettes: Record<ColorPaletteName, ColorPalette> = {
  default: monoPalette,
  mono: monoPalette,
  aubergine: auberginePalette,
  rose: rosePalette,
  ember: emberPalette,
};

export type ColorTheme = 'light' | 'dark';
