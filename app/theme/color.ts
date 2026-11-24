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
  /** The "read" tick on a message. Blue on purpose: it has to stand apart from "delivered". */
  receipt: string;
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

// Mono, Ember and Aubergine share one lightness scale (OKLCH lightness), so switching
// theme changes hue, never hierarchy. Light: page 0.966, card and popover white, raised 0.942,
// border 0.892. Dark: page 0.20, card 0.245, popover 0.268, raised 0.29, border 0.335; the page is
// a soft graphite rather than black, and text is off-white (about 15:1, not 18:1) to avoid glare.
// Every text pair is at least 4.5:1 on page, card and raised; filled buttons are light with dark
// labels in dark mode. States: hover 8% and pressed 14% of the label over the fill.
//
// Ember: orange actions on warm greys, amber for live presence.
const emberPalette: ColorPalette = {
  name: 'Ember',
  description: 'Warm orange on warm greys',
  light: {
    background: '#F7F3F0',
    foreground: '#191512',
    card: '#FFFFFF',
    cardForeground: '#191512',
    popover: '#FFFFFF',
    popoverForeground: '#191512',
    primary: '#C2460D',
    primaryForeground: '#FFFFFF',
    secondary: '#EFEBE8',
    secondaryForeground: '#191512',
    muted: '#EFEBE8',
    mutedForeground: '#6A615B',
    accent: '#FFE6DC',
    accentForeground: '#842B02',
    destructive: '#C22826',
    destructiveForeground: '#FFFFFF',
    border: '#E0DAD6',
    input: '#E0DAD6',
    ring: '#C2460D',
    text: '#191512',
    live: '#935A00',
    liveForeground: '#FFFFFF',
    receipt: '#0B7BC2',
    raised: '#EFEBE8',
    hairline: 'rgba(25, 21, 18, 0.1)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    primaryHover: '#C75520',
    primaryActive: '#CB602F',
    primaryDisabled: '#DFA58A',
    secondaryHover: '#DEDAD7',
    secondaryActive: '#D1CDCA',
    secondaryDisabled: '#F3EFEC',
    accentHover: '#F5D7CB',
    accentActive: '#EECCBD',
    accentDisabled: '#FBEDE7',
    destructiveHover: '#C73937',
    destructiveActive: '#CB4644',
    destructiveDisabled: '#DF9895',

    gradients: {
      primary: ['#C95C2A', '#C2460D', '#AB3E0B'],
      background: ['#F7F3F0', '#F7F3F0'],
      card: ['#FFFFFF', '#FFFFFF'],
      accent: ['#FFE6DC', '#F5D7CB'],
      destructive: ['#C94240', '#C22826', '#AB2321'],
      header: ['#FDEAE2', '#F7F3F0', '#F7F3F0'],
      button: ['#CB602F', '#C2460D'],
      surface: ['rgba(25, 21, 18, 0.05)', 'rgba(25, 21, 18, 0.02)'],
    },
  },
  dark: {
    background: '#181513',
    foreground: '#EEE8E4',
    card: '#23201E',
    cardForeground: '#EEE8E4',
    popover: '#282523',
    popoverForeground: '#EEE8E4',
    primary: '#FB864D',
    primaryForeground: '#21110A',
    secondary: '#2E2B28',
    secondaryForeground: '#EEE8E4',
    muted: '#282523',
    mutedForeground: '#AFA69E',
    accent: '#492515',
    accentForeground: '#FFBC9D',
    destructive: '#FA706A',
    destructiveForeground: '#22100F',
    border: '#3A3632',
    input: '#3A3632',
    ring: '#FB864D',
    text: '#EEE8E4',
    live: '#F9B64F',
    liveForeground: '#181513',
    receipt: '#53BDEB',
    raised: '#2E2B28',
    hairline: 'rgba(238, 232, 228, 0.1)',
    sheen: 'rgba(255, 255, 255, 0.06)',

    primaryHover: '#EA7D48',
    primaryActive: '#DC7644',
    primaryDisabled: '#7E482D',
    secondaryHover: '#3D3A37',
    secondaryActive: '#494542',
    secondaryDisabled: '#221F1C',
    accentHover: '#583120',
    accentActive: '#623A28',
    accentDisabled: '#2E1C14',
    destructiveHover: '#E96863',
    destructiveActive: '#DC635D',
    destructiveDisabled: '#7E3E3A',

    gradients: {
      primary: ['#FB9562', '#FB864D', '#DD7644'],
      background: ['#181513', '#181513'],
      card: ['#23201E', '#23201E'],
      accent: ['#492515', '#583120'],
      destructive: ['#FB817C', '#FA706A', '#DC635D'],
      header: ['#442315', '#181513', '#181513'],
      button: ['#FB925F', '#FB864D'],
      surface: ['rgba(238, 232, 228, 0.07)', 'rgba(238, 232, 228, 0.03)'],
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
    receipt: '#0B7BC2',
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
    receipt: '#53BDEB',
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

// Aubergine — the SyncVibe brand palette: plum-tinted greys, magenta for actions, amber reserved
// for "live" presence (rooms, listeners). Same scale as Ember above.
const auberginePalette: ColorPalette = {
  name: 'Aubergine',
  description: 'SyncVibe brand palette: plum greys, magenta actions, amber live signals',
  light: {
    background: '#F7F2F8',
    foreground: '#19141A',
    card: '#FFFFFF',
    cardForeground: '#19141A',
    popover: '#FFFFFF',
    popoverForeground: '#19141A',
    primary: '#C02270',
    primaryForeground: '#FFFFFF',
    secondary: '#EFEAF0',
    secondaryForeground: '#19141A',
    muted: '#EFEAF0',
    mutedForeground: '#695F6B',
    accent: '#FFE4ED',
    accentForeground: '#80264E',
    destructive: '#C22826',
    destructiveForeground: '#FFFFFF',
    border: '#DFD9E1',
    input: '#DFD9E1',
    ring: '#C02270',
    text: '#19141A',
    live: '#935A00',
    liveForeground: '#FFFFFF',
    receipt: '#0B7BC2',
    raised: '#EFEAF0',
    hairline: 'rgba(25, 20, 26, 0.1)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    primaryHover: '#C5347B',
    primaryActive: '#C94184',
    primaryDisabled: '#DE94BB',
    secondaryHover: '#DED9DF',
    secondaryActive: '#D1CCD2',
    secondaryDisabled: '#F3EEF4',
    accentHover: '#F5D5E0',
    accentActive: '#EDC9D7',
    accentDisabled: '#FBECF3',
    destructiveHover: '#C73937',
    destructiveActive: '#CB4644',
    destructiveDisabled: '#DF979A',

    gradients: {
      primary: ['#C83D81', '#C02270', '#A91E63'],
      background: ['#F7F2F8', '#F7F2F8'],
      card: ['#FFFFFF', '#FFFFFF'],
      accent: ['#FFE4ED', '#F5D5E0'],
      destructive: ['#C94240', '#C22826', '#AB2321'],
      header: ['#FDE8F0', '#F7F2F8', '#F7F2F8'],
      button: ['#C94184', '#C02270'],
      surface: ['rgba(25, 20, 26, 0.05)', 'rgba(25, 20, 26, 0.02)'],
    },
  },
  dark: {
    background: '#181519',
    foreground: '#EEE7EF',
    card: '#221F23',
    cardForeground: '#EEE7EF',
    popover: '#282529',
    popoverForeground: '#EEE7EF',
    primary: '#F87BAC',
    primaryForeground: '#211016',
    secondary: '#2D2A2E',
    secondaryForeground: '#EEE7EF',
    muted: '#282529',
    mutedForeground: '#AEA3B1',
    accent: '#482231',
    accentForeground: '#FFB6CE',
    destructive: '#FA706A',
    destructiveForeground: '#22100F',
    border: '#3A343B',
    input: '#3A343B',
    ring: '#F87BAC',
    text: '#EEE7EF',
    live: '#F9B64F',
    liveForeground: '#181519',
    receipt: '#53BDEB',
    raised: '#2D2A2E',
    hairline: 'rgba(238, 231, 239, 0.1)',
    sheen: 'rgba(255, 255, 255, 0.06)',

    primaryHover: '#E772A0',
    primaryActive: '#DA6C97',
    primaryDisabled: '#7D435B',
    secondaryHover: '#3C393D',
    secondaryActive: '#484449',
    secondaryDisabled: '#211E22',
    accentHover: '#572E3E',
    accentActive: '#623747',
    accentDisabled: '#2E1B24',
    destructiveHover: '#E96863',
    destructiveActive: '#DC635D',
    destructiveDisabled: '#7E3E3D',

    gradients: {
      primary: ['#F98BB6', '#F87BAC', '#DA6C97'],
      background: ['#181519', '#181519'],
      card: ['#221F23', '#221F23'],
      accent: ['#482231', '#572E3E'],
      destructive: ['#FB817C', '#FA706A', '#DC635D'],
      header: ['#43212F', '#181519', '#181519'],
      button: ['#F988B4', '#F87BAC'],
      surface: ['rgba(238, 231, 239, 0.07)', 'rgba(238, 231, 239, 0.03)'],
    },
  },
};

// Mono — the default. Black and white with true neutral greys: hierarchy comes from surface
// steps and type weight, and colour is left to the artwork. Red stays for destructive actions
// only. `primary` is the page's inverse, so filled buttons are black on light and off-white on
// dark. Same scale as Ember above.
const monoPalette: ColorPalette = {
  name: 'Mono',
  description: 'Black and white with neutral greys; artwork supplies the colour',
  light: {
    background: '#F4F4F4',
    foreground: '#161616',
    card: '#FFFFFF',
    cardForeground: '#161616',
    popover: '#FFFFFF',
    popoverForeground: '#161616',
    primary: '#161616',
    primaryForeground: '#FFFFFF',
    secondary: '#ECECEC',
    secondaryForeground: '#161616',
    muted: '#ECECEC',
    mutedForeground: '#636363',
    accent: '#ECECEC',
    accentForeground: '#161616',
    destructive: '#C22826',
    destructiveForeground: '#FFFFFF',
    border: '#DBDBDB',
    input: '#DBDBDB',
    ring: '#161616',
    text: '#161616',
    live: '#161616',
    liveForeground: '#FFFFFF',
    receipt: '#0B7BC2',
    raised: '#ECECEC',
    hairline: 'rgba(22, 22, 22, 0.1)',
    sheen: 'rgba(255, 255, 255, 0.9)',

    primaryHover: '#292929',
    primaryActive: '#373737',
    primaryDisabled: '#909090',
    secondaryHover: '#DBDBDB',
    secondaryActive: '#CECECE',
    secondaryDisabled: '#F0F0F0',
    accentHover: '#DBDBDB',
    accentActive: '#CECECE',
    accentDisabled: '#F0F0F0',
    destructiveHover: '#C73937',
    destructiveActive: '#CB4644',
    destructiveDisabled: '#DE9897',

    gradients: {
      primary: ['#323232', '#161616', '#131313'],
      background: ['#F4F4F4', '#F4F4F4'],
      card: ['#FFFFFF', '#FFFFFF'],
      accent: ['#ECECEC', '#DBDBDB'],
      destructive: ['#C94240', '#C22826', '#AB2321'],
      header: ['#ECECEC', '#F4F4F4', '#F4F4F4'],
      button: ['#373737', '#161616'],
      surface: ['rgba(22, 22, 22, 0.05)', 'rgba(22, 22, 22, 0.02)'],
    },
  },
  dark: {
    background: '#161616',
    foreground: '#E9E9E9',
    card: '#202020',
    cardForeground: '#E9E9E9',
    popover: '#262626',
    popoverForeground: '#E9E9E9',
    primary: '#E9E9E9',
    primaryForeground: '#161616',
    secondary: '#2B2B2B',
    secondaryForeground: '#E9E9E9',
    muted: '#262626',
    mutedForeground: '#A8A8A8',
    accent: '#2B2B2B',
    accentForeground: '#E9E9E9',
    destructive: '#FA706A',
    destructiveForeground: '#22100F',
    border: '#373737',
    input: '#373737',
    ring: '#E9E9E9',
    text: '#E9E9E9',
    live: '#E9E9E9',
    liveForeground: '#161616',
    receipt: '#53BDEB',
    raised: '#2B2B2B',
    hairline: 'rgba(233, 233, 233, 0.1)',
    sheen: 'rgba(255, 255, 255, 0.06)',

    primaryHover: '#D8D8D8',
    primaryActive: '#CBCBCB',
    primaryDisabled: '#757575',
    secondaryHover: '#3A3A3A',
    secondaryActive: '#464646',
    secondaryDisabled: '#1F1F1F',
    accentHover: '#3A3A3A',
    accentActive: '#464646',
    accentDisabled: '#1F1F1F',
    destructiveHover: '#E96863',
    destructiveActive: '#DC635D',
    destructiveDisabled: '#7D3E3C',

    gradients: {
      primary: ['#ECECEC', '#E9E9E9', '#CDCDCD'],
      background: ['#161616', '#161616'],
      card: ['#202020', '#202020'],
      accent: ['#2B2B2B', '#3A3A3A'],
      destructive: ['#FB817C', '#FA706A', '#DC635D'],
      header: ['#2B2B2B', '#161616', '#161616'],
      button: ['#FFFFFF', '#D4D4D4'],
      surface: ['rgba(233, 233, 233, 0.07)', 'rgba(233, 233, 233, 0.03)'],
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

/**
 * Themes offered in Settings → Appearance, in order. Mono is the default. `material` is the
 * wallpaper's colours (theme/materialYou.ts), offered only where Android provides them.
 */
export const THEME_CHOICES = ['mono', 'ember', 'aubergine', 'material'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  (THEME_CHOICES as readonly unknown[]).includes(value);

/** A theme's palette. Material You falls back to Mono where the wallpaper's colours are missing. */
export const paletteFor = (choice: ThemeChoice, materialYou: ColorPalette | null): ColorPalette =>
  choice === 'material' ? (materialYou ?? monoPalette) : colorPalettes[choice];
