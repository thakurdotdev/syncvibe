import { useGroupMusic } from "@/context/GroupMusicContext"
import { useTheme } from "@/context/ThemeContext"
import {
  usePlayerControls,
  useRepeatMode,
  usePlaybackState,
  useSongPlaybackState,
  useShuffleMode
} from "@/stores/playerStore"
import { Song } from "@/types/song"
import {
  ensureHttpsForAlbumUrls,
  ensureHttpsForArtistUrls,
  ensureHttpsForPlaylistUrls,
  ensureHttpsForSongUrls,
} from "@/utils/getHttpsUrls"
import { Ionicons } from "@expo/vector-icons"
import TrackPlayer, { useProgress } from "@rntp/player"
import { router } from "expo-router"
import { Repeat, Repeat1, Shuffle, SkipBackIcon, SkipForwardIcon } from "lucide-react-native"
import { memo, default as React, useCallback, useMemo, useState } from "react"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import NewPlayerDrawer from "./NewPlayerDrawer"

interface SongCardProps {
  song: Song
  onPress?: () => void | Promise<void>
}

interface AlbumCardProps {
  album: any
  onPress?: () => void | Promise<void>
  onLongPress?: () => void | Promise<void>
}

interface PlaylistCardProps {
  playlist: any
  isUser?: boolean
  onPress?: () => void | Promise<void>
  onLongPress?: () => void | Promise<void>
}

interface ImageType {
  link: string
}

interface ArtistCardProps {
  artist: { id: string; name: string; image: ImageType[] }
  onPress?: () => void | Promise<void>
  onLongPress?: () => void | Promise<void>
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}

interface CustomSliderProps {
  value: number
  maxValue: number
  onSeek: (value: number) => void
  trackColor?: string
  inactiveTrackColor?: string
  thumbSize?: number
  trackHeight?: number
}

export const CustomSlider = ({
  value,
  maxValue,
  onSeek,
  trackColor = "#fff",
  inactiveTrackColor = "rgba(255, 255, 255, 0.2)",
  thumbSize = 14,
  trackHeight = 4,
}: CustomSliderProps) => {
  const [sliderWidth, setSliderWidth] = useState(0)
  const isDragging = useSharedValue(false)
  const dragX = useSharedValue(0)

  const progressPercent = maxValue > 0 ? value / maxValue : 0

  const animatedStyle = useAnimatedStyle(() => {
    if (isDragging.value) {
      return {
        width: `${clamp(dragX.value * 100, 0, 100)}%`,
      }
    }
    return {
      width: `${progressPercent * 100}%`,
    }
  })

  const thumbStyle = useAnimatedStyle(() => {
    const leftPercent = isDragging.value ? dragX.value : progressPercent
    return {
      left: `${clamp(leftPercent * 100, 0, 100)}%`,
      transform: [
        { translateX: -thumbSize / 2 },
        { scale: isDragging.value ? withSpring(1.2) : withSpring(1) },
      ],
    }
  })

  const gesture = Gesture.Pan()
    .onStart((event) => {
      isDragging.value = true
      dragX.value = event.x / (sliderWidth || 1)
    })
    .onChange((event) => {
      dragX.value = event.x / (sliderWidth || 1)
    })
    .onEnd(() => {
      const finalValue = clamp(dragX.value * maxValue, 0, maxValue)
      scheduleOnRN(onSeek, finalValue)
      isDragging.value = false
    })

  const tapGesture = Gesture.Tap().onEnd((event) => {
    const finalValue = clamp((event.x / (sliderWidth || 1)) * maxValue, 0, maxValue)
    scheduleOnRN(onSeek, finalValue)
  })

  const composedGesture = Gesture.Exclusive(gesture, tapGesture)

  return (
    <GestureDetector gesture={composedGesture}>
      <View
        style={{
          width: "100%",
          height: 40,
          justifyContent: "center",
        }}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
      >
        <View
          style={{
            height: trackHeight,
            backgroundColor: inactiveTrackColor,
            borderRadius: trackHeight / 2,
            width: "100%",
            position: "relative",
          }}
        >
          <Animated.View
            style={[
              {
                height: "100%",
                backgroundColor: trackColor,
                borderRadius: trackHeight / 2,
              },
              animatedStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                position: "absolute",
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                backgroundColor: trackColor,
                top: (trackHeight - thumbSize) / 2,
              },
              thumbStyle,
            ]}
          />
        </View>
      </View>
    </GestureDetector>
  )
}

