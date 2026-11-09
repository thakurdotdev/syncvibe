import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';

export const ConnectionBadge: React.FC = () => {
  const { colors } = useTheme();
  const quality = useGroupPlaybackStore((s) => s.connectionQuality);
  const reconnecting = useGroupSessionStore((s) => s.isRejoining);
  // Small corrections can't be heard, so only a real gap is worth showing.
  const catchingUp = useGroupPlaybackStore((s) => s.isPlaying && s.syncStatus === 'catching-up');

  if (reconnecting || catchingUp) {
    return (
      <Text style={[styles.reconnecting, { color: colors.mutedForeground }]}>
        {reconnecting ? 'Reconnecting…' : 'Catching up…'}
      </Text>
    );
  }

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
  reconnecting: { fontSize: 11, fontWeight: '600' },
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
