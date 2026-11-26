import type { LyricLine, Lyrics } from '@/api/lyrics';
import PressableScale from '@/components/ui/PressableScale';
import { MicVocal } from '@/components/ui/icons';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { STATE } from '@/lib/motion';
import { prefetchLyrics, useLyrics, useReportLyrics } from '@/queries/useLyrics';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type ScrollView as RNScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

/** How often the position is read while the lyrics are on screen. */
const TICK_MS = 200;
/** A line lights up this much before its time: it reads as on the beat, not late. */
const LEAD_MS = 250;
/** After you scroll the lyrics yourself, they stay where you put them this long. */
const HOLD_AFTER_SCROLL_MS = 3500;
/** Where the current line sits, as a share of the view's height from the top. */
const FOCUS_AT = 0.32;
const FADE_IN = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

/** The last line whose time has come, by binary search; -1 before the first. */
export const lineAt = (lines: LyricLine[], ms: number): number => {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid]?.t ?? Infinity) <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

const SOURCE_NAME: Record<string, string> = { lrclib: 'LRCLIB', saavn: 'JioSaavn' };

interface LyricsViewProps {
  songId: string | undefined;
  /** The song after this one: its lyrics are loaded ahead. */
  nextSongId?: string;
  /** Seconds into the song, as you hear it. */
  getPosition: () => number;
  /** Shown and in front: only then is the position read and the view scrolled. */
  active: boolean;
  /** Tapping a line goes there; leave out where you can't move the song (a host-only room). */
  onSeek?: (seconds: number) => void;
  bottomInset?: number;
  /** Bigger type for the full player; the room's panel is smaller. */
  size?: 'large' | 'medium';
}

const Line = memo(function Line({
  line,
  index,
  state,
  size,
  onPress,
  onLayout,
}: {
  line: LyricLine;
  index: number;
  state: 'past' | 'current' | 'next';
  size: 'large' | 'medium';
  onPress?: (line: LyricLine) => void;
  onLayout: (index: number, y: number) => void;
}) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(state === 'current' ? 1 : state === 'past' ? 0.42 : 0.3, STATE),
  }));
  const text = line.text || '♪';
  const body = (
    <Animated.Text
      style={[
        size === 'large' ? styles.lineLarge : styles.lineMedium,
        { color: colors.foreground },
        style,
      ]}
    >
      {text}
    </Animated.Text>
  );
  return (
    <View onLayout={(e: LayoutChangeEvent) => onLayout(index, e.nativeEvent.layout.y)}>
      {onPress ? (
        <PressableScale
          scaleTo={0.985}
          onPress={() => onPress(line)}
          accessibilityRole='button'
          accessibilityLabel={`Play from ${text}`}
          style={styles.linePress}
        >
          {body}
        </PressableScale>
      ) : (
        <View style={styles.linePress}>{body}</View>
      )}
    </View>
  );
});

