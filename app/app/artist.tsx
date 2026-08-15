import { AlbumCard, ArtistCard, PlaylistCard, SongCard } from "@/components/music/MusicCards"
import { Tabs, TabItem } from "@/components/ui/tabs"
import { SONG_URL } from "@/constants"
import { useTheme } from "@/context/ThemeContext"
import { usePlayerControls } from "@/stores/playerStore"
import { Album, Artist, ArtistDetails, Playlist } from "@/types/music"
import { Song } from "@/types/song"
import {
  convertToHttps,
  ensureHttpsForAlbumUrls,
  ensureHttpsForArtistUrls,
  ensureHttpsForPlaylistUrls,
  ensureHttpsForSongUrls,
} from "@/utils/getHttpsUrls"
import { Ionicons } from "@expo/vector-icons"
import axios from "axios"
import { LinearGradient } from "expo-linear-gradient"
import { router, useLocalSearchParams } from "expo-router"
import { Disc3, ListMusic, Music2, Users } from "lucide-react-native"
import React, { memo, useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type ArtistTab = "songs" | "albums" | "playlists" | "similar"

function formatCount(count: number | string | undefined | null): string {
  if (count === undefined || count === null || count === "") return "N/A"
  const numericCount = typeof count === "string" ? parseFloat(count) : count
  if (Number.isNaN(numericCount)) return count.toString()

  if (numericCount >= 1_000_000_000) {
    return (numericCount / 1_000_000_000).toFixed(1) + "B"
  }
  if (numericCount >= 1_000_000) {
    return (numericCount / 1_000_000).toFixed(1) + "M"
  }
  if (numericCount >= 1_000) {
    return (numericCount / 1_000).toFixed(1) + "K"
  }
  return numericCount.toString()
}

export default function ArtistScreen() {
  const insets = useSafeAreaInsets()
  const { colors, theme } = useTheme()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { width } = useWindowDimensions()
  const { addToPlaylist, playSong } = usePlayerControls()

  const [artistData, setArtistData] = useState<ArtistDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ArtistTab>("songs")

  const scrollY = useSharedValue(0)
  const playScale = useSharedValue(1)
  const shuffleScale = useSharedValue(1)

  const fetchArtistData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const response = await axios.get(`${SONG_URL}/artist?id=${id}`)
      const data = response.data?.data as ArtistDetails
      setArtistData(data)
    } catch (error) {
      console.error("Error fetching artist data:", error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchArtistData()
      setActiveTab("songs")
    }
  }, [id, fetchArtistData])

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  const imageSize = useMemo(() => Math.min(width * 0.42, 168), [width])

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 150], [1, 0], Extrapolation.CLAMP)
    const scale = interpolate(scrollY.value, [0, 150], [1, 0.9], Extrapolation.CLAMP)
    return {
      opacity,
      transform: [{ scale }],
    }
  })

  const topTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [100, 160], [0, 1], Extrapolation.CLAMP)
    return { opacity }
  })

  const playBtnAnim = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }))

  const shuffleBtnAnim = useAnimatedStyle(() => ({
    transform: [{ scale: shuffleScale.value }],
  }))

  const bgUrl = useMemo(() => {
    if (!artistData?.image) return ""
    if (Array.isArray(artistData.image)) {
      return (
        artistData.image[2]?.link ||
        artistData.image[1]?.link ||
        artistData.image[0]?.link ||
        ""
      )
    }
    return artistData.image
  }, [artistData?.image])

  const coverUrl = useMemo(() => convertToHttps(bgUrl || ""), [bgUrl])

  const metaText = useMemo(() => {
    const parts: string[] = []
    if (artistData?.list_count) parts.push(`${artistData.list_count} songs`)
    if (artistData?.follower_count) {
      parts.push(`${formatCount(artistData.follower_count)} followers`)
    }
    return parts.join("  •  ")
  }, [artistData?.list_count, artistData?.follower_count])

  const newSongs: Song[] = useMemo(() => {
    if (!artistData?.top_songs) return []
    return artistData.top_songs.map(ensureHttpsForSongUrls)
  }, [artistData?.top_songs])

  const securedAlbums: Album[] = useMemo(() => {
    if (!artistData?.top_albums) return []
    return artistData.top_albums.map(ensureHttpsForAlbumUrls)
  }, [artistData?.top_albums])

  const securedPlaylists: Playlist[] = useMemo(() => {
    if (!artistData?.dedicated_artist_playlist) return []
    return artistData.dedicated_artist_playlist.map(ensureHttpsForPlaylistUrls)
  }, [artistData?.dedicated_artist_playlist])

  const securedSimilar: Artist[] = useMemo(() => {
    if (!artistData?.similar_artists) return []
    return artistData.similar_artists.map(ensureHttpsForArtistUrls)
  }, [artistData?.similar_artists])

  const availableTabs = useMemo(() => {
    const tabs: TabItem<ArtistTab>[] = [
      {
        id: "songs",
        label: "Songs",
        count: newSongs.length || undefined,
        icon: ({ size, color }) => <Music2 size={size} color={color} />,
      },
    ]

    if (securedAlbums.length > 0) {
      tabs.push({
        id: "albums",
        label: "Albums",
        count: securedAlbums.length,
        icon: ({ size, color }) => <Disc3 size={size} color={color} />,
      })
    }

    if (securedPlaylists.length > 0) {
      tabs.push({
        id: "playlists",
        label: "Playlists",
        count: securedPlaylists.length,
        icon: ({ size, color }) => <ListMusic size={size} color={color} />,
      })
    }

    if (securedSimilar.length > 0) {
      tabs.push({
        id: "similar",
        label: "Similar",
        count: securedSimilar.length,
        icon: ({ size, color }) => <Users size={size} color={color} />,
      })
    }

    return tabs
  }, [newSongs.length, securedAlbums.length, securedPlaylists.length, securedSimilar.length])

  const handlePlayAll = useCallback(() => {
    if (newSongs.length > 0) {
      const songsWithPlaylistInfo = newSongs.map((song) => ({
        ...song,
        isPlaylist: true,
        playlistId: artistData?.id,
      }))
      addToPlaylist(songsWithPlaylistInfo)
      playSong(songsWithPlaylistInfo[0])
    }
  }, [newSongs, artistData?.id, addToPlaylist, playSong])

  const handleShuffle = useCallback(() => {
    if (newSongs.length > 0) {
      const shuffledSongs = [...newSongs]
        .sort(() => Math.random() - 0.5)
        .map((song) => ({
          ...song,
          isPlaylist: true,
          playlistId: artistData?.id,
        }))
      addToPlaylist(shuffledSongs)
      playSong(shuffledSongs[0])
    }
  }, [newSongs, artistData?.id, addToPlaylist, playSong])

  const isDark = theme === "dark"

  const renderSongsItem = useCallback(({ item }: { item: Song }) => (
    <View style={styles.songItemWrapper}>
      <SongCard song={item} />
    </View>
  ), [])

  const renderAlbumItem = useCallback(({ item }: { item: Album }) => (
    <View style={styles.gridItem}>
      <AlbumCard album={item} />
    </View>
  ), [])

  const renderPlaylistItem = useCallback(({ item }: { item: Playlist }) => (
    <View style={styles.gridItem}>
      <PlaylistCard playlist={item} isUser={false} />
    </View>
  ), [])

  const renderSimilarItem = useCallback(({ item }: { item: Artist }) => (
    <View style={styles.gridItem}>
      <ArtistCard artist={item} />
    </View>
  ), [])

  const renderEmptyState = useCallback(() => (
    <View style={styles.tabEmptyContainer}>
      <Text style={[styles.tabEmptyText, { color: colors.mutedForeground }]}>
        {activeTab === "songs" && "No songs available"}
        {activeTab === "albums" && "No albums available"}
        {activeTab === "playlists" && "No dedicated playlists available"}
        {activeTab === "similar" && "No similar artists found"}
      </Text>
    </View>
  ), [activeTab, colors.mutedForeground])

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!artistData) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Music2 size={80} color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.foreground }]}>No artist data available</Text>
        <Pressable
          onPress={fetchArtistData}
          style={[styles.primaryButton, { backgroundColor: colors.primary, width: 140 }]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  const listHeader = (
    <View style={styles.headerWrapper}>
      <Animated.View style={[styles.heroContent, heroAnimatedStyle]}>
        <View style={styles.artistAvatarShadow}>
          <Image
            source={{ uri: coverUrl || "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp" }}
            style={[
              styles.artistImage,
              {
                width: imageSize,
                height: imageSize,
                borderRadius: imageSize / 2,
                borderWidth: 2,
                borderColor: colors.border + "40",
              },
            ]}
            resizeMode="cover"
          />
        </View>

        <Text style={[styles.artistName, { color: colors.foreground }]} numberOfLines={2}>
          {artistData.name}
        </Text>

        {artistData.header_desc ? (
          <Text style={[styles.headerDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {artistData.header_desc}
          </Text>
        ) : null}

        {metaText ? (
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {metaText}
          </Text>
        ) : null}
      </Animated.View>

      {/* Action Bar */}
      <View style={styles.actionsContainer}>
        <Pressable
          onPress={handlePlayAll}
          disabled={!newSongs.length}
          onPressIn={() => (playScale.value = withTiming(0.96, { duration: 60 }))}
          onPressOut={() => (playScale.value = withSpring(1, { damping: 16, stiffness: 350 }))}
          style={{ flex: 1 }}
        >
          <Animated.View
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary },
              playBtnAnim,
            ]}
          >
            <Ionicons name="play" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
              Play All
            </Text>
          </Animated.View>
        </Pressable>

        <Pressable
          onPress={handleShuffle}
          disabled={!newSongs.length}
          onPressIn={() => (shuffleScale.value = withTiming(0.96, { duration: 60 }))}
          onPressOut={() => (shuffleScale.value = withSpring(1, { damping: 16, stiffness: 350 }))}
          style={{ flex: 1 }}
        >
          <Animated.View
            style={[
              styles.secondaryButton,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
              },
              shuffleBtnAnim,
            ]}
          >
            <Ionicons name="shuffle" size={18} color={colors.foreground} />
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Shuffle
            </Text>
          </Animated.View>
        </Pressable>
      </View>

      {/* Reusable Themed Tabs */}
      <View style={styles.tabsSection}>
        <Tabs<ArtistTab>
          tabs={availableTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          variant="pills"
          size="md"
        />
      </View>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Edge-to-Edge Ambient Background */}
      {coverUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={styles.heroBackgroundImage}
          blurRadius={60}
        />
      ) : null}
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.15)",
          isDark ? "rgba(11,11,12,0.85)" : "rgba(245,245,247,0.92)",
          colors.background,
        ]}
        style={styles.backdropGradient}
      />

      {/* Floating Top Nav Bar */}
      <View style={[styles.topNavBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)" },
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <Animated.Text
          style={[styles.topNavTitle, { color: colors.foreground }, topTitleAnimatedStyle]}
          numberOfLines={1}
        >
          {artistData.name}
        </Animated.Text>

        <View style={{ width: 36 }} />
      </View>

      {/* Tab-based Virtualized Content */}
      {activeTab === "songs" && (
        <Animated.FlatList
          key="songs"
          data={newSongs}
          renderItem={renderSongsItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {activeTab === "albums" && (
        <Animated.FlatList
          key="albums"
          data={securedAlbums}
          renderItem={renderAlbumItem}
          keyExtractor={(item) => item.album_id || item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {activeTab === "playlists" && (
        <Animated.FlatList
          key="playlists"
          data={securedPlaylists}
          renderItem={renderPlaylistItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {activeTab === "similar" && (
        <Animated.FlatList
          key="similar"
          data={securedSimilar}
          renderItem={renderSimilarItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 16,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
  },
  topNavBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
    maxWidth: "70%",
  },
  headerWrapper: {
    paddingTop: 8,
    marginBottom: 8,
  },
  heroBackgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    opacity: 0.45,
  },
  backdropGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 10,
  },
  artistAvatarShadow: {
    borderRadius: 100,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    marginBottom: 14,
  },
  artistImage: {},
  artistName: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  headerDesc: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: -0.1,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: -0.1,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 23,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14.5,
    fontWeight: "600",
  },
  tabsSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  songItemWrapper: {
    paddingHorizontal: 12,
  },
  gridRow: {
    gap: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  gridItem: {
    flex: 1,
    maxWidth: "48%",
  },
  tabEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  tabEmptyText: {
    fontSize: 14.5,
    fontWeight: "500",
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 130,
  },
})
