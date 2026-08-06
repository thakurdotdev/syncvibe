import React, { useMemo } from "react"
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather, Ionicons } from "@expo/vector-icons"
import { CustomSlider } from "../MusicCards"
import { useTheme } from "@/context/ThemeContext"
import { useGroupPlaybackStore } from "@/stores/groupMusic/groupPlaybackStore"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { ReactionBar } from "./ReactionBar"
import { MemberAvatarStack } from "./MemberAvatarStack"

interface CurrentSongCardProps {
  onChooseSong: () => void
  onOpenQueue: () => void
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
  onOpenQueue,
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
    [queue, currentQueueIndex],
  )

  const upcomingQueue = useMemo(
    () => queue.filter((_, idx) => idx > currentQueueIndex),
    [queue, currentQueueIndex],
  )

  const nextSong = useMemo(() => upcomingQueue[0]?.song || null, [upcomingQueue])
  const addedBy = currentQueueItem?.addedBy
  const artist = currentSong?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"

  if (!currentSong) {
    return (
      <TouchableOpacity
        onPress={onChooseSong}
        style={[styles.card, { backgroundColor: colors.card }]}
        activeOpacity={0.7}
      >
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="music" size={24} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Choose a song to play
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Search for music to start the vibe
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.songRow}>
        <Image
          source={{ uri: currentSong.image?.[2]?.link || currentSong.image?.[1]?.link }}
          style={styles.albumArt}
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
                {addedBy.userName}
              </Text>
            </View>
          )}
        </View>
      </View>

      <GroupProgressBar onSeek={onSeek} />

      <View style={styles.controlsRow}>
        <View style={styles.playbackControls}>
          <TouchableOpacity
            onPress={onPlayPause}
            disabled={isLoading}
            style={[styles.playButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <Feather name="loader" size={22} color={colors.primaryForeground} />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={22}
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
          >
            <Ionicons name="play-skip-forward" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <ReactionBar />

      <View style={styles.memberStackRow}>
        <MemberAvatarStack />
      </View>

      {nextSong && (
        <TouchableOpacity
          onPress={onOpenQueue}
          style={[styles.upNextRow, { borderTopColor: colors.border + "30" }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.upNextLabel, { color: colors.mutedForeground }]}>UP NEXT</Text>
          <Text style={[styles.upNextSong, { color: colors.mutedForeground }]} numberOfLines={1}>
            {nextSong.name}
          </Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  songInfo: {
    marginLeft: 14,
    flex: 1,
  },
  songName: {
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 20,
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
    paddingTop: 4,
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  playbackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  skipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  upNextRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  upNextLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  upNextSong: {
    fontSize: 12,
    flex: 1,
  },
  memberStackRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
})
