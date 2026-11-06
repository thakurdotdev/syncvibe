import { ROW_PRESS_SCALE } from '@/lib/motion';
import { SECTION_GAP, SectionTitle } from '@/components/music/MusicLists';
import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
          fadeDuration={0}
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

const CHART_ROWS = 4;
const COLUMN_GAP = 12;

type ChartColumn = { key: string; start: number; items: Song[] };

/**
 * Trending as a numbered chart: columns of four rows that page sideways (the next column
 * peeks in), so the ranking reads at a glance instead of as another row of square cards.
 */
export const TrendingChart = memo(function TrendingChart({
  songs,
  title,
}: {
  songs: Song[];
  title: string;
}) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.round(width - 16 * 2 - 28);
  const step = columnWidth + COLUMN_GAP;
  const columns = useMemo(() => {
    const list = songs.filter((s) => s?.id).slice(0, 20);
    const out: ChartColumn[] = [];
    for (let i = 0; i < list.length; i += CHART_ROWS) {
      out.push({ key: list[i].id, start: i, items: list.slice(i, i + CHART_ROWS) });
    }
    return out;
  }, [songs]);

  const renderColumn = useCallback(
    ({ item }: { item: ChartColumn }) => (
      <View style={{ width: columnWidth }}>
        {item.items.map((song, i) => (
          <SongRow key={song.id} song={song} rank={item.start + i + 1} />
        ))}
      </View>
    ),
    [columnWidth]
  );
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: step, offset: step * index, index }),
    [step]
  );

  if (!columns.length) return null;

  return (
    <View style={styles.section}>
      <SectionTitle title={title} />
      <FlatList
        data={columns}
        keyExtractor={(c) => c.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate='fast'
        disableIntervalMomentum
        contentContainerStyle={styles.chartContent}
        ItemSeparatorComponent={ColumnGap}
        getItemLayout={getItemLayout}
        renderItem={renderColumn}
        // Only the first column and the one peeking in: that's 8 rows, not all 20.
        initialNumToRender={2}
        maxToRenderPerBatch={1}
        windowSize={3}
      />
    </View>
  );
});

const ColumnGap = () => <View style={{ width: COLUMN_GAP }} />;

const styles = StyleSheet.create({
  section: { marginBottom: SECTION_GAP },

  rows: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  art: { width: 48, height: 48, borderRadius: 6 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  sub: { fontSize: 13, marginTop: 2 },

  chartContent: { paddingHorizontal: 16 },
  rank: { width: 20, alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
