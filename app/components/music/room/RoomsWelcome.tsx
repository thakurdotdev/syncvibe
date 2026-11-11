import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { Bezel, Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import type { MyRoom } from '@/stores/groupMusic/roomProtocol';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { MyRooms } from './MyRooms';

type Colors = ReturnType<typeof useTheme>['colors'];

const EASE = cubicBezier(0.23, 1, 0.32, 1);
/** Every line stops at the same point: that's the whole idea of a room. */
const PLAYHEAD = 0.62;
const SEAT = 30;
const SEAT_GAP = 12;
/** You, then two open seats. */
const SEATS = [0, 1, 2];

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
 * The room before anyone joins: you and two open seats, each with a line of music, all meeting on
 * one playhead. Abstract on purpose: your own photo is the only person shown, with no made-up
 * names or numbers. Transform/opacity CSS animations; static with Reduce Motion.
 */
const RoomPreview = memo(function RoomPreview({ colors }: { colors: Colors }) {
  const { user } = useUser();
  const reduced = useReducedMotion();
  const pic: string | undefined = user?.profilepic;
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <Bezel contentStyle={styles.preview}>
      <View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
        <View style={styles.rows}>
          {SEATS.map((i) => (
            <View key={i} style={styles.row}>
              <Animated.View
                style={[
                  styles.seat,
                  i === 0
                    ? { backgroundColor: colors.raised }
                    : [styles.openSeat, { borderColor: `${colors.foreground}40` }],
                  enter(reduced, 80 * i, {
                    opacity: 0,
                    transform: [{ translateY: 0 }, { scale: 0.8 }],
                  }),
                ]}
              >
                {i > 0 ? (
                  <Ionicons name='add' size={14} color={colors.mutedForeground} />
                ) : pic ? (
                  <Image source={{ uri: pic }} style={styles.seatImage} />
                ) : (
                  <Text style={[styles.seatInitial, { color: colors.foreground }]}>{initial}</Text>
                )}
              </Animated.View>
              <View style={[styles.track, { backgroundColor: colors.raised }]}>
                <Animated.View
                  style={[
                    styles.fill,
                    { backgroundColor: i === 0 ? colors.foreground : `${colors.foreground}73` },
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
            </View>
          ))}

          {/* Spans the tracks only, so the playhead's position is a share of their width. */}
          <View style={styles.playheadLane} pointerEvents='none'>
            <Animated.View
              style={[
                styles.playhead,
                { backgroundColor: colors.foreground },
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
            />
          </View>
        </View>

        <View style={[styles.caption, { borderTopColor: colors.hairline }]}>
          <Text style={[styles.captionText, { color: colors.mutedForeground }]}>You + friends</Text>
          <View style={styles.inSync}>
            <View style={[styles.inSyncDot, { backgroundColor: colors.live }]} />
            <Text style={[styles.captionText, { color: colors.foreground }]}>In sync</Text>
          </View>
        </View>
      </View>
    </Bezel>
  );
});

/**
 * Rooms tab when you're not in a room: ways back into your rooms (playing on another device, or
 * left lately), a preview of the room, what it has, and the ways in.
 */
export const RoomsWelcome = memo(function RoomsWelcome({
  myRooms,
  onJoinRoom,
  onAskRoom,
  onDismissRoom,
  onStart,
  onJoin,
  onScan,
}: {
  myRooms: MyRoom[];
  onJoinRoom: (groupId: string) => void;
  onAskRoom: (groupId: string) => Promise<void>;
  onDismissRoom: (groupId: string) => void;
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
      <MyRooms rooms={myRooms} onJoin={onJoinRoom} onAsk={onAskRoom} onDismiss={onDismissRoom} />

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
      </View>

      <Animated.View style={[styles.actions, enter(reduced, 300, rise)]}>
        <PressableScale
          onPress={onStart}
          accessibilityRole='button'
          accessibilityLabel='Start a room'
          style={[styles.cta, { backgroundColor: colors.primary }]}
        >
          <Gloss />
          <Ionicons name='radio' size={19} color={colors.primaryForeground} />
          <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Start a room</Text>
        </PressableScale>

        <View style={styles.joinRow}>
          <PressableScale
            onPress={onJoin}
            accessibilityRole='button'
            accessibilityLabel='Join with a code'
            style={[styles.join, { borderColor: colors.hairline }]}
          >
            <Gloss tone='surface' />
            <Ionicons name='enter-outline' size={18} color={colors.foreground} />
            <Text style={[styles.joinText, { color: colors.foreground }]}>Join with code</Text>
          </PressableScale>
          <PressableScale
            onPress={onScan}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Scan a room QR code'
            style={[styles.join, styles.scan, { borderColor: colors.hairline }]}
          >
            <Gloss tone='surface' />
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
  hero: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20, gap: 22 },

  preview: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 },
  rows: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SEAT_GAP },
  seat: {
    width: SEAT,
    height: SEAT,
    borderRadius: SEAT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  openSeat: { borderWidth: 1.5, borderStyle: 'dashed' },
  seatImage: { width: SEAT, height: SEAT },
  seatInitial: { fontSize: 13, fontWeight: '700' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: {
    width: `${PLAYHEAD * 100}%`,
    height: '100%',
    borderRadius: 3,
    transformOrigin: 'left',
  },
  playheadLane: { position: 'absolute', left: SEAT + SEAT_GAP, right: 0, top: -6, bottom: -6 },
  playhead: {
    position: 'absolute',
    left: `${PLAYHEAD * 100}%`,
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captionText: { fontSize: 12.5, fontWeight: '600' },
  inSync: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inSyncDot: { width: 6, height: 6, borderRadius: 3 },

  title: { fontFamily: fonts.displayHeavy, fontSize: 38, lineHeight: 40, letterSpacing: -1.3 },
  body: { fontSize: 15, lineHeight: 21, marginTop: 10 },

  actions: { gap: 10, paddingTop: 8 },
  cta: {
    height: 54,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
  joinRow: { flexDirection: 'row', gap: 10 },
  join: {
    flex: 1,
    height: 50,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  joinText: { fontSize: 15, fontWeight: '600' },
  scan: { flex: 0, width: 50 },
});