interface CardContainerProps {
  children: React.ReactNode
  onPress: () => void | Promise<void>
  onLongPress?: () => void | Promise<void>
  width?: number | `${number}%`
  style?: any
}

export const CardContainer = memo(
  ({ children, onPress, onLongPress, width = 160, style }: CardContainerProps) => {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [{ width, opacity: pressed ? 0.82 : 1 }, style]}
      >
        {children}
      </Pressable>
    )
  },
)

export const SongCard = memo(
  ({
    song,
    disableOnLongPress = false,
    onPress: onPressCallback,
  }: SongCardProps & { disableOnLongPress?: boolean }) => {
    const { playSong, handlePlayPause } = usePlayerControls()
    const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id)
    const { colors } = useTheme()

    const securedSong = useMemo(() => ensureHttpsForSongUrls(song), [song])
    const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false)

    const handlePress = useCallback(async () => {
      if (onPressCallback) {
        await onPressCallback()
      }

      if (isCurrentSong) {
        handlePlayPause()
      } else {
        playSong(securedSong)
      }
    }, [isCurrentSong, securedSong, playSong, handlePlayPause, onPressCallback])

    const handleLongPress = useCallback(() => {
      setPlayerDrawerOpen(true)
    }, [])

    return (
      <Animated.View>
        <Pressable
          onPress={handlePress}
          onLongPress={disableOnLongPress ? undefined : handleLongPress}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              padding: 8,
              borderRadius: 14,
              height: 64,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              overflow: "hidden",
              backgroundColor: colors.muted,
            }}
          >
            <Image
              source={{
                uri: securedSong.image[1]?.link || securedSong.image[0]?.link,
                cache: "force-cache",
              }}
              style={{ width: "100%", height: "100%" }}
              alt="Song cover"
              fadeDuration={0}
              resizeMode="cover"
            />
            {isCurrentSong && (
              <View
                style={{
                  ...StyleSheet.absoluteFill,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
              </View>
            )}
          </View>

          <View style={{ flex: 1, paddingHorizontal: 12, justifyContent: "center" }}>
            <Text
              style={{
                color: isCurrentSong ? colors.primary : colors.text,
                fontWeight: "700",
                fontSize: 15,
              }}
              numberOfLines={1}
            >
              {securedSong.name}
            </Text>
            <Text
              style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}
              numberOfLines={1}
            >
              {securedSong.subtitle || securedSong.artist_map?.artists?.[0]?.name}
            </Text>
          </View>

          <View style={{ paddingRight: 8, justifyContent: "center" }}>
            <Ionicons
              name={isCurrentSong ? (isPlaying ? "pause-circle" : "play-circle") : "play-outline"}
              size={20}
              color={isCurrentSong ? colors.primary : colors.mutedForeground}
            />
          </View>
        </Pressable>

        {playerDrawerOpen && (
          <NewPlayerDrawer
            isVisible={true}
            onClose={() => setPlayerDrawerOpen(false)}
            song={securedSong}
          />
        )}
      </Animated.View>
    )
  },
)

export const CardImage = ({ uri, alt }: { uri: string; alt: string }) => {
  const fallback =
    "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp"
  const sourceUri = uri && typeof uri === "string" && uri.trim() !== "" ? uri : fallback

  return (
    <View
      style={{
        width: "100%",
        height: 140,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.05)",
      }}
    >
      <Image
        source={{ uri: sourceUri, cache: "force-cache" }}
        style={{
          width: "100%",
          height: 140,
          borderRadius: 14,
        }}
        resizeMode="cover"
        alt={alt}
      />
    </View>
  )
}

