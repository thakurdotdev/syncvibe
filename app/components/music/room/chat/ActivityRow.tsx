import { useTheme } from '@/context/ThemeContext';
import type { Message } from '@/stores/groupMusic/types';
import { Feather } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const iconFor = (text: string): keyof typeof Feather.glyphMap => {
  const t = text.toLowerCase();
  if (t.includes('joined')) return 'user-plus';
  if (t.includes('left')) return 'user-minus';
  if (t.includes('skip')) return 'skip-forward';
  if (t.includes('queue')) return 'list';
  if (t.includes('play')) return 'play';
  return 'info';
};

/** Room events (joins, skips, now playing) as quiet centred dividers between messages. */
export const ActivityRow = memo(function ActivityRow({ message }: { message: Message }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <View style={styles.label}>
        <Feather name={iconFor(message.message || '')} size={11} color={colors.mutedForeground} />
        <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={1}>
          {message.message}
        </Text>
      </View>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  label: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '75%' },
  text: { fontSize: 11.5, fontWeight: '500' },
});
