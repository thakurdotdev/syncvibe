import type { LyricLine, Lyrics } from '@/api/lyrics';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { EASE_OUT } from '@/lib/motion';
import { memo, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { breakShare, INTRO_MIN_MS, lineAt, LEAD_MS, wordsLit, wordsOf } from './lyricsTiming';

/*
 * Two lines of a song's lyrics under its cover: the one being sung, its words lighting as
 * they're reached, and the next one waiting faintly underneath. When the singer moves on, the
 * sung line lifts away, the waiting one glides up into its place, and the one after arrives
 * word by word. Breaks are three dots that fill across the break and breathe.
 */

/** How often the position is read: fine enough for words, cheap enough to leave running. */
const TICK_MS = 100;
/** Space between the sung line and the next one. */
const GAP = 4;
/** A departing line is gone after this; then it's dropped. */
const LEAVE_MS = 600;

const system = ReduceMotion.System;
/** The waiting line rising into place: a soft spring that settles just past and back. */
const RISE = { duration: 650, dampingRatio: 0.72, reduceMotion: system } as const;
const LEAVE = { duration: 460, easing: EASE_OUT, reduceMotion: system } as const;
const FADE = { duration: 380, easing: EASE_OUT, reduceMotion: system } as const;
const SHIFT = { duration: 300, easing: EASE_OUT, reduceMotion: system } as const;
const WORD = { duration: 300, easing: EASE_OUT, reduceMotion: system } as const;
const ARRIVE = { duration: 320, easing: EASE_OUT, reduceMotion: system } as const;
/** The first word of an arriving line waits for the hand-over to start, the rest follow it. */
const ARRIVE_DELAY_MS = 160;
const ARRIVE_STAGGER_MS = 45;
/** How bright a word is before it's sung. */
const UNSUNG = 0.4;
/** The waiting line as a whole, over its unsung words: about a quarter in all. */
const WAITING = 0.6;

export type GlanceSize = 'player' | 'room';

const TYPE = {
  player: { fontSize: 17.5, lineHeight: 24 },
  room: { fontSize: 15.5, lineHeight: 21 },
} as const;

/**
 * Rows the glance shows. In the player the sung line may take two rows above the waiting one; a
 * room has less room, so a long sung line there covers the waiting one until it's sung.
 */
const ROWS = { player: 3, room: 2 } as const;

export const glanceHeight = (size: GlanceSize) => TYPE[size].lineHeight * ROWS[size] + GAP;

type Role = 'current' | 'waiting' | 'leaving';

interface Slot {
  key: string;
  /** Line index; -1 is the intro before the first line. */
  index: number;
  role: Role;
  /** Just added under the sung line: its words come in one by one. */
  arriving: boolean;
}

const Word = memo(function Word({
  text,
  lit,
  delay,
  size,
}: {
  text: string;
  /** Sung (or the line has been sung): full brightness. */
  lit: boolean;
  /** Arrival delay, or null when the word was already there. */
  delay: number | null;
  size: GlanceSize;
}) {
  const { colors } = useTheme();
  const arrived = useSharedValue(delay === null ? 1 : 0);
  const bright = useSharedValue(lit ? 1 : UNSUNG);
  useEffect(() => {
    if (delay !== null) arrived.set(withDelay(delay, withTiming(1, ARRIVE)));
  }, [arrived, delay]);
  useEffect(() => {
    bright.set(withTiming(lit ? 1 : UNSUNG, WORD));
  }, [bright, lit]);
  const style = useAnimatedStyle(() => {
    const b = bright.get();
    return {
      opacity: arrived.get() * b,
      // An unsung word sits a hair low and rises as it lights.
      transform: [{ translateY: (1 - arrived.get()) * 8 + ((1 - b) / (1 - UNSUNG)) * 1.5 }],
    };
  });
  return (
    <Animated.Text style={[styles.word, TYPE[size], { color: colors.foreground }, style]}>
      {text}
    </Animated.Text>
  );
});

/** A break: three dots that fill across it, breathing while it lasts. */
const Dots = memo(function Dots({
  lit,
  current,
  height,
}: {
  lit: number;
  current: boolean;
  /** A text row's height: the dots sit in one. */
  height: number;
}) {
  const { colors } = useTheme();
  const breath = useSharedValue(1);
  useEffect(() => {
    if (!current) return;
    breath.set(
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1300, reduceMotion: system }),
          withTiming(1, { duration: 1300, reduceMotion: system })
        ),
        -1
      )
    );
    return () => breath.set(1);
  }, [breath, current]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() }] }));
  return (
    <Animated.View style={[styles.dots, { height }, rowStyle]}>
      {[0, 1, 2].map((k) => (
        <Dot key={k} on={current && lit > k} color={colors.foreground} />
      ))}
    </Animated.View>
  );
});

