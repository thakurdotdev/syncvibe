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

// Professional, vibrant music player palette — magenta/rose accent variant.
// This is now the ACTIVE default (see colorPalettes export below).
// Calibration notes specific to this variant:
// - Primary is a deepened magenta-rose, not candy/hot pink — reads as
//   confident and premium rather than playful or "dating app." Light
//   mode primary (#DB2777) is calibrated to 4.60:1 contrast with white
//   text; dark mode primary (#FF4FA3) hits 6.46:1 with near-black text.
// - Destructive was deliberately pulled to a true red (not the usual
//   rose-adjacent red) to keep ~30°+ of hue separation from primary —
//   with a pink primary, "delete" and "the brand color" sit too close
//   on the wheel unless destructive is pushed further away.
const rosePalette: ColorPalette = {
  name: 'Rose',
  description: 'Professional, vibrant music player palette with a magenta-rose accent',
  light: {
    // Main palette
    background: '#F3F4F6',
    foreground: '#16161A', // True near-black, zero hue tint
    card: '#FFFFFF',
    cardForeground: '#16161A',
    popover: '#FFFFFF',
    popoverForeground: '#16161A',
    primary: '#DB2777', // Magenta-rose — calibrated to pass 4.5:1 AA with white text
    primaryForeground: '#FFFFFF',
    secondary: '#F3F3F4', // Neutral gray, no hue cast
    secondaryForeground: '#16161A',
    muted: '#F3F3F4',
    mutedForeground: '#6B6B70', // Neutral mid-gray, AA-safe for secondary text
    accent: '#FCE4F0', // Quiet rose wash — selection / now-playing state only
    accentForeground: '#7A1245',
    destructive: '#CC2819', // True red, deliberately hue-separated from primary
    destructiveForeground: '#FFFFFF',
    border: '#E5E5E7',
    input: '#E5E5E7',
    ring: '#DB2777',
    text: '#16161A',

    // Button state variants
    primaryHover: '#BE1C68',
    primaryActive: '#A1175A',
    primaryDisabled: '#EFA8C9',

    secondaryHover: '#E8E8EA',
    secondaryActive: '#DCDCDE',
    secondaryDisabled: '#FAFAFA',

    accentHover: '#F9D2E5',
    accentActive: '#F5BDD9',
    accentDisabled: '#FDF0F7',

    destructiveHover: '#B32316',
    destructiveActive: '#991E12',
    destructiveDisabled: '#E9A89F',

    // Gradient colors
    gradients: {
      primary: ['#EC4A93', '#DB2777', '#A1175A'],
      background: ['#F3F4F6', '#F3F4F6'],
      card: ['#FFFFFF', '#FCFCFC'],
      accent: ['#FCE4F0', '#F9D2E5'],
      destructive: ['#DC4A3D', '#CC2819', '#991E12'],
      // Hero header backdrop: a soft, low-saturation wash of primary —
      // visible enough to give the header presence behind the search
      // bar, far quieter than the full-strength `primary` gradient.
      header: ['#FBE9F1', '#F9D8E7', '#FCEEF4'],
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
    primary: '#FF4FA3', // Magenta-rose, calibrated brighter for dark-surface legibility
    primaryForeground: '#0B0B0C',
    secondary: '#222224', // Neutral graphite — unselected chips, tabs, inactive controls
    secondaryForeground: '#F4F4F5',
    muted: '#222224',
    mutedForeground: '#A0A0A4', // Neutral light gray, AA-safe on dark bg
    accent: '#321524', // Quiet rose-on-black — now-playing row only
    accentForeground: '#FF8DC0',
    destructive: '#FF6052', // True red, hue-distinct from primary magenta
    destructiveForeground: '#0B0B0C',
    border: '#2A2A2D',
    input: '#2A2A2D',
    ring: '#FF4FA3',
    text: '#F4F4F5',

    // Button state variants
    primaryHover: '#FF6FB4',
    primaryActive: '#E8388F',
    primaryDisabled: '#7A3A5C',

    secondaryHover: '#2B2B2E',
    secondaryActive: '#363639',
    secondaryDisabled: '#19191A',

    accentHover: '#3C1A2D',
    accentActive: '#482036',
    accentDisabled: '#23101A',

    destructiveHover: '#FF7B70',
    destructiveActive: '#E84738',
    destructiveDisabled: '#7A332C',

    // Gradient colors
    gradients: {
      primary: ['#FF7DBC', '#FF4FA3', '#E8388F'],
      background: ['#0B0B0C', '#141415'],
      card: ['#19191B', '#212123'],
      accent: ['#321524', '#3C1A2D'],
      destructive: ['#FF8A7F', '#FF6052', '#E84738'],
      // Hero header backdrop: rose glow fading into the page background —
      // gives the header real depth without becoming a full-strength
      // saturated banner.
      header: ['#411A2D', '#28131E', '#0B0B0C'],
    },
  },
};

// `default` now points at the rose palette — this is the active theme
// your ThemeContext reads via colorPalettes['default'][theme]. Ember
// stays registered under its own key so it isn't lost if you ever want
// to switch back or build a palette picker later.
export const colorPalettes: Record<string, ColorPalette> = {
  default: rosePalette,
  rose: rosePalette,
  ember: emberPalette,
};

export type ColorTheme = 'light' | 'dark';