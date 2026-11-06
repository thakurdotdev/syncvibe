import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, PRESS_IN, SPRING_PRESS } from '@/lib/motion';
import {
  useIsPlaying,
  usePlayerControls,
  useRepeatMode,
  useShuffleMode,
} from '@/stores/playerStore';
import { Ionicons } from '@expo/vector-icons';
import TrackPlayer from '@rntp/player';
import { Repeat, Repeat1, Shuffle } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const TICK_MS = 250;
/** After a seek, ignore ticks this long: the old position must not make the bar jump back. */
const SEEK_HOLD_MS = 700;

const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * Song position. A plain bar with no knob that thickens under your finger and follows it
 * on the UI thread; the time labels follow your finger too. Only this component re-renders
 * while a song plays, and it stops polling while the player is closed (`active`).
 */
export const Scrubber = memo(function Scrubber({
  active,
  fallbackDuration,
}: {
  active: boolean;
  fallbackDuration: number;
}) {
  const { colors } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(fallbackDuration);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const holdUntil = useRef(0);

  const fraction = useSharedValue(0);
  const trackWidth = useSharedValue(1);
  const duration = useSharedValue(fallbackDuration);
  const scrubbing = useSharedValue(false);
  const thick = useSharedValue(0);
  const lastSecond = useSharedValue(-1);

  useEffect(() => {
    if (!active) return;
    const read = () => {
      if (Date.now() < holdUntil.current || scrubbing.get()) return;
      const { position, duration: native } = TrackPlayer.getProgress();
      const length = native > 0 ? native : fallbackDuration;
      setElapsed(Math.floor(position));
      setTotal(length);
      duration.set(length);
      const next = length > 0 ? Math.min(1, Math.max(0, position / length)) : 0;
      // A normal tick glides to the next spot; a new song or an outside seek jumps there.
      const glide = next >= fraction.get() && (next - fraction.get()) * length < 1.5;
      fraction.set(glide ? withTiming(next, { duration: TICK_MS, easing: Easing.linear }) : next);
    };
    read();
    const timer = setInterval(read, TICK_MS);
    return () => clearInterval(timer);
  }, [active, fallbackDuration, duration, fraction, scrubbing]);

  const commitSeek = useCallback((seconds: number) => {
    holdUntil.current = Date.now() + SEEK_HOLD_MS;
    setElapsed(Math.floor(seconds));
    setScrubTime(null);
    TrackPlayer.seekTo(seconds);
  }, []);

  const scrubTo = (x: number) => {
    'worklet';
    const next = clamp(x / trackWidth.get(), 0, 1);
    fraction.set(next);
    const second = Math.floor(next * duration.get());
    if (second !== lastSecond.get()) {
      lastSecond.set(second);
      scheduleOnRN(setScrubTime, second);
    }
  };

  const release = () => {
    'worklet';
    scrubbing.set(false);
    thick.set(withSpring(0, SPRING_PRESS));
    lastSecond.set(-1);
  };

  const drag = Gesture.Pan()
    .activeOffsetX([-3, 3])
    .onStart((e) => {
      scrubbing.set(true);
      thick.set(withTiming(1, PRESS_IN));
      scrubTo(e.x);
    })
    .onUpdate((e) => scrubTo(e.x))
    .onEnd(() => scheduleOnRN(commitSeek, fraction.get() * duration.get()))
    .onFinalize((_e, success) => {
      release();
      if (!success) scheduleOnRN(setScrubTime, null);
    });

  const tap = Gesture.Tap().onEnd((e) => {
    const next = clamp(e.x / trackWidth.get(), 0, 1);
    fraction.set(next);
    scheduleOnRN(commitSeek, next * duration.get());
  });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: 1 + thick.get() * 0.8 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fraction.get() }] }));

  const shown = scrubTime ?? elapsed;
  const timeColor = scrubTime !== null ? colors.foreground : secondary(colors.foreground);

  return (
    <View style={styles.scrubber}>
      <GestureDetector gesture={Gesture.Exclusive(drag, tap)}>
        <View
          style={styles.scrubHit}
          onLayout={(e) => trackWidth.set(e.nativeEvent.layout.width || 1)}
          accessible
          accessibilityRole='adjustable'
          accessibilityLabel='Song position'
          accessibilityValue={{ text: `${formatTime(shown)} of ${formatTime(total)}` }}
        >
          <Animated.View
            style={[styles.track, { backgroundColor: `${colors.foreground}26` }, trackStyle]}
          >
            <Animated.View
              style={[styles.trackFill, { backgroundColor: colors.foreground }, fillStyle]}
            />
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text style={[styles.time, { color: timeColor }]}>{formatTime(shown)}</Text>
        <Text style={[styles.time, { color: timeColor }]}>
          -{formatTime(Math.max(0, total - shown))}
        </Text>
      </View>
    </View>
  );
});

