import { useTheme } from '@/context/ThemeContext';
import { Album, Artist, Playlist } from '@/types/music';
import { Song } from '@/types/song';
import { router } from 'expo-router';
import { memo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import PressableScale from '@/components/ui/PressableScale';
import { fonts } from '@/theme/typography';
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from './MusicCards';

/** Section heading used by every home row: display face, optional "See all" on the right. */
const SectionTitle = memo(function SectionTitle({
  title,
  onSeeAll,
}: {
  title?: string;
  onSeeAll?: () => void;
}) {
  const { colors } = useTheme();
  if (!title) return null;
  return (
    <View style={sectionStyles.row}>
      <Text style={[sectionStyles.title, { color: colors.foreground }]} accessibilityRole='header'>
        {title}
      </Text>
      {onSeeAll && (
        <PressableScale
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={`See all ${title}`}
          style={sectionStyles.seeAll}
        >
          <Text style={[sectionStyles.seeAllText, { color: colors.mutedForeground }]}>See all</Text>
        </PressableScale>
      )}
    </View>
  );
});

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontFamily: fonts.display, fontSize: 21, letterSpacing: -0.4 },
  seeAll: { paddingVertical: 2 },
  seeAllText: { fontSize: 13, fontWeight: '600' },
});

interface AlbumsGridProps {
  albums: Album[];
  title?: string;
}

interface PlaylistsGridProps {
  playlists: Playlist[];
  title?: string;
}

interface ArtistGridProps {
  artists: Artist[];
  title?: string;
}

interface RecommendationGridProps {
  recommendations: Song[];
  title?: string;
  showMore?: boolean;
}

export const AlbumsGrid = memo(({ albums, title }: AlbumsGridProps) => {
  if (!albums?.length) return null;

  return (
    <View style={{ marginBottom: 28 }}>
      <SectionTitle title={title} />
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginRight: 14 }}>
            <AlbumCard album={item} width={148} />
          </View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        getItemLayout={(_, index) => ({ length: 162, offset: 162 * index, index })}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

export const PlaylistsGrid = memo(({ playlists, title }: PlaylistsGridProps) => {
  if (!playlists?.length) return null;

  return (
    <View style={{ marginBottom: 28 }}>
      <SectionTitle title={title} />
      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginRight: 14 }}>
            <PlaylistCard playlist={item} isUser={false} width={148} />
          </View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        getItemLayout={(_, index) => ({ length: 162, offset: 162 * index, index })}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

export const RecommendationGrid = memo(
  ({ recommendations, title, showMore = false }: RecommendationGridProps) => {
    if (!recommendations?.length) return null;

    return (
      <View style={{ marginBottom: 28 }}>
        <SectionTitle
          title={title}
          onSeeAll={showMore ? () => router.push('/song-history') : undefined}
        />

        <FlatList
          data={recommendations}
          keyExtractor={(item, index) => item?.id || index.toString()}
          renderItem={({ item }) => (
            <View style={{ marginRight: 14 }}>
              <NewSongCard song={item} width={144} />
            </View>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className='pb-2'
          getItemLayout={(_, index) => ({ length: 158, offset: 158 * index, index })}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews
        />
      </View>
    );
  }
);

export const TrendingSongs = memo(({ songs, title }: { songs: Song[]; title: string }) => {
  if (!songs?.length) return null;

  return (
    <View style={{ marginBottom: 28 }}>
      <SectionTitle title={title} />
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginRight: 14 }}>
            <NewSongCard song={item} width={144} />
          </View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        getItemLayout={(_, index) => ({ length: 158, offset: 158 * index, index })}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});

export const ArtistGrid = memo(({ artists, title }: ArtistGridProps) => {
  if (!artists?.length) return null;

  return (
    <View style={{ marginBottom: 28 }}>
      <SectionTitle title={title} />
      <FlatList
        data={artists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ marginRight: 14 }}>
            <ArtistCard artist={item} width={124} />
          </View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        getItemLayout={(_, index) => ({ length: 138, offset: 138 * index, index })}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
});
