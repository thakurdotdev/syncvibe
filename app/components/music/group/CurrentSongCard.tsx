import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Slider } from 'react-native-awesome-slider';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';

interface CurrentSongCardProps {
  onChooseSong: () => void;
  onOpenQueue: () => void;
  onPlayPause: () => void;
  onSeek: (value: number) => void;
  onSkip: () => void;
}

const GroupProgressBar = React.memo(({ onSeek }: { onSeek: (v: number) => void }) => {
  const currentTime = useGroupPlaybackStore((s) => s.currentTime);
  const duration = useGroupPlaybackStore((s) => s.duration);
  const formatTime = useGroupPlaybackStore((s) => s.formatTime);
  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const { colors } = useTheme();

  const isDragging = useRef(false);
  const prevSongIdRef = useRef<string | null>(null);

  const progress = useSharedValue(0);
  const min = useSharedValue(0);
  const max = useSharedValue(duration || 1);

  useEffect(() => {
    const isSongChanged = currentSong?.id !== prevSongIdRef.current;
    prevSongIdRef.current = currentSong?.id ?? null;

    if (isSongChanged) {
      progress.value = currentTime;
      max.value = duration || 1;
    } else {
      if (!isDragging.current) {
        progress.value = withTiming(currentTime, { duration: 600, easing: Easing.linear });
      }
      max.value = withTiming(duration || 1, { duration: 600, easing: Easing.linear });
    }
  }, [currentTime, duration, currentSong?.id]);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.sliderWrapper}>
        <Slider
          style={styles.slider}
          progress={progress}
          minimumValue={min}
          maximumValue={max}
          onSlidingStart={() => {
            isDragging.current = true;
          }}
          onValueChange={(value) => {
            progress.value = value;
          }}
          onSlidingComplete={(value) => {
            onSeek(value);
            isDragging.current = false;
          }}
          thumbWidth={12}
          sliderHeight={3}
          containerStyle={styles.sliderContainer}
          theme={{
            minimumTrackTintColor: colors.primary,
            maximumTrackTintColor: colors.mutedForeground + '30',
            bubbleBackgroundColor: colors.primary,
          }}
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
  );
});

export const CurrentSongCard: React.FC<CurrentSongCardProps> = ({
  onChooseSong,
  onOpenQueue,
  onPlayPause,
  onSeek,
  onSkip,
}) => {
  const { colors } = useTheme();

  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying);
  const isLoading = useGroupPlaybackStore((s) => s.isLoading);

  const queue = useGroupSessionStore((s) => s.queue);
  const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex);

  const currentQueueItem = useMemo(
    () => (currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null),
    [queue, currentQueueIndex]
  );

  const upcomingQueue = useMemo(
    () => queue.filter((_, idx) => idx > currentQueueIndex),
    [queue, currentQueueIndex]
  );

  const queueCount = useMemo(
    () => (currentQueueItem ? 1 : 0) + upcomingQueue.length,
    [currentQueueItem, upcomingQueue.length]
  );

  const nextSong = useMemo(() => upcomingQueue[0]?.song || null, [upcomingQueue]);
  const addedBy = currentQueueItem?.addedBy;
  const artist = currentSong?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';

  if (!currentSong) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity onPress={onChooseSong} style={styles.emptyState}>
          <Feather name='music' size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Choose a song to play
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Search for music to start the vibe
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                <Image
                  source={{ uri: String(addedBy.profilePic) }}
                  style={styles.addedByAvatar}
                />
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
          >
            {isLoading ? (
              <Feather name='loader' size={22} color={colors.primaryForeground} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
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
          >
            <Ionicons name='play-skip-forward' size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={onOpenQueue}
          style={[styles.queueButton, { backgroundColor: colors.secondary }]}
        >
          <Feather name='list' size={16} color={colors.foreground} />
          {queueCount > 0 && (
            <View style={[styles.queueBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.queueBadgeText, { color: colors.primaryForeground }]}>
                {queueCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {nextSong && (
        <TouchableOpacity
          onPress={onOpenQueue}
          style={[styles.upNextRow, { borderTopColor: colors.border }]}
        >
          <Text style={[styles.upNextLabel, { color: colors.mutedForeground }]}>UP NEXT</Text>
          <Text
            style={[styles.upNextSong, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {nextSong.name}
          </Text>
          <Feather name='chevron-right' size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  albumArt: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  songInfo: {
    marginLeft: 14,
    flex: 1,
  },
  songName: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  artistName: {
    fontSize: 13,
    marginTop: 2,
  },
  addedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 36,
  },
  sliderContainer: {
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: -4,
  },
  timeText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  queueBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  upNextLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  upNextSong: {
    fontSize: 12,
    flex: 1,
  },
});
