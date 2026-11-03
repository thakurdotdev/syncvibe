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
    },
  },
};

// Professional, vibrant music player palette — refined magenta/rose accent variant.
// Kept registered as `rose`; the active default is Aubergine below.
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
    },
  },
};

// `default` points at the Aubergine palette — the active theme ThemeContext reads via
// colorPalettes.default[theme]. Rose and Ember stay registered under their own keys so
// they aren't lost if you ever want to switch back or build a palette picker later.

// Aubergine — the SyncVibe brand palette, shared with the web app.
// Coloured darks instead of neutral black, magenta for actions, amber reserved
// for "live" presence (rooms, listeners). This is the ACTIVE default.
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
    },
  },
  dark: {
    background: '#100C16',
    foreground: '#F2EDF7',
    card: '#1B1624',
    cardForeground: '#F2EDF7',
    popover: '#211B2B',
    popoverForeground: '#F2EDF7',
    primary: '#F0468F',
    primaryForeground: '#FFFFFF',
    secondary: '#241E2E',
    secondaryForeground: '#F2EDF7',
    muted: '#241E2E',
    mutedForeground: '#A59EAD',
    accent: '#331C29',
    accentForeground: '#FF99C8',
    destructive: '#F95F5A',
    destructiveForeground: '#100C16',
    border: '#2B2435',
    input: '#2B2435',
    ring: '#F0468F',
    text: '#F2EDF7',
    live: '#FFB547',
    liveForeground: '#100C16',
    raised: '#241D2F',

    primaryHover: '#F466A3',
    primaryActive: '#DA3A7E',
    primaryDisabled: '#6E2A49',
    secondaryHover: '#2C2537',
    secondaryActive: '#352D41',
    secondaryDisabled: '#1B1624',
    accentHover: '#3E2232',
    accentActive: '#4A283B',
    accentDisabled: '#22141C',
    destructiveHover: '#FB7C78',
    destructiveActive: '#E04B46',
    destructiveDisabled: '#6E2E2C',

    gradients: {
      primary: ['#F56EA8', '#F0468F', '#DA3A7E'],
      background: ['#100C16', '#15111C'],
      card: ['#1B1624', '#1F1929'],
      accent: ['#331C29', '#3E2232'],
      destructive: ['#FB7C78', '#F95F5A', '#E04B46'],
      header: ['#2A1A2A', '#100C16', '#100C16'],
    },
  },
};

export type ColorPaletteName = 'default' | 'aubergine' | 'rose' | 'ember';

export const colorPalettes: Record<ColorPaletteName, ColorPalette> = {
  default: auberginePalette,
  aubergine: auberginePalette,
  rose: rosePalette,
  ember: emberPalette,
};

export type ColorTheme = 'light' | 'dark';
