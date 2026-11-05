import { EASE_OUT, SPRING } from '@/lib/motion';
import { EDGE_GUARD, isSkipSwipe, SWIPE_ACTIVATE } from '@/lib/swipe';
import { useIsPlaying, usePlayerControls } from '@/stores/playerStore';
import { Song } from '@/types/song';
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const PAUSED_SCALE = 0.93;
const PAUSE_SETTLE_DELAY_MS = 150;
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
}: {
  song: Song;
  prev: Song | null;
  next: Song | null;
  index: number;
  size: number;
  width: number;
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
    const settle = withSpring(isPlaying ? 1 : PAUSED_SCALE, SPRING);
    // Leaving a beat before settling back absorbs any brief pause while the player catches up.
    scale.set(isPlaying ? settle : withDelay(PAUSE_SETTLE_DELAY_MS, settle));
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

  // Only a swipe that starts on the cover counts, which also keeps it out of the back-gesture zone.
  const edgeGuard = Math.max(EDGE_GUARD, (width - size) / 2);

  const swipe = Gesture.Pan()
    .hitSlop({ left: -edgeGuard, right: -edgeGuard })
    .activeOffsetX([-SWIPE_ACTIVATE, SWIPE_ACTIVATE])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      const blocked = e.translationX > 0 ? !canPrev.get() : !canNext.get();
      x.set(goal.get() + e.translationX * (blocked ? RUBBER_BAND : 1));
    })
    .onEnd((e, success) => {
      const forward = e.translationX < 0;
      // `success` is false when the system took the touch over, as its back gesture does. This
      // callback still runs then, with that gesture's high velocity, and must not skip the song.
      const commit =
        success &&
        isSkipSwipe(e.translationX, e.velocityX, width) &&
        (forward ? canNext.get() : canPrev.get());

      if (commit) {
        const target = goal.get() + (forward ? -width : width);
        goal.set(target);
        scheduleOnRN(forward ? goNext : goPrev);
      }
      x.set(withSpring(goal.get(), { ...SWIPE_SETTLE, velocity: success ? e.velocityX : 0 }));
    });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const slots: { item: Song; at: number }[] = [
    ...(prev ? [{ item: prev, at: index - 1 }] : []),
    { item: song, at: index },
    ...(next ? [{ item: next, at: index + 1 }] : []),
  ];

  return (
    <GestureDetector gesture={swipe}>
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
  },
  coverImage: { width: '100%', height: '100%', borderRadius: 18 },
});
