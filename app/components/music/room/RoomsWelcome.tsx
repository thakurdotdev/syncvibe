import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

type IconName = keyof typeof Ionicons.glyphMap;
type Colors = ReturnType<typeof useTheme>['colors'];

/** Where every listener's playhead sits in the illustration: the same spot, by design. */
const PLAYHEAD = 0.42;
const EASE = cubicBezier(0.23, 1, 0.32, 1);

/**
 * Three listeners, three progress lines, one playhead. On first paint the lines run in
 * from the left and land on the same second: the whole idea of a room in one picture.
 * Transform/opacity-only CSS animations (UI thread), static with Reduce Motion.
 */
const SyncPreview = memo(function SyncPreview({ colors }: { colors: Colors }) {
  const reduced = useReducedMotion();
  const listeners = [
    { initial: 'Y', bg: colors.primary, fg: colors.primaryForeground },
    { initial: 'A', bg: colors.live, fg: colors.liveForeground },
    { initial: 'K', bg: colors.raised, fg: colors.foreground },
  ];

  return (
    <View
      style={[styles.preview, { backgroundColor: colors.card }]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <View style={styles.previewTop}>
        <View style={styles.previewLive}>
          <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
          <Text style={[styles.previewMeta, { color: colors.foreground }]}>3 listening</Text>
        </View>
        <Text style={[styles.previewMeta, styles.tabular, { color: colors.mutedForeground }]}>
          1:24 / 3:18
        </Text>
      </View>

      <View style={styles.lanes}>
        <View style={styles.avatars}>
          {listeners.map((l) => (
            <View key={l.initial} style={[styles.avatar, { backgroundColor: l.bg }]}>
              <Text style={[styles.avatarText, { color: l.fg }]}>{l.initial}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tracks}>
          {listeners.map((l, i) => (
            <View key={l.initial} style={styles.lane}>
              <View style={[styles.track, { backgroundColor: colors.raised }]}>
                <Animated.View
                  style={[
                    styles.fill,
                    { width: `${PLAYHEAD * 100}%`, backgroundColor: colors.foreground },
                    !reduced && {
                      animationName: {
                        from: { transform: [{ scaleX: 0.08 }] },
                        to: { transform: [{ scaleX: 1 }] },
                      },
                      animationDuration: `${640 + i * 120}ms`,
                      animationDelay: '80ms',
                      animationTimingFunction: EASE,
                      animationFillMode: 'backwards',
                    },
                  ]}
                />
              </View>
            </View>
          ))}

          {/* The shared playhead. */}
          <Animated.View
            style={[
              styles.playhead,
              { left: `${PLAYHEAD * 100}%` },
              !reduced && {
                animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
                animationDuration: '220ms',
                animationDelay: '760ms',
                animationTimingFunction: EASE,
                animationFillMode: 'backwards',
              },
            ]}
          >
            <View style={[styles.playheadLine, { backgroundColor: colors.primary }]} />
            <View
              style={[
                styles.playheadKnob,
                { backgroundColor: colors.primary, borderColor: colors.card },
              ]}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'pulse', title: 'Perfectly in sync', body: 'Play, pause and skip land for everyone.' },
  { icon: 'list', title: 'One shared queue', body: 'Anyone can add the next song.' },
  { icon: 'chatbubble-ellipses', title: 'Chat and react', body: 'Talk about it while it plays.' },
];

const Feature = ({ icon, title, body, colors }: (typeof FEATURES)[number] & { colors: Colors }) => (
  <View style={styles.feature}>
    <View style={[styles.featureIcon, { backgroundColor: colors.raised }]}>
      <Ionicons name={icon} size={16} color={colors.foreground} />
    </View>
    <View style={styles.featureText}>
      <Text style={[styles.featureTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.featureBody, { color: colors.mutedForeground }]} numberOfLines={1}>
        {body}
      </Text>
    </View>
  </View>
);

const SecondaryButton = ({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: Colors;
}) => (
  <PressableScale
    onPress={onPress}
    accessibilityRole='button'
    accessibilityLabel={label}
    style={[styles.secondary, { backgroundColor: colors.raised }]}
  >
    <Ionicons name={icon} size={17} color={colors.foreground} />
    <Text style={[styles.secondaryText, { color: colors.foreground }]}>{label}</Text>
  </PressableScale>
);

/**
 * Rooms tab when you're not in a room. Quiet surfaces, one accent: the illustration
 * explains the idea, the copy stays short, and every way in sits together at thumb height.
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
      <SyncPreview colors={colors} />

      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
          Listen together
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Start a room and everyone hears the same song at the same second, wherever they are.
        </Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <Feature key={f.title} {...f} colors={colors} />
        ))}
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <PressableScale
          onPress={onStart}
          accessibilityRole='button'
          accessibilityLabel='Start a room'
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Ionicons name='add' size={20} color={colors.primaryForeground} />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Start a room</Text>
        </PressableScale>
        <View style={styles.secondaryRow}>
          <SecondaryButton
            icon='keypad-outline'
            label='Enter code'
            onPress={onJoin}
            colors={colors}
          />
          <SecondaryButton
            icon='qr-code-outline'
            label='Scan QR'
            onPress={onScan}
            colors={colors}
          />
        </View>
      </View>
    </ScrollView>
  );
});

const LANE = 26;
const LANE_GAP = 12;

const styles = StyleSheet.create({
  // flexGrow + spacer keep the actions at the bottom on tall phones; short ones scroll.
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 8 },

  preview: { borderRadius: 24, padding: 18, gap: 18 },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLive: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  previewMeta: { fontSize: 12.5, fontWeight: '600' },
  tabular: { fontVariant: ['tabular-nums'] },

  lanes: { flexDirection: 'row', gap: 14 },
  avatars: { gap: LANE_GAP },
  avatar: {
    width: LANE,
    height: LANE,
    borderRadius: LANE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '800' },
  tracks: { flex: 1, gap: LANE_GAP },
  lane: { height: LANE, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, transformOrigin: 'left' },
  playhead: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 12,
    marginLeft: -6,
    alignItems: 'center',
  },
  playheadLine: { flex: 1, width: 2, borderRadius: 1 },
  playheadKnob: {
    position: 'absolute',
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },

  copy: { marginTop: 28, gap: 8, paddingHorizontal: 4 },
  title: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.8, lineHeight: 34 },
  body: { fontSize: 15, lineHeight: 22 },

  features: { marginTop: 22, gap: 14, paddingHorizontal: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, minWidth: 0 },
  featureTitle: { fontSize: 14.5, fontWeight: '700' },
  featureBody: { fontSize: 13, marginTop: 1 },

  spacer: { flexGrow: 1, minHeight: 28 },

  actions: { gap: 10 },
  cta: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryText: { fontSize: 14.5, fontWeight: '600' },
});
