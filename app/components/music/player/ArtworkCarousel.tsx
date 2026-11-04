import { EASE_OUT, SPRING } from '@/lib/motion';
import { useIsPlaying, usePlayerControls } from '@/stores/playerStore';
import { Song } from '@/types/song';
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const PAUSED_SCALE = 0.93;
const COMMIT_DISTANCE = 0.22; // of the screen width
const COMMIT_VELOCITY = 700;
const RUBBER_BAND = 0.2;
const SLIDE = { duration: 240, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;
const SWIPE_SETTLE = { duration: 280, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;

const art = (song: Song) => song.image?.[2]?.link || song.image?.[1]?.link || song.image?.[0]?.link;

/**
 * The artwork as a real carousel. Each song keeps a fixed slot on a long strip (queue index ×
 * screen width) and only the strip moves, so the neighbours are already loaded and already in
 * place: a swipe or a skip button slides to the next cover with no blank frame or reset.
 * Pausing settles the cover back slightly, the quickest "is it playing?" signal there is.
 */
export const ArtworkCarousel = memo(function ArtworkCarousel({
  song,
  prev,
  next,
  index,
  size,
  width,
  dismissGesture,
}: {
  song: Song;
  prev: Song | null;
  next: Song | null;
  index: number;
  size: number;
  width: number;
  dismissGesture: GestureType;
}) {
  const isPlaying = useIsPlaying();
  const { handleNextSong, handlePrevSong } = usePlayerControls();

  const x = useSharedValue(-index * width);
  const goal = useSharedValue(-index * width);
  const canPrev = useSharedValue(Boolean(prev));
  const canNext = useSharedValue(Boolean(next));
  const scale = useSharedValue(isPlaying ? 1 : PAUSED_SCALE);

  const shownIndex = useRef(index);
  const shownSong = useRef(song.id);

  useEffect(() => {
    canPrev.set(Boolean(prev));
    canNext.set(Boolean(next));
  }, [prev, next, canPrev, canNext]);

  useEffect(() => {
    scale.set(withSpring(isPlaying ? 1 : PAUSED_SCALE, SPRING));
  }, [isPlaying, scale]);

  useLayoutEffect(() => {
    const target = -index * width;
    const oneStep = Math.abs(index - shownIndex.current) === 1;
    const songChanged = song.id !== shownSong.current;
    shownIndex.current = index;
    shownSong.current = song.id;

    // A swipe already animates to its target: leave it be, so it keeps the finger's speed.
    if (goal.get() === target) return;
    goal.set(target);
    // Skip button or auto-advance: slide. A jump or a queue reorder: just be there.
    x.set(oneStep && songChanged ? withTiming(target, SLIDE) : target);
  }, [index, width, song.id, goal, x]);

  const goNext = useCallback(() => handleNextSong(), [handleNextSong]);
  const goPrev = useCallback(() => handlePrevSong(true), [handlePrevSong]);

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const blocked = e.translationX > 0 ? !canPrev.get() : !canNext.get();
      x.set(goal.get() + e.translationX * (blocked ? RUBBER_BAND : 1));
    })
    .onEnd((e) => {
      const passed =
        Math.abs(e.translationX) > width * COMMIT_DISTANCE ||
        Math.abs(e.velocityX) > COMMIT_VELOCITY;
      const forward = e.translationX < 0;
      const commit = passed && (forward ? canNext.get() : canPrev.get());

      if (commit) {
        const target = goal.get() + (forward ? -width : width);
        goal.set(target);
        scheduleOnRN(forward ? goNext : goPrev);
      }
      x.set(withSpring(goal.get(), { ...SWIPE_SETTLE, velocity: e.velocityX }));
    });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const slots: { item: Song; at: number }[] = [
    ...(prev ? [{ item: prev, at: index - 1 }] : []),
    { item: song, at: index },
    ...(next ? [{ item: next, at: index + 1 }] : []),
  ];

  return (
    <GestureDetector gesture={Gesture.Race(swipe, dismissGesture)}>
      <View style={[styles.stage, { height: size, width }]}>
        <Animated.View style={[styles.stage, { height: size, width }, scaleStyle]}>
          <Animated.View style={[styles.strip, stripStyle]}>
            {slots.map(({ item, at }) => (
              // Keyed by song, so a cover keeps its loaded image as it moves between slots.
              <View key={item.id} style={[styles.slot, { left: at * width, width, height: size }]}>
                <View style={[styles.cover, { width: size, height: size }]}>
                  <Image
                    source={{ uri: art(item) }}
                    style={styles.coverImage}
                    resizeMode='cover'
                    fadeDuration={0}
                  />
                </View>
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  stage: { alignSelf: 'center' },
  strip: { ...StyleSheet.absoluteFill },
  slot: { position: 'absolute', top: 0, alignItems: 'center' },
  cover: {
    borderRadius: 18,
    backgroundColor: 'rgba(127,127,127,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  coverImage: { width: '100%', height: '100%', borderRadius: 18 },
});
