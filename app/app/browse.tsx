import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from '@/components/music/MusicCards';
import { CardRow } from '@/components/music/MusicLists';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { StackHeader } from '@/components/ui/AppHeader';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BrowseItem, BrowseSection, toBrowseSections } from '@/lib/browseSections';
import { useHomePageMusic } from '@/queries/useMusic';
import { useIsRestoring } from '@tanstack/react-query';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

const COVER_WIDTH = 140;
const ARTIST_WIDTH = 96;

const renderCard = (item: BrowseItem) => {
  switch (item.kind) {
    case 'song':
      return <NewSongCard song={item.song} />;
    case 'album':
      return <AlbumCard album={item.album} />;
    case 'playlist':
      return <PlaylistCard playlist={item.playlist} />;
    case 'artist':
      return <ArtistCard artist={item.artist} />;
  }
};

const keyOfItem = (item: BrowseItem) => item.key;

const SectionRow = memo(function SectionRow({ section }: { section: BrowseSection }) {
  const onlyArtists = section.items.every((item) => item.kind === 'artist');
  return (
    <CardRow
      title={section.title}
      data={section.items}
      itemWidth={onlyArtists ? ARTIST_WIDTH : COVER_WIDTH}
      renderCard={renderCard}
      keyOf={keyOfItem}
    />
  );
});

const renderSection = ({ item }: { item: BrowseSection }) => <SectionRow section={item} />;
const keyOfSection = (section: BrowseSection) => section.key;

/** Everything the music service offers right now, in the order it suggests. */
export default function BrowseScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isError, refetch } = useHomePageMusic();
  const isRestoring = useIsRestoring();
  const sections = useMemo(() => toBrowseSections(data), [data]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const empty = () => {
    if (isLoading || isRestoring) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {isError ? "Couldn't load music. Check your connection." : 'Nothing to browse right now.'}
        </Text>
        <PressableScale
          onPress={() => refetch()}
          accessibilityRole='button'
          style={[styles.retry, { backgroundColor: colors.raised }]}
        >
          <Text style={[styles.retryText, { color: colors.foreground }]}>Try again</Text>
        </PressableScale>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StackHeader title='Browse' />
      <FlatList
        data={sections}
        keyExtractor={keyOfSection}
        renderItem={renderSection}
        ListEmptyComponent={empty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 8, paddingBottom: DECK_CLEARANCE },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  retry: { height: 40, paddingHorizontal: 18, borderRadius: 20, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '600' },
});
