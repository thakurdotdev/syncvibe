import { MaterialYou, type MaterialYouPalettes, type Shades } from '@/modules/material-you';
import type { ColorPalette, ThemeColors } from '@/theme/color';

/*
 * The "Material You" theme: Android 12+ wallpaper colours mapped onto our colour roles with the
 * tones Material 3 uses for each role (primary is tone 40 in light and 80 in dark, its text 100
 * and 20, and so on), so every text and background pair keeps Material's contrast. The finish
 * is flat, like Material: no button gloss or sheen.
 */

/** The Material tone of each shade Android gives, in order (shade 0 is tone 100). */
const SHADE_TONES = [100, 99, 95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0];

function parse(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: number[]) {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `a` moved toward `b` by `t` (0–1). */
function mix(a: string, b: string, t: number) {
  const x = parse(a);
  const y = parse(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * One tone of a palette. Android only gives 13 of them; Material's surface tones in between
 * (98, 96, 6, 12…) are mixed from the two nearest, which is close enough on near-grey neutrals.
 */
function tone(shades: Shades, t: number) {
  for (let i = 0; i < SHADE_TONES.length - 1; i++) {
    const hi = SHADE_TONES[i];
    const lo = SHADE_TONES[i + 1];
    if (t <= hi && t >= lo) return mix(shades[i], shades[i + 1], (hi - t) / (hi - lo));
  }
  return shades[SHADE_TONES.length - 1];
}

// Material's error colours: they stay red whatever the wallpaper is.
const ERROR = {
  light: { error: '#BA1A1A', onError: '#FFFFFF' },
  dark: { error: '#FFB4AB', onError: '#690005' },
};

function scheme(p: MaterialYouPalettes, dark: boolean): ThemeColors {
  const { accent1: a1, accent2: a2, accent3: a3, neutral1: n1, neutral2: n2 } = p;
  // Light and dark tones for one role.
  const t = (shades: Shades, light: number, night: number) => tone(shades, dark ? night : light);

  const background = t(n1, 96, 6);
  const card = t(n1, 99, 12);
  const popover = t(n1, 100, 17);
  const raised = t(n1, 92, 22);
  const foreground = t(n1, 10, 90);
  const mutedForeground = t(n2, 30, 80);
  const primary = t(a1, 40, 80);
  const onPrimary = t(a1, 100, 20);
  const primaryContainer = t(a1, 90, 30);
  const onPrimaryContainer = t(a1, 10, 90);
  const secondaryContainer = t(a2, 90, 30);
  const onSecondaryContainer = t(a2, 10, 90);
  const outlineVariant = t(n2, 80, 30);
  const { error, onError } = dark ? ERROR.dark : ERROR.light;

  // Material's pressed state: the content colour laid over the container at 10%.
  const pressed = (container: string, content: string) => mix(container, content, 0.1);
  const hovered = (container: string, content: string) => mix(container, content, 0.08);
  const disabled = (color: string) => mix(color, background, 0.6);

  return {
    background,
    foreground,
    card,
    cardForeground: foreground,
    popover,
    popoverForeground: foreground,
    primary,
    primaryForeground: onPrimary,
    secondary: secondaryContainer,
    secondaryForeground: onSecondaryContainer,
    muted: raised,
    mutedForeground,
    accent: primaryContainer,
    accentForeground: onPrimaryContainer,
    destructive: error,
    destructiveForeground: onError,
    border: outlineVariant,
    input: outlineVariant,
    ring: primary,
    text: foreground,
    live: t(a3, 40, 80),
    liveForeground: t(a3, 100, 20),
    receipt: dark ? '#53BDEB' : '#0B7BC2',
    raised,
    hairline: withAlpha(foreground, 0.09),
    sheen: 'rgba(255, 255, 255, 0)',

    primaryHover: hovered(primary, onPrimary),
    primaryActive: pressed(primary, onPrimary),
    primaryDisabled: disabled(primary),
    secondaryHover: hovered(secondaryContainer, onSecondaryContainer),
    secondaryActive: pressed(secondaryContainer, onSecondaryContainer),
    secondaryDisabled: disabled(secondaryContainer),
    accentHover: hovered(primaryContainer, onPrimaryContainer),
    accentActive: pressed(primaryContainer, onPrimaryContainer),
    accentDisabled: disabled(primaryContainer),
    destructiveHover: hovered(error, onError),
    destructiveActive: pressed(error, onError),
    destructiveDisabled: disabled(error),

    gradients: {
      primary: [primary, primary, pressed(primary, onPrimary)],
      background: [background, background],
      card: [card, card],
      accent: [primaryContainer, primaryContainer],
      destructive: [error, error, pressed(error, onError)],
      header: [mix(background, primaryContainer, 0.5), background, background],
      button: [primary, primary],
      surface: [withAlpha(foreground, 0.06), withAlpha(foreground, 0.06)],
    },
  };
}

function build(p: MaterialYouPalettes): ColorPalette {
  return {
    name: 'Material You',
    description: 'Colours from your wallpaper',
    light: scheme(p, false),
    dark: scheme(p, true),
  };
}

function isPalettes(value: unknown): value is MaterialYouPalettes {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['accent1', 'accent2', 'accent3', 'neutral1', 'neutral2'].every(
    (k) =>
      Array.isArray(v[k]) &&
      (v[k] as unknown[]).length === SHADE_TONES.length &&
      (v[k] as unknown[]).every((c) => typeof c === 'string' && /^#[0-9A-F]{6}$/i.test(c))
  );
}

let cached: { key: string; palette: ColorPalette } | null = null;

/**
 * The wallpaper's palette, or null where there is none (iOS, Android 11 and older, an app
 * build without the module). The same object comes back while the wallpaper is unchanged, so
 * it's safe to call on every return to the app.
 */
export function readMaterialYouPalette(): ColorPalette | null {
  let raw: unknown = null;
  try {
    raw = MaterialYou?.getPalettes() ?? null;
  } catch {
    return null;
  }
  if (!isPalettes(raw)) return null;
  const key = JSON.stringify(raw);
  if (cached?.key !== key) cached = { key, palette: build(raw) };
  return cached.palette;
}
