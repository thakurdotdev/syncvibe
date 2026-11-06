import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface DateBubbleProps {
  date: string;
}

const DateBubble: React.FC<DateBubbleProps> = ({ date }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>{date}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default React.memo(DateBubble);
