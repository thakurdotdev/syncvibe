import { SectionTitle } from '@/components/music/MusicLists';
import { PlayingBars } from '@/components/music/PlayingBars';
import { useSongPress } from '@/components/music/useSongPress';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { fonts } from '@/theme/typography';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const songArt = (song: Song) => song.image?.[1]?.link || song.image?.[0]?.link;

const songArtist = (song: Song) =>
  song.artist_map?.primary_artists?.[0]?.name ||
  song.artist_map?.artists?.[0]?.name ||
  song.subtitle ||
  '';

// ─── Jump back in ─────────────────────────────────────

const QuickTile = memo(function QuickTile({ song }: { song: Song }) {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);

  return (
    <>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityRole='button'
        accessibilityLabel={`${isCurrentSong && isPlaying ? 'Pause' : 'Play'} ${song.name}`}
        style={[styles.tile, { backgroundColor: isCurrentSong ? colors.accent : colors.card }]}
      >
        <Image
          source={{ uri: songArt(song), cache: 'force-cache' }}
          style={[styles.tileArt, { backgroundColor: colors.raised }]}
          fadeDuration={0}
          resizeMethod='resize'
        />
        <View style={styles.tileText}>
          <Text
            style={[
              styles.tileTitle,
              { color: isCurrentSong ? colors.accentForeground : colors.foreground },
            ]}
            numberOfLines={1}
          >
            {song.name}
          </Text>
          <Text
            style={[
              styles.tileSub,
              { color: isCurrentSong ? colors.accentForeground : colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {songArtist(song)}
          </Text>
        </View>
        {isCurrentSong && <PlayingBars color={colors.primary} active={isPlaying} />}
      </PressableScale>
      {options}
    </>
  );
});

/**
 * The first thing on Home: your last six songs as compact two-up tiles, one tap to play.
 * Denser than a carousel, and everything is visible without scrolling sideways.
 */
export const QuickPicks = memo(function QuickPicks({ songs }: { songs: Song[] }) {
  const picks = useMemo(() => songs.filter((s) => s?.id).slice(0, 6), [songs]);
  if (picks.length < 2) return null;
  const rows: Song[][] = [];
  for (let i = 0; i < picks.length; i += 2) rows.push(picks.slice(i, i + 2));

  return (
    <View style={styles.section}>
      <SectionTitle title='Jump back in' onSeeAll={() => router.push('/song-history')} />
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row.map((s) => s.id).join('-')} style={styles.gridRow}>
            {row.map((song) => (
              <QuickTile key={song.id} song={song} />
            ))}
            {row.length === 1 && <View style={styles.tileSpacer} />}
          </View>
        ))}
      </View>
    </View>
  );
});

// ─── Trending chart ───────────────────────────────────

const ChartRow = memo(function ChartRow({ song, rank }: { song: Song; rank: number }) {
  const { colors } = useTheme();
  const { onPress, onLongPress, isCurrentSong, isPlaying, options } = useSongPress(song);

  return (
    <>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        scaleTo={0.98}
        accessibilityRole='button'
        accessibilityLabel={`Number ${rank}, ${song.name} by ${songArtist(song)}`}
        style={styles.chartRow}
      >
        <View style={styles.rank}>
          {isCurrentSong ? (
            <PlayingBars color={colors.primary} active={isPlaying} />
          ) : (
            <Text style={[styles.rankText, { color: colors.mutedForeground }]}>{rank}</Text>
          )}
        </View>
        <Image
          source={{ uri: songArt(song), cache: 'force-cache' }}
          style={[styles.chartArt, { backgroundColor: colors.raised }]}
          fadeDuration={0}
          resizeMethod='resize'
        />
        <View style={styles.tileText}>
          <Text
            style={[
              styles.chartTitle,
              { color: isCurrentSong ? colors.primary : colors.foreground },
            ]}
            numberOfLines={1}
          >
            {song.name}
          </Text>
          <Text style={[styles.tileSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {songArtist(song)}
          </Text>
        </View>
        <Ionicons
          name={isCurrentSong && isPlaying ? 'pause' : 'play'}
          size={15}
          color={colors.mutedForeground}
        />
      </PressableScale>
      {options}
    </>
  );
});

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
          <ChartRow key={song.id} song={song} rank={item.start + i + 1} />
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

const TILE_ART = 44;

const styles = StyleSheet.create({
  section: { marginBottom: 30 },

  grid: { paddingHorizontal: 16, gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 4,
    paddingRight: 10,
    borderRadius: 11,
  },
  tileSpacer: { flex: 1 },
  tileArt: { width: TILE_ART, height: TILE_ART, borderRadius: 7 },
  tileText: { flex: 1, minWidth: 0 },
  tileTitle: { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },
  tileSub: { fontSize: 12, marginTop: 1 },

  chartContent: { paddingHorizontal: 16 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 62 },
  rank: { width: 22, alignItems: 'center' },
  rankText: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  chartArt: { width: 48, height: 48, borderRadius: 10 },
  chartTitle: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.1 },
});
