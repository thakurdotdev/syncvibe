import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { IMAGE_FADE_MS, LIST_PRESS_DELAY, ROW_PRESS_SCALE } from '@/lib/motion';
import { shortSongName } from '@/lib/stations';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const songThumb = (song: Song) => {
  const link = song.image?.[1]?.link || song.image?.[0]?.link;
  return link ? convertToHttps(link) : undefined;
};

const songArtist = (song: Song) =>
  song.artist_map?.primary_artists?.[0]?.name ||
  song.artist_map?.artists?.[0]?.name ||
  song.subtitle ||
  '';

/** One song, with nothing around it but space. */
export const SongRow = memo(function SongRow({
  song,
  onPlay,
}: {
  song: Song;
  onPlay?: () => void;
}) {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);
  const artist = songArtist(song);

  return (
    <>
      <PressableScale
        onPress={onPlay ?? onPress}
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
            {shortSongName(song.name)}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  art: { width: 48, height: 48, borderRadius: 6 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  sub: { fontSize: 13, marginTop: 2 },
});
