import { useTheme } from '@/context/ThemeContext';
import { EASE_OUT } from '@/lib/motion';
import { usePlayerSessionStore, useRemoteDevice } from '@/stores/playerSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeInUp,
  FadeOutUp,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/*
 * A small pill at the top while the app catches up with your other devices: "Syncing your
 * music" until the shared player arrives, then where it's playing for a moment. Shown when the
 * app opens (and after a reconnect that takes a while), only if there's music to sync.
 */

/** Quick syncs on a reconnect aren't worth showing; the first one since the app opened is. */
const SHOW_AFTER_MS = 300;
const SYNCED_FOR_MS = 1600;

const system = ReduceMotion.System;
const ENTER = FadeInUp.duration(220).easing(EASE_OUT).reduceMotion(system);
const EXIT = FadeOutUp.duration(160).easing(EASE_OUT).reduceMotion(system);

let shownOnce = false;

const PulsingDot = ({ color }: { color: string }) => {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withRepeat(withTiming(0.3, { duration: 650, easing: EASE_OUT }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

export default function SyncPill() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sync = usePlayerSessionStore((s) => s.sync);
  const hasMusic = usePlayerSessionStore((s) => Boolean(s.playback?.song));
  const hasLocalSong = usePlayerStore((s) => Boolean(s.currentSong));
  const inRoom = usePlayerStore((s) => s.activePlayerMode === 'group');
  const remote = useRemoteDevice();
  // Which sync attempt (by start time) the pill came up for, and which one's "done" has gone.
  const [shownAt, setShownAt] = useState(-1);
  const [expiredAt, setExpiredAt] = useState(-1);

  useEffect(() => {
    if (sync.state === 'syncing') {
      const timer = setTimeout(
        () => {
          shownOnce = true;
          setShownAt(sync.at);
        },
        shownOnce ? SHOW_AFTER_MS : 0
      );
      return () => clearTimeout(timer);
    }
    if (sync.state === 'synced') {
      const timer = setTimeout(() => setExpiredAt(sync.at), SYNCED_FOR_MS);
      return () => clearTimeout(timer);
    }
  }, [sync.state, sync.at]);

  // A sync quick enough that the pill never came up says nothing when it's done either.
  const visible =
    shownAt !== sync.at
      ? null
      : sync.state === 'syncing'
        ? 'syncing'
        : sync.state === 'synced' && expiredAt !== sync.at
          ? 'synced'
          : null;

  if (!visible || inRoom || (!hasMusic && !hasLocalSong)) return null;

  const label =
    visible === 'syncing'
      ? 'Syncing your music'
      : remote
        ? `Playing on ${remote.name}`
        : 'In sync with your devices';

  return (
    <View pointerEvents='none' style={[styles.layer, { top: insets.top + 8 }]}>
      <Animated.View
        key={visible}
        entering={ENTER}
        exiting={EXIT}
        style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}
        accessibilityLiveRegion='polite'
        accessibilityLabel={label}
      >
        {visible === 'syncing' ? (
          <PulsingDot color={colors.primary} />
        ) : (
          <Feather
            name={remote ? (remote.mobile ? 'smartphone' : 'monitor') : 'check'}
            size={13}
            color={colors.foreground}
          />
        )}
        <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 9000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '86%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
});