const Dot = ({ on, color }: { on: boolean; color: string }) => {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(on ? 1 : 0.22, FADE),
    transform: [
      {
        scale: withSpring(on ? 1 : 0.8, { duration: 400, dampingRatio: 0.6, reduceMotion: system }),
      },
    ],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

const GlanceLine = memo(function GlanceLine({
  text,
  role,
  arriving,
  lit,
  waitingAt,
  size,
  onCurrentHeight,
}: {
  text: string;
  role: Role;
  arriving: boolean;
  /** Words sung so far (all of them once it's leaving), or dots filled for a break. */
  lit: number;
  /** Where the waiting line sits: under the sung one. */
  waitingAt: number;
  size: GlanceSize;
  onCurrentHeight: (height: number) => void;
}) {
  const height = useRef<number>(TYPE[size].lineHeight);
  const y = useSharedValue(role === 'waiting' ? waitingAt : role === 'current' ? 8 : 0);
  const opacity = useSharedValue(role === 'waiting' ? WAITING : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (role === 'current') {
      y.set(withSpring(0, RISE));
      opacity.set(withTiming(1, FADE));
    } else if (role === 'waiting') {
      y.set(withTiming(waitingAt, SHIFT));
      opacity.set(withTiming(WAITING, FADE));
    } else {
      y.set(withTiming(-height.current * 0.7, LEAVE));
      opacity.set(withTiming(0, LEAVE));
      scale.set(withTiming(0.97, LEAVE));
    }
  }, [opacity, role, scale, waitingAt, y]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }, { scale: scale.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    height.current = e.nativeEvent.layout.height;
    if (role === 'current') onCurrentHeight(height.current);
  };

  const words = wordsOf(text);
  const current = role === 'current';
  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.line,
        // The waiting line keeps to one row; the sung one may take two.
        role === 'waiting' ? [styles.oneRow, { maxHeight: TYPE[size].lineHeight }] : styles.wrap,
        style,
      ]}
    >
      {words.length === 0 ? (
        <Dots lit={lit} current={current} height={TYPE[size].lineHeight} />
      ) : (
        words.map((word, k) => (
          <Word
            key={k}
            text={word}
            lit={k < lit}
            delay={arriving ? ARRIVE_DELAY_MS + k * ARRIVE_STAGGER_MS : null}
            size={size}
          />
        ))
      )}
    </Animated.View>
  );
});

let serial = 0;
const slot = (index: number, role: Role, arriving: boolean): Slot => ({
  key: `${index}-${(serial += 1)}`,
  index,
  role,
  arriving,
});

/** Moves the slots on to line `index`: the sung one leaves, the waiting one (if right) rises. */
const handOver = (slots: Slot[], index: number, count: number): Slot[] => {
  const kept = slots
    .filter((s) => s.role !== 'leaving')
    .map((s) => (s.role === 'current' ? { ...s, role: 'leaving' as const } : s));
  const waiting = kept.find((s) => s.role === 'waiting');
  const rises = waiting !== undefined && waiting.index === index;
  // After a seek the waiting line is the wrong one: it leaves too.
  const next = kept
    .filter((s) => s.role === 'leaving' || (s.role === 'waiting' && !rises))
    .map((s) => (s.role === 'waiting' ? { ...s, role: 'leaving' as const } : s));
  next.push(
    rises ? { ...waiting, role: 'current', arriving: false } : slot(index, 'current', false)
  );
  if (index + 1 < count) next.push(slot(index + 1, 'waiting', true));
  return next;
};

/**
 * The glance. `lines` are a song's timed lyrics; the position is read only while `active`.
 * Tapping it opens the whole song (`onOpen`).
 */
