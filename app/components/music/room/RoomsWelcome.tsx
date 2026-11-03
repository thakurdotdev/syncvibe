import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

type IconName = keyof typeof Ionicons.glyphMap;

const BAR_HEIGHTS = [10, 18, 13, 20];

/**
 * Equalizer in the hero. Rare, first-time screen → the one place with ambient motion.
 * Reanimated CSS animation on scaleY (transform only, UI thread); static with Reduce Motion.
 */
const Equalizer = memo(function Equalizer({ color }: { color: string }) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.eq} accessibilityElementsHidden importantForAccessibility='no'>
      {BAR_HEIGHTS.map((h, i) => (
        <Animated.View
          key={i}
          style={[
            styles.eqBar,
            { height: h, backgroundColor: color },
            !reduced && {
              animationName: {
                from: { transform: [{ scaleY: 0.35 }] },
                to: { transform: [{ scaleY: 1 }] },
              },
              animationDuration: `${520 + i * 90}ms`,
              animationDirection: 'alternate',
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
              animationDelay: `${i * 110}ms`,
            },
          ]}
        />
      ))}
    </View>
  );
});

const ORBIT = 220;

/** Listeners placed around the song: angle in degrees on the outer ring. */
const LISTENERS: { icon: IconName; angle: number }[] = [
  { icon: 'person', angle: -140 },
  { icon: 'headset', angle: -35 },
  { icon: 'musical-notes', angle: 70 },
  { icon: 'heart', angle: 160 },
];

/** You and friends orbiting one song: the idea of a room at a glance. */
const Orbit = ({ primary }: { primary: string }) => {
  const r = ORBIT / 2;
  return (
    <View
      style={styles.orbit}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <View style={[styles.ring, { width: ORBIT, height: ORBIT, borderRadius: r }]} />
      <View
        style={[styles.ring, styles.ringInner, { width: ORBIT * 0.66, height: ORBIT * 0.66 }]}
      />

      <View style={styles.disc}>
        <Ionicons name='play' size={30} color={primary} style={{ marginLeft: 4 }} />
      </View>

      {LISTENERS.map(({ icon, angle }) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <View
            key={icon}
            style={[
              styles.listener,
              {
                left: r + r * Math.cos(rad) - LISTENER / 2,
                top: r + r * Math.sin(rad) - LISTENER / 2,
              },
            ]}
          >
            <Ionicons name={icon} size={18} color='#FFFFFF' />
          </View>
        );
      })}
    </View>
  );
};

const STEPS = ['Start a room', 'Invite friends', 'Play in sync'];

const Steps = () => (
  <View style={styles.steps}>
    {STEPS.map((label, i) => (
      <View key={label} style={styles.step}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumText}>{i + 1}</Text>
        </View>
        <Text style={styles.stepText} numberOfLines={1}>
          {label}
        </Text>
      </View>
    ))}
  </View>
);

const GhostButton = ({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) => (
  <PressableScale
    onPress={onPress}
    accessibilityRole='button'
    accessibilityLabel={label}
    style={styles.ghost}
  >
    <Ionicons name={icon} size={18} color='#FFFFFF' />
    <Text style={styles.ghostText}>{label}</Text>
  </PressableScale>
);

/**
 * Rooms tab when you're not in a room: a full-height landing page that explains the idea
 * and keeps every way in (start, join with a code, scan a QR) together at thumb height.
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
  const { colors, theme } = useTheme();
  const deep = theme === 'dark' ? '#2A0F23' : '#6A1239';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
    >
      <LinearGradient
        colors={[colors.primary, deep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.livePill, { backgroundColor: colors.live }]}>
          <Equalizer color={colors.liveForeground} />
          <Text style={[styles.liveText, { color: colors.liveForeground }]}>In sync</Text>
        </View>

        <View style={styles.visual}>
          <Orbit primary={colors.primary} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.heroTitle}>Listen together</Text>
          <Text style={styles.heroText}>
            The same song, at the same second, for everyone in the room. Chat and react while it
            plays.
          </Text>
          <Steps />
        </View>

        <View style={styles.actions}>
          <PressableScale
            onPress={onStart}
            accessibilityRole='button'
            accessibilityLabel='Start a room'
            style={styles.cta}
          >
            <Ionicons name='add' size={20} color={colors.primary} />
            <Text style={[styles.ctaText, { color: colors.primary }]}>Start a room</Text>
          </PressableScale>
          <View style={styles.ghostRow}>
            <GhostButton icon='keypad-outline' label='Enter code' onPress={onJoin} />
            <GhostButton icon='qr-code-outline' label='Scan QR' onPress={onScan} />
          </View>
        </View>
      </LinearGradient>
    </ScrollView>
  );
});

const LISTENER = 42;

const styles = StyleSheet.create({
  // flexGrow lets the hero fill the tab on tall phones and scroll on short ones.
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 4 },

  hero: { flex: 1, minHeight: 560, borderRadius: 28, padding: 20, overflow: 'hidden' },

  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  liveText: { fontSize: 12, fontWeight: '800' },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  eqBar: { width: 3, borderRadius: 2, maxHeight: 14, transformOrigin: 'bottom' },

  visual: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  orbit: { width: ORBIT, height: ORBIT, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  ringInner: { borderRadius: ORBIT, borderColor: 'rgba(255,255,255,0.14)' },
  disc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listener: {
    position: 'absolute',
    width: LISTENER,
    height: LISTENER,
    borderRadius: LISTENER / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  copy: { gap: 8 },
  heroTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 34,
    letterSpacing: -1,
    color: '#FFFFFF',
  },
  heroText: { fontSize: 14.5, lineHeight: 21, color: 'rgba(255,255,255,0.86)' },

  steps: { flexDirection: 'row', gap: 8, marginTop: 8 },
  step: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: '#2A0F23' },
  stepText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: '#FFFFFF' },

  actions: { gap: 10, marginTop: 22 },
  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: { fontSize: 16, fontWeight: '800' },
  ghostRow: { flexDirection: 'row', gap: 10 },
  ghost: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostText: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF' },
});
