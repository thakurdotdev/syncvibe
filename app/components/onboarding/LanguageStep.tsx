import { PRESS_IN, PRESS_SCALE, SPRING_PRESS, STATE } from '@/lib/motion';
import { useTheme } from '@/context/ThemeContext';
import { LANGUAGES } from '@/lib/languages';
import { typography } from '@/theme/typography';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const H_PADDING = 24;
const GAP = 8;
const COLUMNS = 3;

interface LanguageChipProps {
  label: string;
  native: string;
  selected: boolean;
  width: number;
  onPress: () => void;
}

const LanguageChip = memo(function LanguageChip({
  label,
  native,
  selected,
  width,
  onPress,
}: LanguageChipProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const fill = useDerivedValue(() => withTiming(selected ? 1 : 0, STATE), [selected]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: interpolateColor(fill.get(), [0, 1], [colors.card, colors.primary]),
    borderColor: interpolateColor(fill.get(), [0, 1], [colors.border, colors.primary]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.set(withTiming(PRESS_SCALE, PRESS_IN));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, SPRING_PRESS));
      }}
      accessibilityRole='checkbox'
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.chip, { width }, style]}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[styles.native, { color: selected ? colors.primaryForeground : colors.foreground }]}
      >
        {native}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: selected ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
});

interface LanguageStepProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function LanguageStep({ selected, onChange }: LanguageStepProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const chipWidth = (width - H_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const count = selected.size;

  const toggle = (id: string) => {
    // At least one language must stay selected: Home has nothing to recommend without it.
    if (selected.has(id) && count === 1) {
      return;
    }

    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>What do you listen to?</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your picks shape Home from the first screen. You can change them any time in your profile.
      </Text>
      <Text accessibilityLiveRegion='polite' style={[styles.count, { color: colors.foreground }]}>
        {count} selected
      </Text>

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        style={styles.list}
      >
        {LANGUAGES.map((language) => (
          <LanguageChip
            key={language.id}
            label={language.label}
            native={language.native}
            selected={selected.has(language.id)}
            width={chipWidth}
            onPress={() => toggle(language.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: H_PADDING,
    paddingTop: 12,
  },
  title: {
    ...typography.displayLg,
  },
  subtitle: {
    ...typography.bodyMd,
    marginTop: 8,
  },
  count: {
    ...typography.labelMd,
    marginTop: 16,
    marginBottom: 10,
  },
  list: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingBottom: 12,
  },
  chip: {
    height: 66,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  native: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
