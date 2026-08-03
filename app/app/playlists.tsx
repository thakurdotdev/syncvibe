import { SongCard } from "@/components/music/MusicCards"
import { SONG_URL } from "@/constants"
import { usePlayerControls } from "@/stores/playerStore"
import { useTheme } from "@/context/ThemeContext"
import { Song } from "@/types/song"
import { convertToHttps, ensureHttpsForSongUrls } from "@/utils/getHttpsUrls"
import { Ionicons } from "@expo/vector-icons"
import axios from "axios"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams, router } from "expo-router"
import { useCallback, useEffect, useMemo, useState } from "react"
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
  withTiming,
  withSpring,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface PlaylistData {
  id: string
  name: string
  header_desc: string
  image: string
  list_count: number
  follower_count: number
  songs: Song[]
}

export default function PlaylistScreen() {
  const insets = useSafeAreaInsets()
  const { colors, theme } = useTheme()
  const { id } = useLocalSearchParams()
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null)
  const { addToPlaylist, playSong } = usePlayerControls()
  const [loading, setLoading] = useState(true)
  const { width } = useWindowDimensions()
  const scrollY = useSharedValue(0)

  const playScale = useSharedValue(1)
  const shuffleScale = useSharedValue(1)

  const fetchPlaylistData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${SONG_URL}/playlist?id=${id}`)
      const data = response.data
      setPlaylistData(data.data)
    } catch (error) {
      console.error("Error fetching playlist data:", error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchPlaylistData()
    }
  }, [id, fetchPlaylistData])

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  const formatCount = useCallback((count: any) => {
    if (count === undefined || count === null) return "N/A"
    if (count >= 1000000000) return (count / 1000000000).toFixed(1) + "B"
    if (count >= 1000000) return (count / 1000000).toFixed(1) + "M"
    if (count >= 1000) return (count / 1000).toFixed(1) + "K"
    return count.toString()
  }, [])

  const imageSize = useMemo(() => Math.min(width * 0.45, 175), [width])

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

  const newSongs = useMemo(() => {
    if (!playlistData?.songs) return []
    return playlistData?.songs?.map(ensureHttpsForSongUrls) || []
  }, [playlistData?.songs])

  const handlePlayAll = () => {
    if (newSongs?.length) {
      const songsWithPlaylistInfo = newSongs.map((song) => ({
        ...song,
        isPlaylist: true,
        playlistId: playlistData?.id,
      }))
      addToPlaylist(songsWithPlaylistInfo)
      playSong(songsWithPlaylistInfo[0])
    }
  }

  const handleShuffle = () => {
    if (newSongs?.length) {
      const shuffledSongs = [...newSongs]
        .sort(() => Math.random() - 0.5)
        .map((song) => ({
          ...song,
          isPlaylist: true,
          playlistId: playlistData?.id,
        }))
      addToPlaylist(shuffledSongs)
      playSong(shuffledSongs[0])
    }
  }

  const isDark = theme === "dark"
  const coverUrl = convertToHttps(playlistData?.image || "")

  const metaText = useMemo(() => {
    const parts = []
    if (playlistData?.list_count) parts.push(`${playlistData.list_count} songs`)
    if (playlistData?.follower_count) parts.push(`${formatCount(playlistData.follower_count)} followers`)
    return parts.join("  •  ")
  }, [playlistData, formatCount])

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!playlistData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.foreground }]}>Playlist not found</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Edge-to-Edge Ambient Background */}
      <Image
        source={{ uri: coverUrl }}
        style={styles.heroBackgroundImage}
        blurRadius={60}
      />
      <LinearGradient
        colors={[
          "rgba(0,0,0,0.1)",
          isDark ? "rgba(11,11,12,0.85)" : "rgba(245,245,247,0.9)",
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
          {playlistData.name}
        </Animated.Text>

        <View style={{ width: 36 }} />
      </View>

      <Animated.FlatList
        data={newSongs}
        renderItem={({ item }) => <SongCard song={item} />}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        style={{ paddingHorizontal: 16 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <Animated.View style={[styles.heroContent, heroAnimatedStyle]}>
              <View style={styles.artworkShadow}>
                <Image
                  source={{ uri: coverUrl }}
                  style={[styles.playlistImage, { width: imageSize, height: imageSize }]}
                  resizeMode="cover"
                />
              </View>

              <Text style={[styles.playlistName, { color: colors.foreground }]} numberOfLines={2}>
                {playlistData?.name}
              </Text>

              {metaText ? (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {metaText}
                </Text>
              ) : null}
            </Animated.View>

            {/* Clean Action Bar */}
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
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
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

            {/* Songs Section Label */}
            <View style={styles.songsHeader}>
              <Text style={[styles.songsHeaderText, { color: colors.foreground }]}>Tracks</Text>
            </View>
          </View>
        }
      />
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
  loadingText: {
    fontSize: 15,
    fontWeight: "500",
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
    marginBottom: 12,
  },
  heroBackgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    opacity: 0.5,
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  artworkShadow: {
    borderRadius: 16,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    marginBottom: 16,
  },
  playlistImage: {
    borderRadius: 16,
  },
  playlistName: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.4,
    marginBottom: 8,
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
    marginVertical: 16,
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
  songsHeader: {
    marginTop: 4,
    marginBottom: 8,
  },
  songsHeaderText: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  listContent: {
    paddingBottom: 130,
  },
})
