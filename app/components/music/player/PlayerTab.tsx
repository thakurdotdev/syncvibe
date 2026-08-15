import { useTheme } from "@/context/ThemeContext"
import { usePlayerControls } from "@/stores/playerStore"
import { Song } from "@/types/song"
import { Ionicons } from "@expo/vector-icons"
import { memo } from "react"
import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { SongControls } from "../MusicCards"

interface PlayerTabProps {
  currentSong: Song | null
  artistName: string
  artworkSize: number
  nextSong: Song | null
}

export const PlayerTab = memo(function PlayerTab({
  currentSong,
  artistName,
  artworkSize,
  nextSong,
}: PlayerTabProps) {
  const { colors } = useTheme()
  const { handleNextSong } = usePlayerControls()
  const insets = useSafeAreaInsets()

  const artworkUri =
    currentSong?.image?.[2]?.link ||
    currentSong?.image?.[1]?.link ||
    currentSong?.image?.[0]?.link

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.artworkWrapper}>
          <View style={styles.artworkShadow}>
            <Image
              source={{ uri: artworkUri }}
              style={[styles.albumArt, { width: artworkSize, height: artworkSize }]}
              resizeMode="cover"
            />
          </View>
        </View>

        <View style={styles.songInfoContainer}>
          <Text
            style={[styles.songTitle, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {currentSong?.name}
          </Text>
          <Text
            style={[styles.artistName, { color: colors.mutedForeground }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {artistName}
          </Text>
        </View>

        <SongControls />
      </View>

      <View style={[styles.upNextWrapper, { bottom: Math.max(16, insets.bottom + 8) }]}>
        {nextSong ? (
          <Pressable
            style={[
              styles.upNextCard,
              {
                backgroundColor: colors.card + "60",
                borderColor: colors.border + "30",
              },
            ]}
            onPress={() => handleNextSong()}
          >
            <Image
              source={{
                uri:
                  nextSong.image?.[1]?.link ||
                  nextSong.image?.[0]?.link ||
                  nextSong.image?.[2]?.link,
              }}
              style={styles.upNextArt}
              resizeMode="cover"
            />
            <Text style={[styles.upNextText, { color: colors.text }]} numberOfLines={1}>
              Next: {nextSong.name}
            </Text>
            <Ionicons
              name="play-skip-forward"
              size={12}
              color={colors.text}
              style={styles.upNextIcon}
            />
          </Pressable>
        ) : (
          <View style={styles.endOfQueueCard}>
            <Ionicons
              name="musical-notes-outline"
              size={12}
              color={colors.mutedForeground}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.endOfQueueText, { color: colors.mutedForeground }]}>
              End of Queue
            </Text>
          </View>
        )}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  mainContent: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 40,
  },
  artworkWrapper: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  artworkShadow: {
    borderRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 10,
    shadowColor: "#000000",
  },
  albumArt: {
    borderRadius: 20,
  },
  songInfoContainer: {
    width: "100%",
    marginTop: 22,
    marginBottom: 6,
    paddingHorizontal: 24,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  artistName: {
    fontSize: 16,
    marginTop: 6,
    fontWeight: "500",
  },
  upNextWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  upNextCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
  upNextArt: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  upNextText: {
    fontSize: 12,
    fontWeight: "500",
    marginHorizontal: 8,
    maxWidth: 200,
  },
  upNextIcon: {
    opacity: 0.8,
  },
  endOfQueueCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    opacity: 0.4,
  },
  endOfQueueText: {
    fontSize: 11,
    fontWeight: "500",
  },
})
