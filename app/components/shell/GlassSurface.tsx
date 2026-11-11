import { useTheme } from '@/context/ThemeContext';
import { useDeckStore } from '@/stores/deckStore';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createRef, memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * What the bottom bar blurs on Android: the root layout wraps the screens in a BlurTargetView with
 * this ref. The player and banners sit outside it, so they never cost the blur a redraw.
 */
export const deckBlurTarget = createRef<View>();

/**
 * Real blur only where it's cheap: iOS, and Android 12+ (RenderEffect). Older Android gets the
 * solid card instead of a see-through tint with nothing blurred behind it.
 */
export const GLASS_SUPPORTED =
  Platform.OS === 'ios' || (Platform.OS === 'android' && Number(Platform.Version) >= 31);

/** `#RRGGBB` → `rgba(r, g, b, a)`. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

type GlassSurfaceProps = {
  children?: ReactNode;
  radius: number;
  style?: StyleProp<ViewStyle>;
  /** Style for the clipped inner layer (padding, flex direction). */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * The floating bar's surface: a fixed blur, a theme tint strong enough for text over bright album
 * art, a faint sheen on the upper half and a hairline edge. Nothing here animates: callers fade or
 * move the whole surface, never the blur itself.
 */
function GlassSurface({ children, radius, style, contentStyle }: GlassSurfaceProps) {
  const { colors, theme } = useTheme();
  const glassOn = useDeckStore((s) => s.glass);
  const glass = GLASS_SUPPORTED && glassOn;
  const dark = theme === 'dark';
  const shadow = dark ? '0 8px 24px rgba(0, 0, 0, 0.5)' : '0 8px 24px rgba(22, 22, 26, 0.12)';

  return (
    <View style={[{ borderRadius: radius, boxShadow: shadow }, style]}>
      <View
        style={[
          styles.clip,
          {
            borderRadius: radius,
            borderColor: colors.hairline,
            backgroundColor: glass ? 'transparent' : colors.card,
          },
          contentStyle,
        ]}
      >
        {glass ? (
          <>
            <BlurView
              blurTarget={deckBlurTarget}
              blurMethod='dimezisBlurViewSdk31Plus'
              intensity={50}
              tint={dark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            {/* Blur tint (~40%) plus this lands near 65% card: labels stay readable on any art. */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: withAlpha(colors.card, dark ? 0.4 : 0.42) },
              ]}
            />
            <LinearGradient
              colors={[colors.sheen, 'transparent']}
              locations={[0, 0.55]}
              style={[StyleSheet.absoluteFill, { opacity: dark ? 0.5 : 0.35 }]}
              pointerEvents='none'
            />
          </>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default memo(GlassSurface);
