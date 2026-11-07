import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import {
  BUTTON_PRESS_SCALE,
  EASE_OUT,
  IMAGE_FADE_MS,
  LIST_PRESS_DELAY,
  ROW_PRESS_SCALE,
} from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export const songCoverUrl = (song: Song) => {
  const link = song.image?.[2]?.link || song.image?.[1]?.link || song.image?.[0]?.link;
  return link ? convertToHttps(link) : undefined;
};

const songThumb = (song: Song) => {
  const link = song.image?.[1]?.link || song.image?.[0]?.link;
  return link ? convertToHttps(link) : undefined;
};

const songArtist = (song: Song) =>
  song.artist_map?.primary_artists?.[0]?.name ||
  song.artist_map?.artists?.[0]?.name ||
  song.subtitle ||
  '';

const COVER_ENTER = FadeIn.duration(200).easing(EASE_OUT);
const COVER_EXIT = FadeOut.duration(200).easing(EASE_OUT);
const TEXT_ENTER = FadeIn.duration(200).easing(EASE_OUT);

/**
 * The next thing to play, and the one big thing on Home. Tap anywhere on it to start. When the
 * song changes, the covers cross-fade: Home's only motion besides presses.
 */
export const HomeHero = memo(function HomeHero({ song }: { song: Song }) {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);
  const pause = isCurrentSong && isPlaying;

  return (
    <View style={styles.hero}>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        accessibilityRole='button'
        accessibilityLabel={`${pause ? 'Pause' : 'Play'} ${song.name} by ${songArtist(song)}`}
        style={[styles.cover, { backgroundColor: colors.raised }]}
      >
        <Animated.Image
          key={song.id}
          entering={COVER_ENTER}
          exiting={COVER_EXIT}
          source={{ uri: songCoverUrl(song), cache: 'force-cache' }}
          style={styles.coverImage}
          fadeDuration={IMAGE_FADE_MS}
          resizeMethod='resize'
        />
      </PressableScale>

      <View style={styles.heroRow}>
        <Animated.View key={song.id} entering={TEXT_ENTER} style={styles.text}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]} numberOfLines={1}>
            {song.name}
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {songArtist(song)}
          </Text>
        </Animated.View>
        <PressableScale
          onPress={onPress}
          scaleTo={BUTTON_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel={pause ? 'Pause' : 'Play'}
          style={[styles.play, { backgroundColor: colors.foreground }]}
        >
          <Ionicons
            name={pause ? 'pause' : 'play'}
            size={22}
            color={colors.background}
            style={pause ? undefined : styles.playGlyph}
          />
        </PressableScale>
      </View>
      {options}
    </View>
  );
});

/** One song, with nothing around it but space. */
export const SongRow = memo(function SongRow({ song }: { song: Song }) {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);
  const artist = songArtist(song);

  return (
    <>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${isCurrentSong && isPlaying ? 'Pause' : 'Play'} ${song.name} by ${artist}`}
        style={styles.row}
      >
        <Image
          source={{ uri: songThumb(song), cache: 'force-cache' }}
          style={[styles.art, { backgroundColor: colors.raised }]}
          fadeDuration={IMAGE_FADE_MS}
          resizeMethod='resize'
        />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {song.name}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        {isCurrentSong ? <PlayingBars color={colors.foreground} active={isPlaying} /> : null}
      </PressableScale>
      {options}
    </>
  );
});

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16 },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  coverImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingLeft: 2 },
  heroTitle: { fontFamily: fonts.display, fontSize: 27, lineHeight: 31, letterSpacing: -0.6 },
  heroSub: { fontSize: 14.5, marginTop: 3 },
  play: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { marginLeft: 3 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  art: { width: 48, height: 48, borderRadius: 6 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  sub: { fontSize: 13, marginTop: 2 },
});
