import { SongCard } from '@/components/music/MusicCards';
import { playStationFrom } from '@/components/music/home/playStation';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { StackHeader } from '@/components/ui/AppHeader';
import Button from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { SONG_LIST_WINDOW } from '@/lib/lists';
import { useLikedSongs } from '@/queries/usePersonal';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const renderSong = ({ item }: { item: Song }) => <SongCard song={item} />;

/** Every song you've liked, newest first. */
export default function LikedSongsScreen() {
  const { colors } = useTheme();
  const { data: songs = [], isLoading, isError, refetch, isRefetching } = useLikedSongs();

  const shuffle = () =>
    playStationFrom(
      [...songs].sort(() => Math.random() - 0.5),
      0
    );

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StackHeader title='Liked songs' />
      {isLoading ? (
        <ActivityIndicator style={styles.center} color={colors.mutedForeground} />
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Couldn&apos;t load your liked songs.
          </Text>
          <Button variant='outline' size='sm' title='Try again' onPress={() => refetch()} />
        </View>
      ) : songs.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.raised }]}>
            <Ionicons name='heart-outline' size={26} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No liked songs yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Tap the heart in the player on songs you love. They land here, and we&apos;ll recommend
            more like them.
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(song) => song.id}
          renderItem={renderSong}
          {...SONG_LIST_WINDOW}
          contentContainerStyle={[styles.list, { paddingBottom: DECK_CLEARANCE }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.actions}>
              <Button
                title='Play'
                icon={<Ionicons name='play' size={16} color={colors.primaryForeground} />}
                onPress={() => playStationFrom(songs, 0)}
                style={styles.action}
              />
              <Button
                variant='secondary'
                title='Shuffle'
                icon={<Ionicons name='shuffle' size={16} color={colors.foreground} />}
                onPress={shuffle}
                style={styles.action}
              />
              <Text style={[styles.count, { color: colors.mutedForeground }]}>
                {songs.length} {songs.length === 1 ? 'song' : 'songs'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { marginTop: 48 },
  list: { paddingHorizontal: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingBottom: 12 },
  action: { borderRadius: 999 },
  count: { marginLeft: 'auto', fontSize: 13, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 72 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
