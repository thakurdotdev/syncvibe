import {
  HomeIcon,
  LibraryIcon,
  MessagesIcon,
  PlayIcon,
  RoomsIcon,
} from '@/components/icons/NavIcons';
import { CAPSULE_CLOSE } from '@/components/music/deck/constants';
import { GLASS_SUPPORTED } from '@/components/shell/GlassSurface';
import { useTheme } from '@/context/ThemeContext';
import { useAppActive } from '@/hooks/useAppActive';
import { EASE_OUT } from '@/lib/motion';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  type AnimatedStyle,
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Settings → Appearance: a small working model of the bottom bar that follows the toggles below
 * it. A list scrolls behind the bar (glass blurs it), the song changes every few seconds (the
 * pop-up opens from the orb) and the player card sits above the tabs. Drawn, not the real deck:
 * the real one is wired to the player, and the real blur only reads the screen behind it.
 */

// Album art stand-ins. Artwork brings the colour in every theme, so these aren't theme tokens.
const ART: [string, string][] = [
  ['#F97316', '#7C2D12'],
  ['#EC4899', '#581C87'],
  ['#22D3EE', '#1E3A8A'],
  ['#A3E635', '#14532D'],
  ['#FACC15', '#9A3412'],
];

const STAGE_H = 220;
const PAD = 10;
const ORB = 42;
const GAP = 6;
const NAV_H = 42;
const CARD_H = 46;
const NAV_TOP = STAGE_H - PAD - NAV_H;
const CARD_TOP = NAV_TOP - GAP - CARD_H;
const PILL_LEFT = PAD + ORB + GAP;

const ROW_H = 46;
const TILE_H = 64;
/** One pass of the list behind the bar; drawn twice so the scroll loops without a seam. */
const LIST_H = 5 * ROW_H + TILE_H + 12;
const SCROLL_MS = 9000;

