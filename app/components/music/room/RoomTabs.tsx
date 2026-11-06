import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { INDICATOR } from '@/lib/motion';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export type RoomTab = 'chat' | 'queue' | 'people';

const TABS: { key: RoomTab; label: string }[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'queue', label: 'Queue' },
  { key: 'people', label: 'People' },
];

/** Segmented switch for the room's panels; the selection pill makes a short, quick move. */
export const RoomTabs = memo(function RoomTabs({
  active,
  onChange,
  badges,
}: {
  active: RoomTab;
  onChange: (tab: RoomTab) => void;
  /** Number shown next to a label: unread chat, queue length, member count. */
  badges: Partial<Record<RoomTab, number>>;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const segment = width / TABS.length;
  const index = TABS.findIndex((t) => t.key === active);
  const x = useSharedValue(0);

  useEffect(() => {
    // Switched tens of times a session: a near-imperceptible 140ms on-screen move.
    if (segment) x.set(withTiming(index * segment, INDICATOR));
  }, [index, segment, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.raised }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
      accessibilityRole='tablist'
    >
      {segment > 0 && (
        <Animated.View
          style={[styles.pill, { width: segment, backgroundColor: colors.background }, pill]}
        />
      )}
      {TABS.map((t) => {
        const selected = t.key === active;
        const badge = badges[t.key];
        const isUnread = t.key === 'chat' && !selected && !!badge;
        return (
          <PressableScale
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole='tab'
            accessibilityState={{ selected }}
            accessibilityLabel={badge ? `${t.label}, ${badge}` : t.label}
            style={styles.tab}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? colors.foreground : colors.mutedForeground },
                selected && styles.labelActive,
              ]}
            >
              {t.label}
            </Text>
            {badge ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isUnread ? colors.primary : 'transparent' },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isUnread ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
});

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
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 14, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
