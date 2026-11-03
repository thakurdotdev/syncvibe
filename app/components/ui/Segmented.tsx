import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { SPRING } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Segmented control with a sliding selection pill (same spring as the tab bar).
 * Generic so settings, filters and room panels all look and move the same way.
 */
function SegmentedInner<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors, theme } = useTheme();
  // Light: grey track, white pill. Dark: card track, a raised pill that sits above it.
  const trackBg = theme === 'dark' ? colors.card : colors.raised;
  const pillBg = theme === 'dark' ? colors.raised : colors.card;
  const [width, setWidth] = useState(0);
  const segment = width / options.length;
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const x = useSharedValue(-1);

  useEffect(() => {
    if (!segment) return;
    const target = index * segment;
    x.set(x.get() < 0 ? target : withSpring(target, SPRING));
  }, [index, segment, x]);

  const pill = useAnimatedStyle(() => ({
    opacity: x.get() < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(0, x.get()) }],
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: trackBg }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
      accessibilityRole='radiogroup'
      accessibilityLabel={accessibilityLabel}
    >
      {segment > 0 && (
        <Animated.View style={[styles.pill, { width: segment, backgroundColor: pillBg }, pill]} />
      )}
      {options.map((o) => {
        const selected = o.value === value;
        const color = selected ? colors.foreground : colors.mutedForeground;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            scaleTo={0.95}
            accessibilityRole='radio'
            accessibilityState={{ checked: selected }}
            accessibilityLabel={o.label}
            style={styles.option}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={15} color={selected ? colors.primary : color} />
            ) : null}
            <Text style={[styles.label, { color }, selected && styles.labelActive]}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export const Segmented = memo(SegmentedInner) as typeof SegmentedInner;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 14, padding: 4, height: 44 },
  pill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 13.5, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