const SONG_EVERY_MS = 3800;
const POPUP_HOLD_MS = 1700;
const CAPSULE_OPEN = { duration: 320, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
const TOGGLE = { duration: 260, easing: EASE_OUT, reduceMotion: ReduceMotion.System };

function Art({ i, size, radius }: { i: number; size: number; radius: number }) {
  const [a, b] = ART[((i % ART.length) + ART.length) % ART.length];
  return (
    <LinearGradient
      colors={[a, b]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}

/** The page behind the bar: a row of covers and a few list rows. */
const ListPass = memo(function ListPass({ line, raised }: { line: string; raised: string }) {
  return (
    <View style={styles.pass}>
      <View style={styles.tiles}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.tile}>
            <Art i={i + 2} size={TILE_H} radius={12} />
          </View>
        ))}
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.listRow}>
          <Art i={i} size={34} radius={9} />
          <View style={styles.listText}>
            <View style={[styles.bar, { backgroundColor: line, width: `${62 - i * 7}%` }]} />
            <View style={[styles.barThin, { backgroundColor: raised, width: `${40 + i * 5}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
});

function ScrollingList({
  scroll,
  line,
  raised,
}: {
  scroll: SharedValue<number>;
  line: string;
  raised: string;
}) {
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -scroll.get() * LIST_H }] }));
  return (
    <Animated.View style={style}>
      <ListPass line={line} raised={raised} />
      <ListPass line={line} raised={raised} />
    </Animated.View>
  );
}

/**
 * A piece of the bar. With glass, the list behind it shows through, blurred: a blurred copy of
 * the same list, moved so it lines up with the one on the stage.
 */
function MiniSurface({
  x,
  y,
  radius,
  glass,
  stageW,
  scroll,
  style,
  children,
}: {
  x: number;
  y: number;
  radius: number;
  glass: SharedValue<number>;
  stageW: number;
  scroll: SharedValue<number>;
  style: StyleProp<AnimatedStyle<ViewStyle>>;
  children?: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const dark = theme === 'dark';
  const solid = useAnimatedStyle(() => ({ opacity: 1 - glass.get() }));
  return (
    <Animated.View
      style={[
        styles.surface,
        { borderRadius: radius, borderColor: colors.hairline, top: y, left: x },
        style,
      ]}
    >
      {GLASS_SUPPORTED && (
        <View style={[styles.behind, { left: -x, top: -y, width: stageW }]}>
          <View style={styles.blur}>
            <ScrollingList scroll={scroll} line={colors.mutedForeground} raised={colors.raised} />
          </View>
        </View>
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.card, opacity: dark ? 0.55 : 0.6 },
        ]}
      />
      <LinearGradient
        colors={[colors.sheen, 'transparent']}
        locations={[0, 0.55]}
        style={[StyleSheet.absoluteFill, { opacity: dark ? 0.5 : 0.35 }]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }, solid]} />
      {children}
    </Animated.View>
  );
}

function SongLines({ wide }: { wide?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.songLines}>
      <View
        style={[styles.bar, { backgroundColor: colors.foreground, width: wide ? '70%' : '60%' }]}
      />
      <View style={[styles.barThin, { backgroundColor: colors.mutedForeground, width: '42%' }]} />
    </View>
  );
}

function DeckPreview({
  glass,
  songPopup,
  showCard,
}: {
  glass: boolean;
  songPopup: boolean;
  showCard: boolean;
}) {
  const { colors } = useTheme();
  const active = useAppActive();
  const reduced = useReducedMotion();
  const [stageW, setStageW] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setStageW(Math.round(e.nativeEvent.layout.width));
  }, []);
  const navW = Math.max(0, stageW - 2 * PAD);
  const pillW = Math.max(0, stageW - PILL_LEFT - PAD);
  const glassOn = GLASS_SUPPORTED && glass;

  // The list behind the bar keeps scrolling, so there's always something for the glass to blur.
  const scroll = useSharedValue(0);
  const running = active && !reduced;
  useEffect(() => {
    if (!running) return;
    scroll.set(0);
    scroll.set(withRepeat(withTiming(1, { duration: SCROLL_MS, easing: Easing.linear }), -1));
    return () => cancelAnimation(scroll);
  }, [running, scroll]);

  const glassV = useSharedValue(glassOn ? 1 : 0);
  const cardV = useSharedValue(showCard ? 1 : 0);
  const capsule = useSharedValue(0);
  useEffect(() => {
    glassV.set(withTiming(glassOn ? 1 : 0, TOGGLE));
  }, [glassOn, glassV]);
  useEffect(() => {
    cardV.set(withTiming(showCard ? 1 : 0, TOGGLE));
  }, [showCard, cardV]);

  // A new song every few seconds. Like the real deck, it pops up only when there's no card,
  // and turning either setting on shows the result straight away.
  const [song, setSong] = useState(0);
  const popsUp = songPopup && !showCard;
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!active) return;
    const next = () => {
      setSong((s) => s + 1);
      if (!popsUp) return;
      capsule.set(withTiming(1, CAPSULE_OPEN));
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(
        () => capsule.set(withTiming(0, CAPSULE_CLOSE)),
        POPUP_HOLD_MS
      );
    };
    const first = setTimeout(next, 500);
    const every = setInterval(next, SONG_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      clearTimeout(closeTimer.current);
      capsule.set(withTiming(0, CAPSULE_CLOSE));
    };
  }, [active, popsUp, capsule]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardV.get(),
    transform: [{ translateY: (1 - cardV.get()) * 14 }, { scale: 0.96 + 0.04 * cardV.get() }],
  }));
  const tabsStyle = useAnimatedStyle(() => ({ opacity: 1 - capsule.get() }));
  const capsuleStyle = useAnimatedStyle(() => ({
    width: ORB + (navW - ORB) * capsule.get(),
    opacity: capsule.get() > 0.01 ? 1 : 0,
  }));
  const capsuleTextStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, capsule.get() * 1.6 - 0.6),
  }));

  // The card's progress line runs through each song.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(0);
    if (active) progress.set(withTiming(1, { duration: SONG_EVERY_MS, easing: Easing.linear }));
  }, [song, active, progress]);
  const progressStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  const Tabs = [HomeIcon, RoomsIcon, LibraryIcon, MessagesIcon];

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityLabel='Preview of the bottom bar with these settings'
      style={[styles.stage, { backgroundColor: colors.background, borderColor: colors.hairline }]}
    >
      <View style={styles.list}>
        <ScrollingList scroll={scroll} line={colors.mutedForeground} raised={colors.raised} />
      </View>

      {stageW > 0 && (
        <>
          <Animated.View style={[styles.layer, cardStyle]} pointerEvents='none'>
            <MiniSurface
              x={PAD}
              y={CARD_TOP}
              radius={16}
              glass={glassV}
              stageW={stageW}
              scroll={scroll}
              style={{ width: navW, height: CARD_H }}
            >
              <View style={styles.cardRow}>
                <Animated.View
                  key={song}
                  entering={FadeIn.duration(220)}
                  exiting={FadeOut.duration(140)}
                >
                  <Art i={song} size={32} radius={9} />
                </Animated.View>
                <SongLines />
                <PlayIcon size={18} color={colors.foreground} />
              </View>
              <View style={[styles.track, { backgroundColor: colors.hairline }]}>
                <Animated.View
                  style={[styles.trackFill, { backgroundColor: colors.primary }, progressStyle]}
                />
              </View>
            </MiniSurface>
          </Animated.View>

          <Animated.View style={[styles.layer, tabsStyle]} pointerEvents='none'>
            <MiniSurface
              x={PILL_LEFT}
              y={NAV_TOP}
              radius={NAV_H / 2}
              glass={glassV}
              stageW={stageW}
              scroll={scroll}
              style={{ width: pillW, height: NAV_H }}
            >
              <View style={styles.tabs}>
                {Tabs.map((Icon, i) => (
                  <View key={i} style={[styles.tab, i === 2 && { backgroundColor: colors.raised }]}>
                    <Icon
                      size={17}
                      color={i === 2 ? colors.foreground : colors.mutedForeground}
                      filled={i === 2}
                      knock={colors.raised}
                    />
                  </View>
                ))}
              </View>
            </MiniSurface>
          </Animated.View>

          <MiniSurface
            x={PAD}
            y={NAV_TOP}
            radius={NAV_H / 2}
            glass={glassV}
            stageW={stageW}
            scroll={scroll}
            style={[{ height: NAV_H }, capsuleStyle]}
          >
            <Animated.View style={[styles.capsuleRow, { width: navW }, capsuleTextStyle]}>
              <SongLines wide />
              <PlayIcon size={18} color={colors.foreground} />
            </Animated.View>
          </MiniSurface>

          <View style={[styles.orb, { borderColor: colors.border }]} pointerEvents='none'>
            <Animated.View
              key={song}
              entering={FadeIn.duration(260)}
              exiting={FadeOut.duration(160)}
            >
              <Art i={song} size={ORB - 6} radius={(ORB - 6) / 2} />
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}

export default memo(DeckPreview);

const styles = StyleSheet.create({
  stage: {
    height: STAGE_H,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  list: StyleSheet.absoluteFill,
  pass: { height: LIST_H, paddingHorizontal: 14, paddingTop: 12 },
  tiles: { flexDirection: 'row', gap: 8, height: TILE_H, marginBottom: 4 },
  tile: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  listRow: { height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 10 },
  listText: { flex: 1, gap: 6 },
  bar: { height: 6, borderRadius: 3 },
  barThin: { height: 5, borderRadius: 2.5 },

  layer: StyleSheet.absoluteFill,
  surface: { position: 'absolute', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  behind: { position: 'absolute', height: STAGE_H, overflow: 'hidden' },
  blur: { flex: 1, filter: [{ blur: 8 }] },

  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 7,
    paddingRight: 14,
  },
  songLines: { flex: 1, gap: 6 },
  track: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  trackFill: { width: '100%', height: '100%', transformOrigin: 'left' },

  tabs: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 4, gap: 2 },
  tab: {
    flex: 1,
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  capsuleRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: ORB + 8,
    paddingRight: 14,
  },

  orb: {
    position: 'absolute',
    left: PAD,
    top: NAV_TOP,
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