/** Foreground at ~70%: stays readable on the tinted backdrop, whatever the artwork's colour. */
export const secondary = (foreground: string) => `${foreground}B3`;

/** Shuffle/repeat: quiet until on, then the accent colour and a small dot under the icon. */
const ModeButton = memo(function ModeButton({
  on,
  onPress,
  label,
  children,
}: {
  on: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={6}
      accessibilityRole='togglebutton'
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      style={styles.mode}
    >
      {children}
      {/* Always rendered so the icon doesn't move when the mode turns on. */}
      <View style={[styles.modeDot, { backgroundColor: on ? colors.primary : 'transparent' }]} />
    </PressableScale>
  );
});

/**
 * Shuffle, previous, play, next, repeat. The play button is the inverse of the page rather
 * than an accent, so it sits comfortably on the backdrop whatever the artwork's colour.
 */
export const Transport = memo(function Transport() {
  const { colors } = useTheme();
  const isPlaying = useIsPlaying();
  const { handlePlayPause, handleNextSong, handlePrevSong } = usePlayerControls();
  const { shuffleMode, toggleShuffle } = useShuffleMode();
  const { repeatMode, toggleRepeat } = useRepeatMode();

  const quiet = secondary(colors.foreground);
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const repeatLabel =
    repeatMode === 'one' ? 'Repeat this song' : repeatMode === 'all' ? 'Repeat queue' : 'Repeat';

  return (
    <View style={styles.transport}>
      <ModeButton on={shuffleMode} onPress={toggleShuffle} label='Shuffle'>
        <Shuffle size={20} color={shuffleMode ? colors.primary : quiet} strokeWidth={2} />
      </ModeButton>

      <PressableScale
        onPress={() => handlePrevSong()}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={6}
        accessibilityRole='button'
        accessibilityLabel='Previous song'
        style={styles.skip}
      >
        <Ionicons name='play-skip-back' size={30} color={colors.foreground} />
      </PressableScale>

      <PressableScale
        onPress={handlePlayPause}
        scaleTo={BUTTON_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        style={[styles.play, { backgroundColor: colors.foreground }]}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={32}
          color={colors.background}
          style={isPlaying ? undefined : styles.playNudge}
        />
      </PressableScale>

      <PressableScale
        onPress={() => handleNextSong()}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={6}
        accessibilityRole='button'
        accessibilityLabel='Next song'
        style={styles.skip}
      >
        <Ionicons name='play-skip-forward' size={30} color={colors.foreground} />
      </PressableScale>

      <ModeButton on={repeatMode !== 'off'} onPress={toggleRepeat} label={repeatLabel}>
        <RepeatIcon
          size={20}
          color={repeatMode !== 'off' ? colors.primary : quiet}
          strokeWidth={2}
        />
      </ModeButton>
    </View>
  );
});

const styles = StyleSheet.create({
  scrubber: { width: '100%' },
  scrubHit: { height: 30, justifyContent: 'center' },
  track: { height: 5, borderRadius: 2.5, overflow: 'hidden' },
  trackFill: { width: '100%', height: '100%', transformOrigin: 'left' },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  time: { fontSize: 12.5, fontWeight: '500', fontVariant: ['tabular-nums'] },

  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  mode: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modeDot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2 },
  skip: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  play: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  playNudge: { marginLeft: 3 },
});