export const LyricsGlance = memo(function LyricsGlance({
  lines,
  getPosition,
  active,
  size = 'player',
  onOpen,
}: {
  lines: LyricLine[];
  getPosition: () => number;
  active: boolean;
  size?: GlanceSize;
  onOpen: () => void;
}) {
  const hasIntro = (lines[0]?.t ?? 0) >= INTRO_MIN_MS;
  const first = hasIntro ? -1 : 0;
  const [at, setAt] = useState({ index: first, lit: 0 });
  const [slots, setSlots] = useState<Slot[]>(() => handOver([], first, lines.length));
  const [currentHeight, setCurrentHeight] = useState<number>(TYPE[size].lineHeight);

  // Another song: start again from its top.
  const [linesFor, setLinesFor] = useState(lines);
  if (linesFor !== lines) {
    setLinesFor(lines);
    setAt({ index: first, lit: 0 });
    setSlots(handOver([], first, lines.length));
  }

  useEffect(() => {
    if (!active) return;
    const read = () => {
      const ms = getPosition() * 1000;
      let index = lineAt(lines, ms + LEAD_MS);
      if (index < 0 && !hasIntro) index = 0;
      const text = index >= 0 ? (lines[index]?.text ?? '') : '';
      const lit =
        wordsOf(text).length > 0
          ? wordsLit(lines, index, ms, 0)
          : Math.floor(breakShare(lines, index, ms, 0) * 3.01);
      setAt((prev) => (prev.index === index && prev.lit === lit ? prev : { index, lit }));
    };
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [active, getPosition, hasIntro, lines]);

  // The line changed: hand over.
  const [shownIndex, setShownIndex] = useState(first);
  if (shownIndex !== at.index) {
    setShownIndex(at.index);
    setSlots((prev) => handOver(prev, at.index, lines.length));
  }

  // Lines that have left are dropped once their way out is over.
  const hasLeaving = slots.some((s) => s.role === 'leaving');
  useEffect(() => {
    if (!hasLeaving) return;
    const timer = setTimeout(
      () => setSlots((prev) => prev.filter((s) => s.role !== 'leaving')),
      LEAVE_MS
    );
    return () => clearTimeout(timer);
  }, [hasLeaving, slots]);

  const sung = at.index >= 0 ? lines[at.index]?.text?.trim() : '';
  return (
    <PressableScale
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityRole='button'
      accessibilityLabel={sung ? `Lyrics: ${sung}. Show all lyrics` : 'Show all lyrics'}
      style={[styles.root, { height: glanceHeight(size) }]}
    >
      {slots.map((s) => (
        <GlanceLine
          key={s.key}
          text={s.index >= 0 ? (lines[s.index]?.text ?? '') : ''}
          role={s.role}
          arriving={s.arriving}
          lit={s.role === 'current' ? at.lit : s.role === 'leaving' ? Infinity : 0}
          waitingAt={currentHeight + GAP}
          size={size}
          onCurrentHeight={setCurrentHeight}
        />
      ))}
    </PressableScale>
  );
});

/** For untimed lyrics: one quiet row that opens them. */
export const PlainLyricsLink = memo(function PlainLyricsLink({
  lyrics,
  onOpen,
}: {
  lyrics: Extract<Lyrics, { kind: 'plain' }>;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const first =
    lyrics.text
      .split('\n')
      .find((l) => l.trim())
      ?.trim() ?? '';
  return (
    <PressableScale
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityRole='button'
      style={styles.plain}
    >
      <Text style={[styles.plainLine, { color: colors.foreground }]} numberOfLines={1}>
        {first}
      </Text>
      <Text style={[styles.plainHint, { color: colors.mutedForeground }]}>Read the lyrics</Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  line: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
  oneRow: { overflow: 'hidden' },
  // System font on purpose: it has every script lyrics come in (Devanagari, Gurmukhi, Tamil…).
  word: { fontWeight: '700', letterSpacing: -0.25 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 7, transformOrigin: 'left' },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  plain: { gap: 4, paddingVertical: 4 },
  plainLine: { fontSize: 16, fontWeight: '600', opacity: 0.6 },
  plainHint: { fontSize: 13, fontWeight: '600' },
});
