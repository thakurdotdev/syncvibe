import { IMAGE_FADE_MS, LIST_PRESS_DELAY, ROW_PRESS_SCALE } from '@/lib/motion';
import { SECTION_GAP, SectionTitle } from '@/components/music/MusicLists';
import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { router } from 'expo-router';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const songArt = (song: Song) => song.image?.[1]?.link || song.image?.[0]?.link;

const songArtist = (song: Song) =>
  song.artist_map?.primary_artists?.[0]?.name ||
  song.artist_map?.artists?.[0]?.name ||
  song.subtitle ||
  '';

// ─── Rows ─────────────────────────────────────────────

/** One song, with nothing around it but space. A rank makes it a chart row. */
const SongRow = memo(function SongRow({ song, rank }: { song: Song; rank?: number }) {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);
  const artist = songArtist(song);
  const bars = isCurrentSong ? <PlayingBars color={colors.foreground} active={isPlaying} /> : null;

  return (
    <>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${rank ? `Number ${rank}, ` : ''}${
          isCurrentSong && isPlaying ? 'Pause' : 'Play'
        } ${song.name} by ${artist}`}
        style={styles.row}
      >
        {rank ? (
          <View style={styles.rank}>
            {bars ?? (
              <Text style={[styles.rankText, { color: colors.mutedForeground }]}>{rank}</Text>
            )}
          </View>
        ) : null}
        <Image
          source={{ uri: songArt(song), cache: 'force-cache' }}
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
        {rank ? null : bars}
      </PressableScale>
      {options}
    </>
  );
});

// ─── Jump back in ─────────────────────────────────────

const QUICK_PICKS = 3;

/** The first thing on Home: your last few songs, one tap to play. The rest are behind See all. */
export const QuickPicks = memo(function QuickPicks({ songs }: { songs: Song[] }) {
  const picks = useMemo(() => songs.filter((s) => s?.id).slice(0, QUICK_PICKS), [songs]);
  if (picks.length < 2) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title='Jump back in' onSeeAll={() => router.push('/song-history')} />
      <View style={styles.rows}>
        {picks.map((song) => (
          <SongRow key={song.id} song={song} />
        ))}
      </View>
    </View>
  );
});

// ─── Trending chart ───────────────────────────────────

const CHART_SIZE = 5;

/** The top of the chart, numbered because the order is the point. */
export const TrendingChart = memo(function TrendingChart({
  songs,
  title,
}: {
  songs: Song[];
  title: string;
}) {
  const top = useMemo(() => songs.filter((s) => s?.id).slice(0, CHART_SIZE), [songs]);
  if (!top.length) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      <View style={styles.rows}>
        {top.map((song, i) => (
          <SongRow key={song.id} song={song} rank={i + 1} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginBottom: SECTION_GAP },

  rows: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  art: { width: 48, height: 48, borderRadius: 6 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  sub: { fontSize: 13, marginTop: 2 },

  rank: { width: 20, alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
