import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';

export const ConnectionBadge: React.FC = () => {
  const { colors } = useTheme();
  const quality = useGroupPlaybackStore((s) => s.connectionQuality);

  const config = {
    good: { color: '#10b981', bars: 3, label: 'Connected' },
    fair: { color: '#f59e0b', bars: 2, label: 'Fair' },
    poor: { color: '#ef4444', bars: 1, label: 'Poor' },
  }[quality];

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: 6 + i * 3 },
              { backgroundColor: i < config.bars ? config.color : colors.mutedForeground + '20' },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
});
