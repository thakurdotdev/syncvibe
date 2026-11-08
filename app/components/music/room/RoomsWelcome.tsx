import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

type Colors = ReturnType<typeof useTheme>['colors'];

const EASE = cubicBezier(0.23, 1, 0.32, 1);
/** Every line stops at the same point: that's the whole idea of a room. */
const PLAYHEAD = 0.58;
const LINES = [1, 0.82, 0.92];
const AVATAR = 40;

/** What a room actually has (see components/music/room and the server's queue rules). */
const FEATURES = [
  { icon: 'list', title: 'Shared queue', body: 'Everyone adds songs' },
  { icon: 'chatbubbles', title: 'Live chat', body: 'Talk while you listen' },
  { icon: 'sparkles', title: 'Reactions', body: 'Emoji and sound effects' },
] as const;

/** Plays once as the screen appears, then holds still: nothing loops while you read. */
const enter = (reduced: boolean, delayMs: number, from: Record<string, unknown>) =>
  reduced
    ? null
    : ({
        animationName: { from, to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] } },
        animationDuration: '420ms',
        animationDelay: `${delayMs}ms`,
        animationTimingFunction: EASE,
        animationFillMode: 'backwards',
      } as const);

/**
 * Three lines run in from the left and land on one shared playhead. Abstract on purpose:
 * no fake names or numbers. Transform/opacity CSS animations; static with Reduce Motion.
 */
const SyncLines = memo(function SyncLines({ colors }: { colors: Colors }) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.lines}>
      {LINES.map((length, i) => (
        <View
          key={i}
          style={[styles.track, { width: `${length * 100}%`, backgroundColor: colors.raised }]}
        >
          <Animated.View
            style={[
              styles.fill,
              { width: `${(PLAYHEAD / length) * 100}%`, backgroundColor: `${colors.foreground}40` },
              !reduced && {
                animationName: {
                  from: { transform: [{ scaleX: 0.05 }] },
                  to: { transform: [{ scaleX: 1 }] },
                },
                animationDuration: `${620 + i * 110}ms`,
                animationDelay: '160ms',
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
            animationDelay: '800ms',
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
 * The room before anyone joins: you, two open seats, and the lines meeting on one playhead.
 * Your own photo is the only person shown.
 */
const RoomPreview = memo(function RoomPreview({ colors }: { colors: Colors }) {
  const { user } = useUser();
  const reduced = useReducedMotion();
  const pic: string | undefined = user?.profilepic;
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <View style={styles.seats}>
        <Animated.View
          style={[
            styles.seat,
            { borderColor: colors.card, backgroundColor: colors.raised },
            enter(reduced, 0, { opacity: 0, transform: [{ translateY: 0 }, { scale: 0.8 }] }),
          ]}
        >
          {pic ? (
            <Image source={{ uri: pic }} style={styles.seatImage} />
          ) : (
            <Text style={[styles.seatInitial, { color: colors.foreground }]}>{initial}</Text>
          )}
        </Animated.View>
        {[1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.seat,
              { borderColor: colors.card, backgroundColor: colors.raised },
              enter(reduced, 90 * i, {
                opacity: 0,
                transform: [{ translateY: 0 }, { scale: 0.8 }],
              }),
            ]}
          >
            <View style={[styles.openSeatRing, { borderColor: `${colors.foreground}33` }]}>
              <Ionicons name='add' size={16} color={colors.mutedForeground} />
            </View>
          </Animated.View>
        ))}
        <Text style={[styles.seatsLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
          You + friends
        </Text>
      </View>
      <SyncLines colors={colors} />
    </View>
  );
});

/**
 * Rooms tab when you're not in a room: a preview of the room, what it has, and the ways in.
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
  const reduced = useReducedMotion();
  const rise = { opacity: 0, transform: [{ translateY: 10 }, { scale: 1 }] };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}
    >
      <View style={styles.hero}>
        <RoomPreview colors={colors} />

        <Animated.View style={enter(reduced, 120, rise)}>
          <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole='header'>
            Same song.{'\n'}Same second.
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Start a room and everyone hears the same moment, wherever they are.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.features, enter(reduced, 220, rise)]}>
          {FEATURES.map((f) => (
            <View key={f.title} style={[styles.feature, { backgroundColor: colors.raised }]}>
              <Ionicons name={f.icon} size={18} color={colors.primary} />
              <Text style={[styles.featureTitle, { color: colors.foreground }]} numberOfLines={1}>
                {f.title}
              </Text>
              <Text
                style={[styles.featureBody, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {f.body}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, enter(reduced, 300, rise)]}>
        <PressableScale
          onPress={onStart}
          accessibilityRole='button'
          accessibilityLabel='Start a room'
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Ionicons name='radio' size={19} color={colors.primaryForeground} />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Start a room</Text>
        </PressableScale>

        <View style={styles.joinRow}>
          <PressableScale
            onPress={onJoin}
            accessibilityRole='button'
            accessibilityLabel='Join with a code'
            style={[styles.join, { backgroundColor: colors.raised }]}
          >
            <Ionicons name='enter-outline' size={18} color={colors.foreground} />
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
      </Animated.View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  // The hero takes the free space and centres itself; actions stay at thumb height.
  content: { flexGrow: 1, paddingHorizontal: 20 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24, gap: 24 },

  preview: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 22,
  },
  seats: { flexDirection: 'row', alignItems: 'center' },
  seat: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: (AVATAR + 4) / 2,
    borderWidth: 2,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  seatImage: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  seatInitial: { fontSize: 16, fontWeight: '700' },
  openSeatRing: {
    width: AVATAR - 4,
    height: AVATAR - 4,
    borderRadius: (AVATAR - 4) / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatsLabel: { marginLeft: 22, fontSize: 13, fontWeight: '600', flexShrink: 1 },

  lines: { gap: 12 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, transformOrigin: 'left' },
  playhead: { position: 'absolute', top: -8, bottom: -8, width: 2, marginLeft: -1 },
  playheadLine: { flex: 1, borderRadius: 1 },

  title: { fontFamily: fonts.displayHeavy, fontSize: 38, lineHeight: 40, letterSpacing: -1.3 },
  body: { fontSize: 15, lineHeight: 21, marginTop: 10 },

  features: { flexDirection: 'row', gap: 8 },
  feature: { flex: 1, borderRadius: 16, padding: 12, gap: 4, minHeight: 92 },
  featureTitle: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  featureBody: { fontSize: 12, lineHeight: 16 },

  actions: { gap: 10, paddingTop: 8 },
  cta: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
  joinRow: { flexDirection: 'row', gap: 10 },
  join: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinText: { fontSize: 15, fontWeight: '600' },
  scan: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
