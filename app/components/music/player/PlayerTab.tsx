import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, IMAGE_FADE_MS, ROW_PRESS_SCALE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { MicVocal } from '@/components/ui/icons';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CachedImage } from '@/components/ui/CachedImage';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
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
import { glanceHeight, LyricsGlance, PlainLyricsLink } from '../lyrics/LyricsGlance';
import { LyricsSheet } from '../lyrics/LyricsSheet';
import { heardPosition, useLyricsPlayback } from '../lyrics/useLyricsPlayback';
import { prefetchLyrics, useLyrics } from '@/queries/useLyrics';
import { useLyricsPrefs } from '@/stores/lyricsPrefsStore';
import { useQueryClient } from '@tanstack/react-query';

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
/** The cover making room for the lyrics under it, and taking it back. */
const MAKE_ROOM = { duration: 460, easing: EASE_OUT, reduceMotion: system } as const;
/** Space taken under the cover by the lyrics: their lines and the gap above them. */
const GLANCE_SPACE = glanceHeight('player') + 18;
/** The cover never shrinks past this for the lyrics. */
const MIN_COVER_SCALE = 0.62;

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
  /** How much the cover is shrunk to make room for the lyrics under it (the flying copy too). */
  artScale: SharedValue<number>;
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
  artScale,
}: PlayerTabProps) {
  const { colors } = useTheme();
  const quiet = secondary(colors.foreground);
  const nextArt = nextSong?.image?.[1]?.link || nextSong?.image?.[0]?.link;
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  // Two lines of the lyrics under the cover; tapping them opens the whole song.
  const lyrics = useLyricsPlayback();
  const showLyrics = useLyricsPrefs((s) => s.showLyrics);
  const setShowLyrics = useLyricsPrefs((s) => s.setShowLyrics);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const client = useQueryClient();
  const { data: lyricsData } = useLyrics(lyrics.songId, showLyrics);
  const glance =
    showLyrics && (lyricsData?.kind === 'synced' || lyricsData?.kind === 'plain')
      ? lyricsData
      : null;
  useEffect(() => {
    if (isOpen && showLyrics) prefetchLyrics(client, lyrics.nextSongId);
  }, [client, isOpen, lyrics.nextSongId, showLyrics]);

  // The cover shrinks just enough (if at all) for the lines to fit under it.
  const [areaHeight, setAreaHeight] = useState(0);
  const scaleFor = glance
    ? Math.min(1, Math.max(MIN_COVER_SCALE, (areaHeight - GLANCE_SPACE) / artworkSize))
    : 1;
  const glanceSpace = useSharedValue(glance ? GLANCE_SPACE : 0);
  useEffect(() => {
    if (areaHeight === 0) return;
    artScale.set(withTiming(scaleFor, MAKE_ROOM));
    glanceSpace.set(withTiming(glance ? GLANCE_SPACE : 0, MAKE_ROOM));
  }, [areaHeight, artScale, glance, glanceSpace, scaleFor]);
  const coverBoxStyle = useAnimatedStyle(() => ({ height: artworkSize * artScale.get() }));
  const coverShrinkStyle = useAnimatedStyle(() => {
    const s = artScale.get();
    return { transform: [{ translateY: (-artworkSize * (1 - s)) / 2 }, { scale: s }] };
  });
  const glanceStyle = useAnimatedStyle(() => ({ height: glanceSpace.get() }));

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
  // The art area centres the cover (and the lyrics under it): it starts half the leftover
  // height down.
  const [areaTop, setAreaTop] = useState(0);
  const onArtAreaLayout = (e: LayoutChangeEvent) => {
    setAreaTop(e.nativeEvent.layout.y);
    setAreaHeight(e.nativeEvent.layout.height);
  };
  useEffect(() => {
    const column = artworkSize * scaleFor + (glance ? GLANCE_SPACE : 0);
    onArtLayout(areaTop + (areaHeight - column) / 2);
  }, [areaHeight, areaTop, artworkSize, glance, onArtLayout, scaleFor]);

  return (
    <View style={[styles.root, { paddingBottom: Math.max(14, bottomInset + 6) }]}>
      <Animated.View style={[styles.artArea, coverStyle]} onLayout={onArtAreaLayout}>
        <Animated.View style={coverBoxStyle}>
          <Animated.View style={coverShrinkStyle}>
            <ArtworkCarousel
              song={currentSong}
              prev={prevSong}
              next={nextSong}
              index={queueIndex}
              size={artworkSize}
              width={screenWidth}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.glance, glanceStyle]}>
          {glance?.kind === 'synced' ? (
            <LyricsGlance
              lines={glance.lines}
              getPosition={heardPosition}
              active={isOpen}
              onOpen={() => setLyricsOpen(true)}
            />
          ) : glance?.kind === 'plain' ? (
            <PlainLyricsLink lyrics={glance} onOpen={() => setLyricsOpen(true)} />
          ) : null}
        </Animated.View>
      </Animated.View>
      <LyricsSheet
        isVisible={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        songId={lyrics.songId}
        nextSongId={lyrics.nextSongId}
        songName={currentSong.name}
        onSeek={lyrics.onSeek}
      />

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
            onPress={() => setShowLyrics(!showLyrics)}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={6}
            accessibilityRole='switch'
            accessibilityLabel='Lyrics under the cover'
            accessibilityState={{ checked: showLyrics }}
            style={styles.lyricsButton}
          >
            <MicVocal
              size={20}
              color={showLyrics ? colors.foreground : quiet}
              strokeWidth={showLyrics ? 2.1 : 1.8}
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
  glance: { paddingTop: 18, paddingHorizontal: 24, overflow: 'hidden' },
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
