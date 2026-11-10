import { useTheme } from '@/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/*
 * The app's surface finish, the native twin of the web's `.btn-primary`, `.btn-surface` and
 * `.bezel` (client/src/index.css): a soft top-to-bottom gradient, a hairline edge and a line of
 * light along the top. Everything here is static, so it costs nothing once drawn.
 */

type Pair = [string, string];

/**
 * The fill for a button or chip. Put it first inside a pressable that clips its children
 * (`overflow: 'hidden'`) and has a border radius; it sits behind the label.
 *  - `primary`: the filled action. One per screen.
 *  - `surface`: quiet actions and chips. Pair it with a `colors.hairline` border.
 */
export const Gloss = memo(function Gloss({ tone = 'primary' }: { tone?: 'primary' | 'surface' }) {
  const { colors } = useTheme();
  const fill = tone === 'primary' ? colors.gradients.button : colors.gradients.surface;
  return (
    <>
      <LinearGradient colors={fill as Pair} style={StyleSheet.absoluteFill} pointerEvents='none' />
      {tone === 'primary' && <View pointerEvents='none' style={styles.buttonSheen} />}
    </>
  );
});

/**
 * A double-framed card for the one thing a screen is about: an outer rim, then the card itself
 * fading from `card` into the page. Ordinary cards stay single and flat.
 */
export const Bezel = memo(function Bezel({
  children,
  style,
  contentStyle,
  radius = 28,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.rim,
        {
          borderRadius: radius,
          borderColor: colors.hairline,
          backgroundColor: colors.gradients.surface[1],
        },
        style,
      ]}
    >
      <View style={[styles.inner, { borderRadius: radius - RIM, borderColor: colors.hairline }]}>
        <LinearGradient
          colors={[colors.card, colors.background] as Pair}
          style={StyleSheet.absoluteFill}
          pointerEvents='none'
        />
        <View pointerEvents='none' style={[styles.cardSheen, { backgroundColor: colors.sheen }]} />
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
});

const RIM = 5;

const styles = StyleSheet.create({
  buttonSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  rim: { padding: RIM, borderWidth: StyleSheet.hairlineWidth },
  inner: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
