import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, IMAGE_FADE_MS, ROW_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { MicVocal } from '@/components/ui/icons';
import { memo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CachedImage } from '@/components/ui/CachedImage';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';
import { ArtworkCarousel } from './ArtworkCarousel';
import { LikeButton } from '../LikeButton';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { PlayingOnRow } from './DeviceSheet';
import { RoomOwnsPlayback } from './RoomOwnsPlayback';
import { Scrubber, secondary, Transport } from './PlayerControls';
import { LyricsView } from '../lyrics/LyricsView';
import { heardPosition, useLyricsPlayback } from '../lyrics/useLyricsPlayback';

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
const SWAP_IN = FadeIn.duration(200).easing(EASE_OUT).reduceMotion(system);
const SWAP_OUT = FadeOut.duration(120).easing(EASE_OUT).reduceMotion(system);

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
  /** 0 in the deck, 1 full screen. The cover hides until it's full: a copy flies in instead. */
  morph: SharedValue<number>;
  /** Where the cover sits, from the top of this tab: the flying copy lands there. */
  onArtLayout: (top: number) => void;
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
  morph,
  onArtLayout,
}: PlayerTabProps) {
  const { colors } = useTheme();
  const quiet = secondary(colors.foreground);
  const nextArt = nextSong?.image?.[1]?.link || nextSong?.image?.[0]?.link;
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  // The lyrics take the cover's place; the song's title and controls stay below them.
  const [lyricsShown, setLyricsShown] = useState(false);
  const lyrics = useLyricsPlayback();

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

  const coverStyle = useAnimatedStyle(() => ({ opacity: morph.get() >= 1 ? 1 : 0 }));
  // The art area centres the cover: it starts half the leftover height down.
  const onArtAreaLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    onArtLayout(y + (height - artworkSize) / 2);
  };

  return (
    <View style={[styles.root, { paddingBottom: Math.max(14, bottomInset + 6) }]}>
      <Animated.View style={[styles.artArea, coverStyle]} onLayout={onArtAreaLayout}>
        {lyricsShown ? (
          <Animated.View entering={SWAP_IN} exiting={SWAP_OUT} style={styles.lyrics}>
            <LyricsView
              songId={lyrics.songId}
              nextSongId={lyrics.nextSongId}
              getPosition={heardPosition}
              active={isOpen}
              onSeek={lyrics.onSeek}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={SWAP_IN} exiting={SWAP_OUT}>
            <ArtworkCarousel
              song={currentSong}
              prev={prevSong}
              next={nextSong}
              index={queueIndex}
              size={artworkSize}
              width={screenWidth}
            />
          </Animated.View>
        )}
      </Animated.View>

      <View style={styles.panel}>
        <View style={styles.titleRow}>
          <Animated.View
            key={currentSong.id}
            entering={textMotion.entering}
            exiting={textMotion.exiting}
            style={styles.titleText}
          >
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {currentSong.name}
            </Text>
            <Text style={[styles.artist, { color: quiet }]} numberOfLines={1}>
              {artistName}
            </Text>
          </Animated.View>
          <PressableScale
            onPress={() => setLyricsShown((shown) => !shown)}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={6}
            accessibilityRole='button'
            accessibilityLabel={lyricsShown ? 'Show cover' : 'Show lyrics'}
            accessibilityState={{ selected: lyricsShown }}
            style={[
              styles.lyricsButton,
              lyricsShown && { backgroundColor: `${colors.foreground}14` },
            ]}
          >
            <MicVocal
              size={20}
              color={lyricsShown ? colors.foreground : quiet}
              strokeWidth={lyricsShown ? 2.2 : 1.9}
            />
          </PressableScale>
          <LikeButton song={currentSong} />
        </View>

        {inRoom ? (
          <RoomOwnsPlayback />
        ) : (
          <>
            <Scrubber active={isOpen} fallbackDuration={Number(currentSong.duration) || 0} />
            <Transport />
            <PlayingOnRow />
          </>
        )}

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
              <CachedImage
                source={{ uri: nextArt }}
                style={[styles.upNextArt, { backgroundColor: `${colors.foreground}14` }]}
                transition={IMAGE_FADE_MS}
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
  lyrics: { flex: 1, alignSelf: 'stretch' },
  lyricsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { paddingHorizontal: 24, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { flex: 1, minWidth: 0 },
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
