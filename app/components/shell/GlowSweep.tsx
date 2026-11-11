import { EASE_IN_OUT } from '@/lib/motion';
import { memo, useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const SWEEP_MS = 900;
const FADE_IN = { duration: 90, easing: Easing.linear, reduceMotion: ReduceMotion.System };
const FADE_OUT = { duration: 260, easing: EASE_IN_OUT, reduceMotion: ReduceMotion.System };

/**
 * A comet of light that runs once around a rounded shape, then fades: the "something just
 * happened" moment for the orb and the capsule. Never a loop: one sweep per event costs a second
 * of frames, a loop would keep the screen redrawing forever. Only the stroke offset and opacity
 * animate (UI thread); the glow behind is a static shadow whose layer fades.
 */
function GlowSweep({
  width,
  height,
  radius,
  colors,
  play,
  delay = 0,
}: {
  width: number;
  height: number;
  radius: number;
  /** Gradient stops along the comet. */
  colors: string[];
  /** Bump to play the sweep once; 0 never plays. */
  play: number;
  delay?: number;
}) {
  const id = useId().replace(/:/g, '');
  const stroke = 2;
  const w = Math.max(0, width - stroke);
  const h = Math.max(0, height - stroke);
  const r = Math.min(radius - stroke / 2, h / 2);
  const perimeter = 2 * (w + h) - (8 - 2 * Math.PI) * r;
  const comet = Math.min(perimeter * 0.45, 260);

  const offset = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!play || width <= 0) return;
    offset.set(0);
    offset.set(
      withDelay(
        delay,
        withTiming(-perimeter, {
          duration: SWEEP_MS,
          easing: EASE_IN_OUT,
          reduceMotion: ReduceMotion.System,
        })
      )
    );
    opacity.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1, FADE_IN),
          withDelay(SWEEP_MS - FADE_IN.duration - FADE_OUT.duration, withTiming(0, FADE_OUT))
        )
      )
    );
  }, [play, delay, perimeter, width, offset, opacity]);

  const rectProps = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  const layer = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  if (width <= 0) return null;
  const glow = `0 0 18px ${colors[Math.floor(colors.length / 2)]}`;

  return (
    <Animated.View pointerEvents='none' style={[StyleSheet.absoluteFill, layer]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: glow }]} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={id} x1='0' y1='0' x2='1' y2='1'>
            {colors.map((c, i) => (
              <Stop key={c + i} offset={i / Math.max(1, colors.length - 1)} stopColor={c} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <AnimatedRect
          x={stroke / 2}
          y={stroke / 2}
          width={w}
          height={h}
          rx={r}
          ry={r}
          fill='none'
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap='round'
          strokeDasharray={[comet, perimeter]}
          animatedProps={rectProps}
        />
      </Svg>
    </Animated.View>
  );
}

export default memo(GlowSweep);
