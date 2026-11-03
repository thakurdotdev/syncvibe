import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

type Colors = ReturnType<typeof useTheme>['colors'];

const EASE = cubicBezier(0.23, 1, 0.32, 1);
/** Every line stops at the same point: that's the whole idea of a room. */
const PLAYHEAD = 0.58;
const LINES = [1, 0.82, 0.92];

/**
 * Three lines run in from the left and land on one shared playhead. Abstract on purpose:
 * no fake names or numbers. Transform/opacity CSS animations; static with Reduce Motion.
 */
const SyncLines = memo(function SyncLines({ colors }: { colors: Colors }) {
  const reduced = useReducedMotion();
  return (
    <View
      style={styles.lines}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      {LINES.map((length, i) => (
        <View
          key={i}
          style={[styles.track, { width: `${length * 100}%`, backgroundColor: colors.raised }]}
        >
          <Animated.View
            style={[
              styles.fill,
              { width: `${(PLAYHEAD / length) * 100}%`, backgroundColor: colors.foreground },
              !reduced && {
                animationName: {
                  from: { transform: [{ scaleX: 0.05 }] },
                  to: { transform: [{ scaleX: 1 }] },
                },
                animationDuration: `${620 + i * 110}ms`,
                animationDelay: '60ms',
                animationTimingFunction: EASE,
                animationFillMode: 'backwards',
              },
            ]}
          />
        </View>
      ))}
      <Animated.View
        style={[
          styles.playhead,
          { left: `${PLAYHEAD * 100}%` },
          !reduced && {
            animationName: {
              from: { opacity: 0, transform: [{ scaleY: 0.6 }] },
              to: { opacity: 1, transform: [{ scaleY: 1 }] },
            },
            animationDuration: '240ms',
            animationDelay: '700ms',
            animationTimingFunction: EASE,
            animationFillMode: 'backwards',
          },
        ]}
      >
        <View style={[styles.playheadLine, { backgroundColor: colors.primary }]} />
      </Animated.View>
    </View>
  );
});

/**
 * Rooms tab when you're not in a room: one picture, one line, and the ways in.
 */
export const RoomsWelcome = memo(function RoomsWelcome({
  onStart,
  onJoin,
  onScan,
}: {
  onStart: () => void;
  onJoin: () => void;
  onScan: () => void;
}) {
  const { colors } = useTheme();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
    >
      <View style={styles.hero}>
        <SyncLines colors={colors} />
        <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
          Same song.{'\n'}Same second.
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Listen with friends, in sync.
        </Text>
      </View>

      <View style={styles.actions}>
        <PressableScale
          onPress={onStart}
          accessibilityRole='button'
          accessibilityLabel='Start a room'
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Start a room</Text>
        </PressableScale>

        <View style={styles.joinRow}>
          <PressableScale
            onPress={onJoin}
            accessibilityRole='button'
            accessibilityLabel='Join with a code'
            style={[styles.join, { backgroundColor: colors.raised }]}
          >
            <Text style={[styles.joinText, { color: colors.foreground }]}>Join with code</Text>
          </PressableScale>
          <PressableScale
            onPress={onScan}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Scan a room QR code'
            style={[styles.scan, { backgroundColor: colors.raised }]}
          >
            <Ionicons name='qr-code-outline' size={19} color={colors.foreground} />
          </PressableScale>
        </View>
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  // The hero takes the free space and centres itself; actions stay at thumb height.
  content: { flexGrow: 1, paddingHorizontal: 20 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },

  lines: { gap: 14, marginBottom: 36 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, transformOrigin: 'left' },
  playhead: { position: 'absolute', top: -10, bottom: -10, width: 2, marginLeft: -1 },
  playheadLine: { flex: 1, borderRadius: 1 },

  title: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
  body: { fontSize: 16, marginTop: 12 },

  actions: { gap: 10, paddingTop: 8 },
  cta: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700' },
  joinRow: { flexDirection: 'row', gap: 10 },
  join: { flex: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  joinText: { fontSize: 15, fontWeight: '600' },
  scan: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
