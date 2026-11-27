import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import GlowSweep from '@/components/shell/GlowSweep';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, SPRING_PRESS } from '@/lib/motion';
import { typography } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useOptionalDetail } from './context';
import { ICON_IN, ICON_OUT } from './motion';
import type { Collection } from './useCollection';

const HEIGHT = 52;
const LABEL_IN = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

/** The big button. Its icon turns over between play and pause; a tap sends light around it. */
const PlayPill = memo(function PlayPill({
  collection,
  disabled,
}: {
  collection: Collection;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const { active, playing, toggle } = collection;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [sweep, setSweep] = useState(0);

  const icon = playing ? 'pause' : 'play';
  const label = playing ? 'Pause' : active ? 'Resume' : 'Play';
  const fg = colors.primaryForeground;

  const onPress = useCallback(() => {
    if (!playing) setSweep((n) => n + 1);
    toggle();
  }, [playing, toggle]);

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityLabel={label}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      style={[styles.play, { backgroundColor: colors.primary }, disabled && styles.disabled]}
    >
      <View style={styles.playClip}>
        <Gloss />
      </View>
      <View style={styles.iconBox}>
        <Animated.View key={icon} entering={ICON_IN} exiting={ICON_OUT} style={styles.iconLayer}>
          <Ionicons name={icon} size={20} color={fg} />
        </Animated.View>
      </View>
      <Animated.Text key={label} entering={LABEL_IN} style={[styles.playText, { color: fg }]}>
        {label}
      </Animated.Text>
      <GlowSweep
        width={size.width}
        height={size.height}
        radius={HEIGHT / 2}
        colors={[`${fg}00`, fg, `${fg}00`]}
        play={sweep}
      />
    </PressableScale>
  );
});

/** Shuffle: the arrows give a little jolt, like the songs being thrown in the air. */
const ShuffleButton = memo(function ShuffleButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const jolt = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: jolt.get() * 3 },
      { rotate: `${jolt.get() * -20}deg` },
      { scale: 1 + jolt.get() * 0.14 },
    ],
  }));
  const press = useCallback(() => {
    jolt.set(
      withSequence(
        withTiming(1, { duration: 110, easing: EASE_OUT, reduceMotion: ReduceMotion.System }),
        withSpring(0, SPRING_PRESS)
      )
    );
    onPress();
  }, [jolt, onPress]);

  return (
    <PressableScale
      onPress={press}
      disabled={disabled}
      scaleTo={BUTTON_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel='Shuffle'
      style={[styles.round, { borderColor: colors.hairline }, disabled && styles.disabled]}
    >
      <Gloss tone='surface' />
      <Animated.View style={style}>
        <Ionicons name='shuffle' size={21} color={colors.foreground} />
      </Animated.View>
    </PressableScale>
  );
});

/** Into the room you're in, or a new room with these songs. A tick confirms an add. */
const RoomButton = memo(function RoomButton({
  inRoom,
  onPress,
}: {
  inRoom: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const press = useCallback(() => {
    onPress();
    if (!inRoom) return;
    setDone(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setDone(false), 1400);
  }, [inRoom, onPress]);

  const icon = done ? 'checkmark' : inRoom ? 'add' : 'radio-outline';
  return (
    <PressableScale
      onPress={press}
      scaleTo={BUTTON_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={inRoom ? 'Add these songs to the room' : 'Start a room with these songs'}
      style={[styles.room, { borderColor: colors.hairline }]}
    >
      <Gloss tone='surface' />
      <View style={styles.iconBox}>
        <Animated.View key={icon} entering={ICON_IN} exiting={ICON_OUT} style={styles.iconLayer}>
          <Ionicons name={icon} size={19} color={colors.foreground} />
        </Animated.View>
      </View>
      <Text style={[styles.roomText, { color: colors.foreground }]}>Room</Text>
    </PressableScale>
  );
});

/**
 * Play, shuffle and the room button, on one line at every width. Tells the page where it ends,
 * so the header can take over the play button once it scrolls away.
 */
export const ActionBar = memo(function ActionBar({
  collection,
  count,
  room,
}: {
  collection: Collection;
  count: number;
  room: { inRoom: boolean; run: () => void } | null;
}) {
  const detail = useOptionalDetail();
  const bar = useRef<View>(null);

  const measure = useCallback(() => {
    const content = detail?.contentRef.current;
    if (!content || !bar.current) return;
    bar.current.measureLayout(content, (_x, y, _w, h) => detail.actionsBottom.set(y + h));
  }, [detail]);

  return (
    <View ref={bar} onLayout={measure} style={styles.bar}>
      <PlayPill collection={collection} disabled={!count} />
      <ShuffleButton onPress={collection.shuffle} disabled={count < 2} />
      {room && <RoomButton inRoom={room.inRoom} onPress={room.run} />}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  disabled: { opacity: 0.45 },
  play: {
    flex: 1,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // A system shadow, not a blurred one: this scrolls, and a blurred shadow is redrawn each frame.
    elevation: 3,
  },
  playClip: { ...StyleSheet.absoluteFill, borderRadius: HEIGHT / 2, overflow: 'hidden' },
  playText: { ...typography.labelLg, fontSize: 16 },
  iconBox: { width: 22, height: 22 },
  iconLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  round: {
    width: HEIGHT,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  room: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  roomText: { ...typography.labelLg },
});