export const AlbumCard = memo(
  ({ album, onPress: customOnPress, onLongPress }: AlbumCardProps) => {
    const { colors } = useTheme()
    const handlePress = useCallback(() => {
      if (customOnPress) {
        customOnPress()
      } else {
        router.push({
          pathname: "/albums",
          params: { id: album.album_id || album?.id },
        })
      }
    }, [album?.album_id || album?.id, customOnPress])

    if (!album) return null

    const securedAlbum = useMemo(() => ensureHttpsForAlbumUrls(album), [album])
    const name = securedAlbum.name || securedAlbum.title || ""
    const subtitle = securedAlbum.artist || securedAlbum.subtitle || "Album"
    const imageUrl =
      securedAlbum.image?.[2]?.link || securedAlbum.image?.[2]?.url || securedAlbum.image?.[1]?.link

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={152} style={{ marginRight: 14 }}>
      <View style={{ gap: 10 }}>
        <View style={{ position: "relative", width: 140, height: 140 }}>
          {/* Vinyl Disc poking out */}
          <View
            style={{
              position: "absolute",
              top: 8,
              right: -10,
              width: 124,
              height: 124,
              borderRadius: 62,
              backgroundColor: "#121212",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              justifyContent: "center",
              alignItems: "center",
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                borderWidth: 4,
                borderColor: "#181818",
              }}
            />
          </View>

          {/* Album Cover */}
          <View
            style={{
              width: 136,
              height: 136,
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: colors.muted,
              elevation: 5,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
            }}
          >
            <Image
              source={{ uri: imageUrl || "https://via.placeholder.com/136", cache: "force-cache" }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              alt={`Album: ${name}`}
            />
          </View>
        </View>

        <View style={{ gap: 2, paddingHorizontal: 2 }}>
          <Text
            style={{
              color: colors.text,
              fontWeight: "700",
              fontSize: 14,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 12,
              fontWeight: "500",
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </CardContainer>
  )
})

export const PlaylistCard = memo(
  ({ playlist, isUser = false, onPress: customOnPress, onLongPress }: PlaylistCardProps) => {
    const { colors } = useTheme()
    const handlePress = useCallback(() => {
      if (customOnPress) {
        customOnPress()
      } else {
        router.push({
          pathname: isUser ? "/user-playlist" : "/playlists",
          params: { id: playlist.id },
        })
      }
    }, [playlist?.id, isUser, customOnPress])

    if (!playlist?.name || !playlist?.image) return null

    const securedPlaylist = useMemo(() => ensureHttpsForPlaylistUrls(playlist), [playlist])
    const subtitle = securedPlaylist.subtitle || securedPlaylist.description || "Playlist"
    const imageUrl = Array.isArray(securedPlaylist.image)
      ? securedPlaylist.image[2]?.link || securedPlaylist.image[1]?.link
      : securedPlaylist.image

    if (isUser) {
      return (
        <CardContainer
          onPress={handlePress}
          onLongPress={onLongPress}
          width="100%"
          style={{ marginBottom: 10 }}
        >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 10,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border + "40",
            gap: 14,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: colors.muted,
            }}
          >
            <Image
              source={{ uri: imageUrl, cache: "force-cache" }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              alt={`Playlist: ${securedPlaylist.name}`}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}
              numberOfLines={1}
            >
              {securedPlaylist.name}
            </Text>
            <Text
              style={{ color: colors.mutedForeground, fontSize: 13 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </View>
      </CardContainer>
    )
  }

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={152} style={{ marginRight: 14 }}>
      <View style={{ gap: 10 }}>
        <View style={{ position: "relative", width: 144, height: 144 }}>
          {/* Offset Stacked Back Card */}
          <View
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              right: -6,
              bottom: -6,
              borderRadius: 16,
              backgroundColor: colors.primary + "30",
              borderWidth: 1,
              borderColor: colors.border + "30",
            }}
          />

          {/* Main Cover */}
          <View
            style={{
              width: 144,
              height: 144,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: colors.muted,
              elevation: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
            }}
          >
            <Image
              source={{ uri: imageUrl, cache: "force-cache" }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              alt={`Playlist: ${securedPlaylist.name}`}
            />
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "rgba(0,0,0,0.65)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                }}
              >
                MIX
              </Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 2, paddingHorizontal: 2 }}>
          <Text
            style={{
              color: colors.text,
              fontWeight: "700",
              fontSize: 14,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {securedPlaylist.name}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 12,
              fontWeight: "500",
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </CardContainer>
  )
})

