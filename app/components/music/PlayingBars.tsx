import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

const BARS = [9, 14, 11];

/** Three small bars that bounce while a song plays; a still glyph when paused or Reduce Motion. */
export const PlayingBars = memo(function PlayingBars({
  color,
  active,
}: {
  color: string;
  active: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.bars} accessibilityElementsHidden importantForAccessibility='no'>
      {BARS.map((h, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            { height: h, backgroundColor: color },
            active &&
              !reduced && {
                animationName: {
                  from: { transform: [{ scaleY: 0.35 }] },
                  to: { transform: [{ scaleY: 1 }] },
                },
                animationDuration: `${420 + i * 110}ms`,
                animationDirection: 'alternate',
                animationIterationCount: 'infinite',
                animationTimingFunction: 'ease-in-out',
              },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  bar: { width: 3, borderRadius: 1.5, transformOrigin: 'bottom' },
});
