import { useTheme } from '@/context/ThemeContext';
import type { ReplyRef } from '@/stores/groupMusic/types';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { previewText } from './chatUtils';

/** Quoted message inside a reply bubble. Tapping it jumps to the original. */
export const ReplyQuote = memo(function ReplyQuote({
  reply,
  own,
  onPress,
}: {
  reply: ReplyRef;
  own: boolean;
  onPress?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const tint = own ? colors.primaryForeground : colors.primary;

  return (
    <Pressable
      onPress={() => onPress?.(reply.id)}
      accessibilityRole='button'
      accessibilityLabel={`Reply to ${reply.userName ?? 'message'}. Jump to original`}
      style={[
        styles.quote,
        { backgroundColor: own ? 'rgba(255,255,255,0.16)' : `${colors.primary}14` },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: tint }]} />
      <View style={styles.body}>
        <Text style={[styles.name, { color: tint }]} numberOfLines={1}>
          {reply.userName || 'Someone'}
        </Text>
        <Text
          style={[styles.text, { color: own ? colors.primaryForeground : colors.mutedForeground }]}
          numberOfLines={2}
        >
          {previewText(reply) || 'Message'}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  quote: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  bar: { width: 3 },
  body: { paddingHorizontal: 8, paddingVertical: 5, flexShrink: 1 },
  name: { fontSize: 12, fontWeight: '700' },
  text: { fontSize: 12.5, lineHeight: 16, opacity: 0.9 },
});