export const NewSongCard = memo(({ song }: SongCardProps) => {
  if (!song.id) return null
  const { playSong, handlePlayPause } = usePlayerControls()
  const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id)
  const { colors } = useTheme()
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false)

  const securedSong = useMemo(() => ensureHttpsForSongUrls(song), [song])
  const imageUrl = securedSong.image?.[2]?.link || securedSong.image?.[1]?.link
  const artistName =
    securedSong.subtitle || securedSong.artist_map?.artists?.[0]?.name || "Unknown Artist"

  const handlePress = () => {
    if (isCurrentSong) {
      handlePlayPause()
    } else {
      playSong(securedSong)
    }
  }

  const handleLongPress = () => {
    setPlayerDrawerOpen(true)
  }

  return (
    <>
      <CardContainer
        width={144}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={{ marginRight: 14 }}
      >
        <View style={{ gap: 8 }}>
          <View
            style={{
              width: 144,
              height: 144,
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: colors.muted,
              position: "relative",
              elevation: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.15,
              shadowRadius: 5,
            }}
          >
            <Image
              source={{ uri: imageUrl, cache: "force-cache" }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              alt={`Song: ${securedSong.name}`}
            />

            {/* Active Playing Overlay */}
            {isCurrentSong && (
              <View
                style={{
                  ...StyleSheet.absoluteFill,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={22}
                    color={colors.primaryForeground}
                    style={isPlaying ? undefined : { marginLeft: 2 }}
                  />
                </View>
              </View>
            )}
          </View>

          <View style={{ gap: 2, paddingHorizontal: 2 }}>
            <Text
              style={{
                color: isCurrentSong ? colors.primary : colors.text,
                fontWeight: "700",
                fontSize: 14,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {securedSong.name}
            </Text>
            <Text
              style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: "500" }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {artistName}
            </Text>
          </View>
        </View>
      </CardContainer>

      {playerDrawerOpen && (
        <NewPlayerDrawer
          isVisible={playerDrawerOpen}
          onClose={() => setPlayerDrawerOpen(false)}
          song={securedSong}
        />
      )}
    </>
  )
})

export const ArtistCard = memo(
  ({ artist, onPress: customOnPress, onLongPress }: ArtistCardProps) => {
    const { colors } = useTheme()

    if (!artist?.name || !artist?.image) return null

    const securedArtist = useMemo(() => ensureHttpsForArtistUrls(artist), [artist])
    const imageUrl = useMemo(
      () =>
        Array.isArray(securedArtist.image)
          ? securedArtist.image[2]?.link || securedArtist.image[1]?.link
          : securedArtist.image,
      [securedArtist.image],
    )

    const handlePress = useCallback(() => {
      if (customOnPress) {
        customOnPress()
      } else {
        router.push({
          pathname: "/artist",
          params: { id: securedArtist.id },
        })
      }
    }, [securedArtist?.id, customOnPress])

    return (
      <CardContainer onPress={handlePress} onLongPress={onLongPress} width={136} style={{ marginRight: 12 }}>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 4 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: colors.border + "60",
            backgroundColor: colors.muted + "40",
            elevation: 4,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
          }}
        >
          <Image
            source={{ uri: imageUrl || "https://via.placeholder.com/120", cache: "force-cache" }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
            alt={`Artist: ${securedArtist.name}`}
          />
        </View>

        <View style={{ alignItems: "center", width: "100%", paddingHorizontal: 4 }}>
          <Text
            style={{
              color: colors.text,
              fontWeight: "700",
              fontSize: 14,
              textAlign: "center",
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {securedArtist.name}
          </Text>
          <View
            style={{
              marginTop: 4,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              backgroundColor: colors.primary + "15",
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 10,
                fontWeight: "600",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Artist
            </Text>
          </View>
        </View>
      </View>
    </CardContainer>
  )
})

export const SongControls = memo(() => {
  const { handleNextSong, handlePrevSong, handlePlayPause: triggerPlayPause } = usePlayerControls()
  const { shuffleMode, toggleShuffle } = useShuffleMode()
  const { repeatMode, toggleRepeat } = useRepeatMode()
  const { isPlaying } = usePlaybackState()
  const { position, duration } = useProgress(0.25)
  const { colors } = useTheme()

  const handlePlayPause = () => {
    triggerPlayPause()
  }

  const handleSeek = async (value: number) => {
    await TrackPlayer.seekTo(value)
  }

  const handleShuffle = () => {
    toggleShuffle()
  }

  const handleRepeat = () => {
    toggleRepeat()
  }

  const getRepeatIcon = () => {
    if (repeatMode === "one") return Repeat1
    return Repeat
  }

  const RepeatIcon = getRepeatIcon()

  return (
    <View style={songControlStyles.container}>
      <View style={songControlStyles.sliderRow}>
        <CustomSlider
          value={position}
          maxValue={duration}
          onSeek={handleSeek}
          trackColor={colors.primary}
          inactiveTrackColor={colors.mutedForeground + "30"}
          thumbSize={14}
          trackHeight={4}
        />
      </View>
      <View style={songControlStyles.timeRow}>
        <Text style={[songControlStyles.timeText, { color: colors.mutedForeground }]}>
          {formatTime(position)}
        </Text>
        <Text style={[songControlStyles.timeText, { color: colors.mutedForeground }]}>
          -{formatTime(Math.max(0, duration - position))}
        </Text>
      </View>

      <View style={songControlStyles.controls}>
        <Pressable
          onPress={handleShuffle}
          style={({ pressed }) => [songControlStyles.sideControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Shuffle
            size={20}
            color={shuffleMode ? colors.primary : colors.mutedForeground}
            strokeWidth={shuffleMode ? 2.5 : 1.8}
          />
        </Pressable>

        <Pressable
          onPress={handlePrevSong}
          style={({ pressed }) => [songControlStyles.skipControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <SkipBackIcon size={26} color={colors.text} strokeWidth={1.8} />
        </Pressable>

          <Pressable
            style={({ pressed }) => [
              songControlStyles.playButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handlePlayPause}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={30}
              color={colors.primaryForeground}
              style={isPlaying ? undefined : { marginLeft: 3 }}
            />
          </Pressable>

        <Pressable
          onPress={() => handleNextSong()}
          style={({ pressed }) => [songControlStyles.skipControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <SkipForwardIcon size={26} color={colors.text} strokeWidth={1.8} />
        </Pressable>

        <Pressable
          onPress={handleRepeat}
          style={({ pressed }) => [songControlStyles.sideControl, { opacity: pressed ? 0.7 : 1 }]}
        >
          <RepeatIcon
            size={20}
            color={repeatMode !== "off" ? colors.primary : colors.mutedForeground}
            strokeWidth={repeatMode !== "off" ? 2.5 : 1.8}
          />
        </Pressable>
      </View>
    </View>
  )
})

const songControlStyles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderContainer: {
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: -4,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.3,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  sideControl: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  skipControl: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
})

export const ProgressBar = memo(() => {
  const { colors } = useTheme()
  const { position, duration } = useProgress()

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0

  return (
    <View
      style={{
        width: "100%",
        overflow: "hidden",
        borderRadius: 2,
        height: 3,
        backgroundColor: "transparent",
      }}
    >
      <View
        style={{
          height: "100%",
          width: `${Math.min(100, progressPercent)}%`,
          backgroundColor: colors.primary,
          borderRadius: 2,
        }}
      />
    </View>
  )
})

export const GroupSongControls = memo(() => {
  const { position, duration } = useProgress()
  const { handleSeek } = useGroupMusic()

  return (
    <View className="w-full py-4">
      <View className="flex-row items-center">
        <CustomSlider
          value={position}
          maxValue={duration}
          onSeek={handleSeek}
          trackColor="#fff"
          inactiveTrackColor="rgba(99, 102, 241, 0.2)"
          thumbSize={12}
          trackHeight={4}
        />
      </View>
      <View className="flex-row justify-between">
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  timeText: {
    fontSize: 12,
    color: "#6b7280",
    width: 40,
    textAlign: "center",
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderContainer: {
    borderRadius: 8,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 24,
  },
})
