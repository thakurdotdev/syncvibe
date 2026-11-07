import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { IMAGE_FADE_MS, LIST_PRESS_DELAY, project, SPRING_PRESS } from '@/lib/motion';
import { shortSongName } from '@/lib/stations';
import { EDGE_GUARD } from '@/lib/swipe';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** How much of each cover behind shows past the one in front. */
export const DECK_PEEK = 36;
const BEHIND_SCALE_STEP = 0.1;
const COVERS_BEHIND = 3;
/** How far a drag has to be heading to go to the next cover. */
const COMMIT_DISTANCE = 70;
const SETTLE = { ...SPRING_PRESS, duration: 300 } as const;

const coverUrl = (song: Song) => {
  const link = song.image?.[2]?.link || song.image?.[1]?.link || song.image?.[0]?.link;
  return link ? convertToHttps(link) : undefined;
};

const DeckCover = memo(function DeckCover({
  song,
  order,
  isTop,
  size,
  progress,
  onPlay,
}: {
  song: Song;
  order: number;
  isTop: boolean;
  size: number;
  progress: SharedValue<number>;
  onPlay: (order: number) => void;
}) {
  const { colors } = useTheme();
  const { onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);
  const flyOff = size + DECK_PEEK * 2 + 40;

  // Everything comes from one number, so the stack moves as one thing under your finger.
  const style = useAnimatedStyle(() => {
    const behind = order - progress.get();
    if (behind < 0) {
      return {
        opacity: 1,
        transform: [{ translateX: behind * flyOff }, { rotate: `${behind * 7}deg` }, { scale: 1 }],
      };
    }
    const scale = 1 - BEHIND_SCALE_STEP * behind;
    const rightEdge = size + DECK_PEEK * behind;
    return {
      opacity: behind > COVERS_BEHIND - 0.6 ? Math.max(0, COVERS_BEHIND - behind) : 1,
      transform: [{ translateX: rightEdge - size * scale }, { rotate: '0deg' }, { scale }],
    };
  });

  return (
    <Animated.View
      pointerEvents={isTop ? 'auto' : 'none'}
      style={[styles.cover, { width: size, height: size, zIndex: 100 - order }, style]}
    >
      <PressableScale
        onPress={() => onPlay(order)}
        onLongPress={onLongPress}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        accessibilityRole='button'
        accessibilityLabel={`${isCurrentSong && isPlaying ? 'Pause' : 'Play'} ${shortSongName(song.name)}`}
        accessibilityHint='Swipe sideways for other songs'
        style={[styles.press, { backgroundColor: colors.raised }]}
      >
        <Image
          source={{ uri: coverUrl(song), cache: 'force-cache' }}
          style={styles.image}
          fadeDuration={IMAGE_FADE_MS}
          resizeMethod='resize'
        />
        {isTop && isCurrentSong ? (
          <View style={styles.bars}>
            <PlayingBars color='#fff' active={isPlaying} />
          </View>
        ) : null}
        {isTop && !isCurrentSong ? (
          <View style={styles.play}>
            <Ionicons name='play' size={20} color='#111' style={styles.playGlyph} />
          </View>
        ) : null}
      </PressableScale>
      {options}
    </Animated.View>
  );
});

/**
 * A stack of covers to flick through: left for the next, right to go back, tap to play. Only the
 * few covers you can see are mounted, and the whole stack follows one shared value on the UI
 * thread, so a flick stays smooth while the song details update behind it.
 */
export const CoverDeck = memo(function CoverDeck({
  songs,
  index,
  size,
  onIndexChange,
  onPlay,
}: {
  songs: Song[];
  index: number;
  size: number;
  onIndexChange: (index: number) => void;
  onPlay: (index: number) => void;
}) {
  const progress = useSharedValue(index);
  const start = useSharedValue(index);
  const committed = useRef(index);
  const last = Math.max(0, songs.length - 1);

  // Tapping a song in the list brings it straight here.
  useEffect(() => {
    if (committed.current === index) return;
    committed.current = index;
    progress.set(index);
  }, [index, progress]);

  const commit = useCallback(
    (next: number) => {
      committed.current = next;
      onIndexChange(next);
    },
    [onIndexChange]
  );

  const gesture = useMemo(() => {
    const travel = size + DECK_PEEK * 2 + 40;
    return Gesture.Pan()
      .hitSlop({ left: -EDGE_GUARD, right: -EDGE_GUARD })
      .activeOffsetX([-10, 10])
      .failOffsetY([-12, 12])
      .onStart(() => {
        start.set(progress.get());
      })
      .onUpdate((e) => {
        const raw = start.get() - e.translationX / travel;
        progress.set(raw < 0 ? raw * 0.2 : raw > last ? last + (raw - last) * 0.2 : raw);
      })
      .onEnd((e, success) => {
        const from = Math.round(start.get());
        const heading = e.translationX + project(e.velocityX) * 0.5;
        const step = !success
          ? 0
          : heading < -COMMIT_DISTANCE
            ? 1
            : heading > COMMIT_DISTANCE
              ? -1
              : 0;
        const next = clamp(from + step, 0, last);
        progress.set(withSpring(next, { ...SETTLE, velocity: -e.velocityX / travel }));
        if (next !== from) scheduleOnRN(commit, next);
      });
  }, [commit, last, progress, size, start]);

  const shown = songs
    .map((song, order) => ({ song, order }))
    .slice(Math.max(0, index - 1), index + COVERS_BEHIND);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ height: size }}>
        {shown.map(({ song, order }) => (
          <DeckCover
            key={song.id}
            song={song}
            order={order}
            isTop={order === index}
            size={size}
            progress={progress}
            onPlay={onPlay}
          />
        ))}
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  cover: { position: 'absolute', left: 0, top: 0, transformOrigin: 'left' },
  press: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  bars: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  play: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  playGlyph: { marginLeft: 2 },
});
