import { useTheme } from '@/context/ThemeContext';
import { steerQueue, useMoods } from '@/queries/usePersonal';
import { toast } from '@/context/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

type Chip = { steer: string; label: string; done: string; icon?: 'sparkles' | 'shuffle' };

/** "More like this", "Something different" and the moods, above the queue. */
export const SteerBar = memo(function SteerBar() {
  const { colors } = useTheme();
  const { data: moods = [] } = useMoods();
  const [busy, setBusy] = useState<string | null>(null);

  const chips: Chip[] = [
    { steer: 'more', label: 'More like this', done: 'more like this', icon: 'sparkles' },
    {
      steer: 'different',
      label: 'Something different',
      done: 'something different',
      icon: 'shuffle',
    },
    ...moods.map((mood) => ({ steer: `mood:${mood.key}`, label: mood.title, done: mood.title })),
  ];

  const run = async (chip: Chip) => {
    setBusy(chip.steer);
    try {
      await steerQueue(chip.steer, chip.done);
    } catch {
      toast("Couldn't change what's next. Try again.", { type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A ScrollView grows to fill its parent by default, which pushed the queue to the bottom.
      style={styles.bar}
      contentContainerStyle={styles.row}
      accessibilityLabel='Steer what plays next'
    >
      {chips.map((chip) => (
        <Pressable
          key={chip.steer}
          onPress={() => run(chip)}
          disabled={busy !== null}
          accessibilityRole='button'
          accessibilityLabel={`Play ${chip.done} next`}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {busy === chip.steer ? (
            <ActivityIndicator size={13} color={colors.mutedForeground} />
          ) : chip.icon ? (
            <Ionicons name={chip.icon} size={13} color={colors.mutedForeground} />
          ) : null}
          <Text style={[styles.label, { color: colors.foreground }]}>{chip.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  bar: { flexGrow: 0, flexShrink: 0 },
  row: { gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, fontWeight: '600' },
});
