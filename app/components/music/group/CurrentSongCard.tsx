import React, { useMemo } from "react"
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather, Ionicons } from "@expo/vector-icons"
import { CustomSlider } from "../MusicCards"
import Card from "@/components/ui/card"
import { useTheme } from "@/context/ThemeContext"
import { useGroupPlaybackStore } from "@/stores/groupMusic/groupPlaybackStore"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { ReactionBar } from "./ReactionBar"
import { MemberAvatarStack } from "./MemberAvatarStack"

interface CurrentSongCardProps {
  onChooseSong: () => void
  onPlayPause: () => void
  onSeek: (value: number) => void
  onSkip: () => void
}

const GroupProgressBar = React.memo(({ onSeek }: { onSeek: (v: number) => void }) => {
  const currentTime = useGroupPlaybackStore((s) => s.currentTime)
  const duration = useGroupPlaybackStore((s) => s.duration)
  const formatTime = useGroupPlaybackStore((s) => s.formatTime)
  const { colors } = useTheme()

  return (
    <View style={styles.progressContainer}>
      <View style={styles.sliderWrapper}>
        <CustomSlider
          value={currentTime}
          maxValue={duration || 1}
          onSeek={onSeek}
          trackColor={colors.primary}
          inactiveTrackColor={colors.mutedForeground + "30"}
          thumbSize={12}
          trackHeight={3}
        />
      </View>
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
          {formatTime(currentTime)}
        </Text>
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  )
})

export const CurrentSongCard: React.FC<CurrentSongCardProps> = ({
  onChooseSong,
  onPlayPause,
  onSeek,
  onSkip,
}) => {
  const { colors } = useTheme()

  const currentSong = useGroupPlaybackStore((s) => s.currentSong)
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying)
  const isLoading = useGroupPlaybackStore((s) => s.isLoading)

  const queue = useGroupSessionStore((s) => s.queue)
  const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex)

  const currentQueueItem = useMemo(
    () => (currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null),
    [queue, currentQueueIndex]
  )

  const addedBy = currentQueueItem?.addedBy
  const artist = currentSong?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

  if (!currentSong) {
    return (
      <Card variant="default" style={styles.card}>
        <TouchableOpacity
          onPress={onChooseSong}
          style={styles.emptyState}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Choose a song for the group"
        >
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.accent }]}>
            <Feather name="music" size={23} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Pick the first track
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Search for a song and it will play for everyone here.
          </Text>
          <View style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
            <Feather name="search" size={15} color={colors.primaryForeground} />
            <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>
              Browse music
            </Text>
          </View>
        </TouchableOpacity>
      </Card>
    )
  }

  return (
    <Card variant="default" style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>NOW PLAYING</Text>
        <View style={[styles.syncBadge, { backgroundColor: colors.accent }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.syncText, { color: colors.primary }]}>In sync</Text>
        </View>
      </View>
      <View style={styles.songRow}>
        <Image
          source={{ uri: currentSong.image?.[2]?.link || currentSong.image?.[1]?.link }}
          style={[styles.albumArt, { backgroundColor: colors.secondary }]}
        />
        <View style={styles.songInfo}>
          <Text style={[styles.songName, { color: colors.foreground }]} numberOfLines={2}>
            {currentSong.name}
          </Text>
          <Text style={[styles.artistName, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
          {addedBy && (
            <View style={styles.addedByRow}>
              {addedBy.profilePic ? (
                <Image source={{ uri: String(addedBy.profilePic) }} style={styles.addedByAvatar} />
              ) : null}
              <Text style={[styles.addedByText, { color: colors.mutedForeground }]}>
                Added by {addedBy.userName}
              </Text>
            </View>
          )}
        </View>
      </View>

      <GroupProgressBar onSeek={onSeek} />

      <View style={styles.controlsRow}>
        <MemberAvatarStack />
        <View style={styles.playbackControls}>
          <TouchableOpacity
            onPress={onPlayPause}
            disabled={isLoading}
            style={[styles.playButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause for the group" : "Play for the group"}
          >
            {isLoading ? (
              <Feather name="loader" size={22} color={colors.primaryForeground} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={23}
                color={colors.primaryForeground}
                style={!isPlaying ? { marginLeft: 2 } : undefined}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSkip}
            disabled={isLoading}
            style={[styles.skipButton, { backgroundColor: colors.secondary }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip song"
          >
            <Ionicons name="play-skip-forward" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.reactionsRow}>
        <ReactionBar />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontWeight: "600",
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 18,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 14,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  albumArt: {
    width: 76,
    height: 76,
    borderRadius: 14,
  },
  songInfo: {
    marginLeft: 14,
    flex: 1,
  },
  songName: {
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 21,
  },
  artistName: {
    fontSize: 13,
    marginTop: 2,
  },
  addedByRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  addedByAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  addedByText: {
    fontSize: 11,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  sliderWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: -4,
  },
  timeText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  playbackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
})
