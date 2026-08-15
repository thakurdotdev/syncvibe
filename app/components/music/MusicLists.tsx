import { useTheme } from "@/context/ThemeContext"
import { Album, Artist, Playlist } from "@/types/music"
import { Song } from "@/types/song"
import { router } from "expo-router"
import { ChevronRightIcon } from "lucide-react-native"
import { memo } from "react"
import {
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native"
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from "./MusicCards"

interface AlbumsGridProps {
  albums: Album[]
  title?: string
}

interface PlaylistsGridProps {
  playlists: Playlist[]
  title?: string
}

interface ArtistGridProps {
  artists: Artist[]
  title?: string
}

interface RecommendationGridProps {
  recommendations: Song[]
  title?: string
  showMore?: boolean
}


export const AlbumsGrid = memo(({ albums, title }: AlbumsGridProps) => {
  const { colors } = useTheme()
  if (!albums?.length) return null

  return (
    <View className="mb-6">
      {title && (
        <Text className="text-xl font-bold mb-2 px-4" style={{ color: colors.text }}>
          {title}
        </Text>
      )}
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
  )
})

export const PlaylistsGrid = memo(({ playlists, title }: PlaylistsGridProps) => {
  const { colors } = useTheme()
  if (!playlists?.length) return null

  return (
    <View className="mb-6">
      {title && (
        <Text className="text-xl font-bold mb-2 px-4" style={{ color: colors.text }}>
          {title}
        </Text>
      )}
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
  )
})

export const RecommendationGrid = memo(({
  recommendations,
  title,
  showMore = false,
}: RecommendationGridProps) => {
  const { colors } = useTheme()
  if (!recommendations?.length) return null

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-2 px-4">
        {title && (
          <Text className="text-xl font-bold" style={{ fontFamily: "System", color: colors.text }}>
            {title}
          </Text>
        )}
        {showMore && (
          <Pressable
            className="py-1"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/song-history")}
          >
            <ChevronRightIcon size={20} color={colors.text} />
          </Pressable>
        )}
      </View>

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
        className="pb-2"
        getItemLayout={(_, index) => ({ length: 158, offset: 158 * index, index })}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  )
})

export const TrendingSongs = memo(({ songs, title }: { songs: Song[]; title: string }) => {
  const { colors } = useTheme()
  if (!songs?.length) return null

  return (
    <View className="mb-6">
      {title && (
        <Text className="text-xl font-bold mb-2 px-4" style={{ color: colors.text }}>
          {title}
        </Text>
      )}
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
  )
})

export const ArtistGrid = memo(({ artists, title }: ArtistGridProps) => {
  const { colors } = useTheme()
  if (!artists?.length) return null

  return (
    <View className="mb-6">
      {title && (
        <Text className="text-xl font-bold mb-2 px-4" style={{ color: colors.text }}>
          {title}
        </Text>
      )}
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
  )
})
