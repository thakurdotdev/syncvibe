import { useTheme } from '@/context/ThemeContext';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

const TRACK_W = 44;
const TRACK_H = 26;
const THUMB = 20;
const INSET = (TRACK_H - THUMB) / 2;
const TRAVEL = TRACK_W - THUMB - INSET * 2;

// State-driven CSS transitions: nothing runs until the value flips. Every key is set in both
// states, so nothing is left behind when a value turns off.
const TIMING = {
  transitionDuration: 180,
  transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
} as const;
const TRACK_TRANSITION = { ...TIMING, transitionProperty: 'backgroundColor' } as const;
const THUMB_TRANSITION = { ...TIMING, transitionProperty: 'transform' } as const;

/**
 * The app's on/off switch: a 44×26 track that fills with the theme's primary colour, and a round
 * thumb that slides across in 180ms. Replaces the platform Switch, which looks different on every
 * Android skin. Put it in a SettingsRow's `trailing`; the row can toggle it too.
 */
function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole='switch'
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={disabled && styles.disabled}
    >
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: value ? colors.primary : colors.border },
          TRACK_TRANSITION,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: value ? colors.primaryForeground : colors.card,
              transform: [{ translateX: value ? TRAVEL : 0 }],
            },
            THUMB_TRANSITION,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: INSET },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  },
  disabled: { opacity: 0.45 },
});

export default memo(Toggle);
