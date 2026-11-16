import { playStationFrom } from '@/components/music/home/playStation';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { HeaderIconButton, StackHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import Button from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { useRecap } from '@/queries/usePersonal';
import { fonts } from '@/theme/typography';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PEAK = {
  morning: 'a morning listener',
  afternoon: 'an afternoon listener',
  evening: 'an evening listener',
  night: 'a night owl',
} as const;

const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const Stat = ({ value, label }: { value: string | number; label: string }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
};

/** The last seven days of your listening: time, top songs and artists, your mood. */
export default function RecapScreen() {
  const { colors } = useTheme();
  const { data: recap, isLoading, isError, refetch } = useRecap();

  const share = () => {
    if (!recap) return;
    const parts = [
      `My week on SyncVibe: ${recap.minutes} minutes of music`,
      recap.topArtists[0] && `mostly ${recap.topArtists[0].name}`,
      recap.topSongs[0] && `on repeat: ${recap.topSongs[0].song.name}`,
    ].filter(Boolean);
    Share.share({ message: `${parts.join(', ')} https://syncvibe.thakur.dev` }).catch(() => {});
  };

  const body = () => {
    if (isLoading)
      return <ActivityIndicator style={styles.center} color={colors.mutedForeground} />;
    if (isError || !recap) {
      return (
        <View style={styles.empty}>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Couldn&apos;t load your week.
          </Text>
          <Button variant='outline' size='sm' title='Try again' onPress={() => refetch()} />
        </View>
      );
    }
    if (!recap.minutes) {
      return (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>A quiet week</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            Play some music and your week in music shows up here.
          </Text>
        </View>
      );
    }
    const change = recap.previousMinutes
      ? Math.round(((recap.minutes - recap.previousMinutes) / recap.previousMinutes) * 100)
      : null;
    const topSongs = recap.topSongs.map((item) => item.song);

    return (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: DECK_CLEARANCE }]}>
        <Text style={[styles.range, { color: colors.mutedForeground }]}>
          {formatDay(recap.from)} – {formatDay(recap.to)}
        </Text>
        <View style={styles.grid}>
          <Stat
            value={recap.minutes}
            label={
              change === null
                ? 'minutes listened'
                : `minutes, ${change >= 0 ? `${change}% more` : `${-change}% less`} than last week`
            }
          />
          <Stat value={`${recap.daysListened}/7`} label='days with music' />
          <Stat value={recap.songsPlayed} label='different songs' />
          <Stat value={recap.discoveries} label='heard for the first time' />
        </View>

        {(recap.topMood || recap.peak) && (
          <Text style={[styles.sentence, { color: colors.foreground }]}>
            {recap.topMood ? `Your mood was mostly ${recap.topMood.title}` : 'You were'}
            {recap.topMood && recap.peak ? ', and you were ' : recap.topMood ? '.' : ' '}
            {recap.peak ? `${PEAK[recap.peak]}.` : ''}
          </Text>
        )}

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>On repeat</Text>
          <Button
            size='sm'
            title='Play'
            icon={<Ionicons name='play' size={14} color={colors.primaryForeground} />}
            onPress={() => playStationFrom(topSongs, 0)}
            style={styles.pill}
          />
        </View>
        {recap.topSongs.map(({ song, plays }, index) => {
          const art = song.image?.[1]?.link || song.image?.[0]?.link;
          return (
            <PressableScale
              key={song.id}
              onPress={() => playStationFrom(topSongs, index)}
              scaleTo={ROW_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityLabel={`Play ${song.name}, ${plays} plays`}
              style={styles.row}
            >
              <Text style={[styles.rank, { color: colors.mutedForeground }]}>{index + 1}</Text>
              <Image
                source={{ uri: art ? convertToHttps(art) : undefined }}
                style={[styles.art, { backgroundColor: colors.raised }]}
              />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {song.name}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {song.artist_map?.primary_artists?.[0]?.name ?? ''}
                </Text>
              </View>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {plays} {plays === 1 ? 'play' : 'plays'}
              </Text>
            </PressableScale>
          );
        })}

        {recap.topArtists.length > 0 && (
          <Text style={[styles.sectionTitle, styles.artistsTitle, { color: colors.foreground }]}>
            Top artists
          </Text>
        )}
        {recap.topArtists.map((artist, index) => (
          <View key={artist.id ?? artist.name} style={styles.row}>
            <Text style={[styles.rank, { color: colors.mutedForeground }]}>{index + 1}</Text>
            <Image
              source={{ uri: artist.image ? convertToHttps(artist.image) : undefined }}
              style={[styles.art, styles.round, { backgroundColor: colors.raised }]}
            />
            <Text
              style={[styles.rowTitle, styles.rowText, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {artist.name}
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              {artist.minutes} min
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StackHeader
        title='Your week in music'
        right={
          recap?.minutes ? (
            <HeaderIconButton label='Share your week' onPress={share}>
              <Ionicons name='share-outline' size={18} color={colors.foreground} />
            </HeaderIconButton>
          ) : undefined
        }
      />
      {body()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { marginTop: 48 },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  range: { fontSize: 13, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontFamily: fonts.displaySemibold, fontSize: 28, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  sentence: { fontSize: 17, lineHeight: 24, marginTop: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 6,
  },
  sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 17, letterSpacing: -0.3 },
  artistsTitle: { marginTop: 24, marginBottom: 6 },
  pill: { borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 60 },
  rank: {
    width: 18,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  art: { width: 44, height: 44, borderRadius: 8 },
  round: { borderRadius: 22 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 1, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 72 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  muted: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
