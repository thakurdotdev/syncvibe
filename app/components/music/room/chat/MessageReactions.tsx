import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ReactionChip } from './chatUtils';

/** Reaction chips under a bubble. Tapping a chip toggles your reaction with that emoji. */
export const MessageReactions = memo(function MessageReactions({
  chips,
  own,
  onToggle,
}: {
  chips: ReactionChip[];
  own: boolean;
  onToggle: (emoji: string) => void;
}) {
  const { colors } = useTheme();
  if (!chips.length) return null;

  return (
    <View style={[styles.row, own && styles.rowOwn]}>
      {chips.map((c) => (
        <PressableScale
          key={c.emoji}
          onPress={() => onToggle(c.emoji)}
          scaleTo={0.9}
          accessibilityRole='button'
          accessibilityLabel={`${c.emoji} by ${c.names.join(', ')}${c.mine ? '. Tap to remove yours' : ''}`}
          style={[
            styles.chip,
            {
              backgroundColor: c.mine ? `${colors.primary}22` : colors.raised,
              borderColor: c.mine ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={styles.emoji}>{c.emoji}</Text>
          {c.count > 1 && (
            <Text
              style={[styles.count, { color: c.mine ? colors.primary : colors.mutedForeground }]}
            >
              {c.count}
            </Text>
          )}
        </PressableScale>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, marginLeft: 8 },
  rowOwn: { justifyContent: 'flex-end', marginLeft: 0, marginRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  emoji: { fontSize: 13 },
  count: { fontSize: 11.5, fontWeight: '700' },
});