const Footer = ({ lyrics, songId }: { lyrics: Lyrics; songId: string }) => {
  const { colors } = useTheme();
  const { user } = useUser();
  const report = useReportLyrics(songId);
  if (lyrics.kind === 'none') return null;
  const source = SOURCE_NAME[lyrics.source] ?? lyrics.source;
  return (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
        {lyrics.kind === 'plain' ? 'Not timed · ' : ''}Lyrics from {source}
      </Text>
      {user?.userid ? (
        <PressableScale
          onPress={() => report.mutate()}
          disabled={report.isPending}
          hitSlop={8}
          accessibilityRole='button'
        >
          <Text style={[styles.footerText, styles.footerLink, { color: colors.mutedForeground }]}>
            {report.isPending ? 'Looking again…' : 'Wrong lyrics?'}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
};

const Placeholder = ({ size }: { size: 'large' | 'medium' }) => {
  const { colors } = useTheme();
  const widths = ['72%', '58%', '84%', '46%', '66%'] as const;
  const height = size === 'large' ? 22 : 16;
  return (
    <View style={styles.placeholder} accessibilityLabel='Loading lyrics'>
      {widths.map((width) => (
        <View
          key={width}
          style={[styles.bar, { width, height, backgroundColor: `${colors.foreground}12` }]}
        />
      ))}
    </View>
  );
};

const Empty = ({ failed, onRetry }: { failed: boolean; onRetry: () => void }) => {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FADE_IN} style={styles.empty}>
      <MicVocal size={26} color={colors.mutedForeground} strokeWidth={1.6} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {failed ? "Couldn't load lyrics" : 'No lyrics for this song yet'}
      </Text>
      {failed ? (
        <PressableScale onPress={onRetry} hitSlop={8} accessibilityRole='button'>
          <Text style={[styles.retry, { color: colors.primary }]}>Try again</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );
};

/**
 * A song's lyrics. Timed ones follow the song: the current line is lit and kept a third of the
 * way down, unless you've just scrolled; tapping a line plays from there. Untimed ones are
 * plain text. The position is read only while the view is `active`.
 */
export const LyricsView = memo(function LyricsView({
  songId,
  nextSongId,
  getPosition,
  active,
  onSeek,
  bottomInset = 0,
  size = 'large',
}: LyricsViewProps) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const { data, isPending, isError, refetch } = useLyrics(songId, active);
  const lines = data?.kind === 'synced' ? data.lines : null;
  const [current, setCurrent] = useState(-1);
  const scrollRef = useRef<RNScrollView>(null);
  const lineY = useRef<number[]>([]);
  const viewHeight = useRef(0);
  const holdUntil = useRef(0);

  useEffect(() => {
    if (active) prefetchLyrics(client, nextSongId);
  }, [active, client, nextSongId]);

  // A new song starts at the top, with no line lit.
  const [linesFor, setLinesFor] = useState(songId);
  if (linesFor !== songId) {
    setLinesFor(songId);
    setCurrent(-1);
  }
  useEffect(() => {
    lineY.current = [];
    holdUntil.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [songId]);

  useEffect(() => {
    if (!active || !lines) return;
    const read = () => setCurrent(lineAt(lines, getPosition() * 1000 + LEAD_MS));
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [active, getPosition, lines]);

  const follow = useCallback((index: number, animated: boolean) => {
    if (Date.now() < holdUntil.current) return;
    const y = lineY.current[Math.max(0, index)];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - viewHeight.current * FOCUS_AT), animated });
  }, []);

  useEffect(() => {
    if (active && lines) follow(current, true);
  }, [active, current, follow, lines]);

  const onLineLayout = useCallback(
    (index: number, y: number) => {
      lineY.current[index] = y;
      // Opened mid-song: go straight to where it is once that line has a place.
      if (index === current) follow(current, false);
    },
    [current, follow]
  );

  const seekTo = useMemo(
    () =>
      onSeek
        ? (line: LyricLine) => {
            holdUntil.current = 0;
            onSeek(line.t / 1000);
          }
        : undefined,
    [onSeek]
  );

  // As RNGH's own ScrollView sets it up: once the list scrolls, the player's swipes leave it be.
  const scrollGesture = useMemo(
    () => Gesture.Native().disallowInterruption(true).shouldCancelWhenOutside(false),
    []
  );

  if (!songId) return null;
  if (isPending) return <Placeholder size={size} />;
  if (isError || !data || data.kind === 'none') {
    return <Empty failed={isError} onRetry={() => void refetch()} />;
  }

  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.ScrollView
        ref={scrollRef}
        entering={FADE_IN}
        style={styles.fill}
        contentContainerStyle={[styles.content, { paddingBottom: 48 + bottomInset }]}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => (viewHeight.current = e.nativeEvent.layout.height)}
        onScrollBeginDrag={() => (holdUntil.current = Date.now() + HOLD_AFTER_SCROLL_MS)}
        onMomentumScrollEnd={() => (holdUntil.current = Date.now() + HOLD_AFTER_SCROLL_MS)}
      >
        {lines ? (
          lines.map((line, index) => (
            <Line
              key={`${line.t}-${index}`}
              line={line}
              index={index}
              state={index === current ? 'current' : index < current ? 'past' : 'next'}
              size={size}
              onPress={seekTo}
              onLayout={onLineLayout}
            />
          ))
        ) : data.kind === 'plain' ? (
          <Text
            style={[
              size === 'large' ? styles.plainLarge : styles.plainMedium,
              { color: colors.foreground },
            ]}
          >
            {data.text}
          </Text>
        ) : null}
        <Footer lyrics={data} songId={songId} />
      </Animated.ScrollView>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12 },
  linePress: { paddingVertical: 6 },
  // System font on purpose: it has every script lyrics come in (Devanagari, Gurmukhi, Tamil…).
  lineLarge: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  lineMedium: { fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  plainLarge: { fontSize: 18, lineHeight: 29, fontWeight: '600' },
  plainMedium: { fontSize: 15.5, lineHeight: 25, fontWeight: '500' },
  footer: { marginTop: 28, gap: 6 },
  footerText: { fontSize: 12, fontWeight: '500' },
  footerLink: { textDecorationLine: 'underline' },
  placeholder: { paddingHorizontal: 24, paddingTop: 18, gap: 14 },
  bar: { borderRadius: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '600' },
  retry: { fontSize: 14, fontWeight: '600' },
});
