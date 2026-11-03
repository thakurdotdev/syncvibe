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

/** Overlapping listeners: you and friends around one song. */
const Listeners = ({ tint }: { tint: string }) => (
  <View style={styles.listeners}>
    {(['headset', 'musical-notes', 'person'] as IconName[]).map((icon, i) => (
      <View
        key={icon}
        style={[
          styles.listener,
          { marginLeft: i ? -12 : 0, backgroundColor: 'rgba(255,255,255,0.18)' },
        ]}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
    ))}
  </View>
);

const Tile = ({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.tileLabel, { color: colors.foreground }]}>{label}</Text>
      <Text style={[styles.tileHint, { color: colors.mutedForeground }]}>{hint}</Text>
    </PressableScale>
  );
};

/** Rooms tab when you're not in a room: what it is, and the ways in. */
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
  const deep = theme === 'dark' ? '#3A1530' : '#7E1A47';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
    >
      <LinearGradient
        colors={[colors.primary, deep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <Listeners tint='#FFFFFF' />
          <View style={[styles.livePill, { backgroundColor: colors.live }]}>
            <Equalizer color={colors.liveForeground} />
            <Text style={[styles.liveText, { color: colors.liveForeground }]}>In sync</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Listen together</Text>
        <Text style={styles.heroText}>
          The same song, at the same second, for everyone in the room. Chat and react while it
          plays.
        </Text>

        <PressableScale onPress={onStart} accessibilityRole='button' style={styles.heroCta}>
          <Ionicons name='add' size={20} color={colors.primary} />
          <Text style={[styles.heroCtaText, { color: colors.primary }]}>Start a room</Text>
        </PressableScale>
      </LinearGradient>

      <View style={styles.tiles}>
        <Tile
          icon='keypad-outline'
          label='Join with a code'
          hint='From a friend'
          onPress={onJoin}
        />
        <Tile icon='qr-code-outline' label='Scan a QR' hint='On their screen' onPress={onScan} />
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },

  hero: { borderRadius: 28, padding: 20, gap: 10 },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  listeners: { flexDirection: 'row' },
  listener: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
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
  heroTitle: {
    fontFamily: fonts.displayHeavy,
    fontSize: 32,
    letterSpacing: -0.9,
    color: '#FFFFFF',
  },
  heroText: { fontSize: 14.5, lineHeight: 20, color: 'rgba(255,255,255,0.86)' },
  heroCta: {
    marginTop: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroCtaText: { fontSize: 16, fontWeight: '800' },

  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tileLabel: { fontSize: 15, fontWeight: '700' },
  tileHint: { fontSize: 12.5 },
});
