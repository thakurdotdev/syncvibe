import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { EASE_OUT, IMAGE_FADE_MS, ROW_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';
import { ArtworkCarousel } from './ArtworkCarousel';
import { PlayingOnRow } from './DeviceSheet';
import { Scrubber, secondary, Transport } from './PlayerControls';

// The title moves with the artwork: the old one leaves the way the cover went and the new one
// follows it in. Exits are quicker than entries, so the two barely overlap.
const system = ReduceMotion.System;
const TEXT_ENTER_MS = 220;
const TEXT_EXIT_MS = 120;
const TEXT_MOTION = {
  next: {
    entering: FadeInRight.duration(TEXT_ENTER_MS).easing(EASE_OUT).reduceMotion(system),
    exiting: FadeOutLeft.duration(TEXT_EXIT_MS).easing(EASE_OUT).reduceMotion(system),
  },
  prev: {
    entering: FadeInLeft.duration(TEXT_ENTER_MS).easing(EASE_OUT).reduceMotion(system),
    exiting: FadeOutRight.duration(TEXT_EXIT_MS).easing(EASE_OUT).reduceMotion(system),
  },
} as const;
const UP_NEXT_ENTER = FadeIn.duration(180).easing(EASE_OUT).reduceMotion(system);
const UP_NEXT_EXIT = FadeOut.duration(100).easing(EASE_OUT).reduceMotion(system);

interface PlayerTabProps {
  currentSong: Song;
  artistName: string;
  artworkSize: number;
  screenWidth: number;
  queueIndex: number;
  prevSong: Song | null;
  nextSong: Song | null;
  queueCount: number;
  bottomInset: number;
  isOpen: boolean;
  onOpenQueue: () => void;
}

/** Now playing: artwork, song, position, transport, and the way into the queue. */
export const PlayerTab = memo(function PlayerTab({
  currentSong,
  artistName,
  artworkSize,
  screenWidth,
  queueIndex,
  prevSong,
  nextSong,
  queueCount,
  bottomInset,
  isOpen,
  onOpenQueue,
}: PlayerTabProps) {
  const { colors } = useTheme();
  const quiet = secondary(colors.foreground);
  const nextArt = nextSong?.image?.[1]?.link || nextSong?.image?.[0]?.link;

  // Which way the last song change went, set while rendering so the new title animates the right
  // way on its first frame. Only one step back is "previous": jumps, and wrapping round to the
  // start, read as moving on. A reorder moves the index without changing the song: no change.
  const [shown, setShown] = useState({ id: currentSong.id, index: queueIndex });
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  if (shown.id !== currentSong.id || shown.index !== queueIndex) {
    if (shown.id !== currentSong.id) setDirection(queueIndex === shown.index - 1 ? 'prev' : 'next');
    setShown({ id: currentSong.id, index: queueIndex });
  }
  const textMotion = TEXT_MOTION[direction];

  return (
    <View style={[styles.root, { paddingBottom: Math.max(14, bottomInset + 6) }]}>
      <View style={styles.artArea}>
        <ArtworkCarousel
          song={currentSong}
          prev={prevSong}
          next={nextSong}
          index={queueIndex}
          size={artworkSize}
          width={screenWidth}
        />
      </View>

      <View style={styles.panel}>
        <Animated.View
          key={currentSong.id}
          entering={textMotion.entering}
          exiting={textMotion.exiting}
        >
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {currentSong.name}
          </Text>
          <Text style={[styles.artist, { color: quiet }]} numberOfLines={1}>
            {artistName}
          </Text>
        </Animated.View>

        <Scrubber active={isOpen} fallbackDuration={Number(currentSong.duration) || 0} />
        <Transport />
        <PlayingOnRow />

        <PressableScale
          onPress={onOpenQueue}
          scaleTo={ROW_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel={nextSong ? `Open queue. Up next: ${nextSong.name}` : 'Open queue'}
          style={[styles.upNext, { backgroundColor: `${colors.foreground}0F` }]}
        >
          {/* Cross-fades when the next song changes, instead of blinking to it. */}
          <Animated.View
            key={nextSong?.id ?? 'none'}
            entering={UP_NEXT_ENTER}
            exiting={UP_NEXT_EXIT}
            style={styles.upNextSong}
          >
            {nextArt ? (
              <Image
                source={{ uri: nextArt }}
                style={[styles.upNextArt, { backgroundColor: `${colors.foreground}14` }]}
                fadeDuration={IMAGE_FADE_MS}
              />
            ) : (
              <View style={[styles.upNextArt, styles.upNextEmpty]}>
                <Ionicons name='musical-notes' size={16} color={quiet} />
              </View>
            )}
            <View style={styles.upNextText}>
              <Text style={[styles.upNextLabel, { color: quiet }]}>
                {nextSong ? 'Up next' : 'Queue'}
              </Text>
              <Text style={[styles.upNextName, { color: colors.foreground }]} numberOfLines={1}>
                {nextSong ? nextSong.name : 'Nothing after this song'}
              </Text>
            </View>
          </Animated.View>
          {queueCount > 0 && (
            <Text style={[styles.upNextCount, { color: quiet }]}>{queueCount}</Text>
          )}
          {/* Points up: this row is also where the swipe up to the queue suggests itself. */}
          <Ionicons name='chevron-up' size={19} color={colors.foreground} />
        </PressableScale>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  artArea: { flex: 1, justifyContent: 'center' },
  panel: { paddingHorizontal: 24, gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 25, lineHeight: 31, letterSpacing: -0.6 },
  artist: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 54,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 14,
    marginTop: 2,
  },
  upNextSong: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  upNextArt: { width: 38, height: 38, borderRadius: 8 },
  upNextEmpty: { alignItems: 'center', justifyContent: 'center' },
  upNextText: { flex: 1, minWidth: 0 },
  upNextLabel: { fontSize: 11, fontWeight: '600' },
  upNextName: { fontSize: 13.5, fontWeight: '600', marginTop: 1 },
  upNextCount: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
