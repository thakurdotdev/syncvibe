import { CustomSlider } from '@/components/music/MusicCards';
import PressableScale from '@/components/ui/PressableScale';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useRef } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

const REACTIONS = ['🔥', '❤️', '👏', '😍', '🎵'] as const;
const REACTION_COOLDOWN_MS = 500;

/** Progress subscribes to time on its own, so the card around it doesn't re-render per tick. */
const Progress = memo(function Progress({ onSeek }: { onSeek: (v: number) => void }) {
  const { colors } = useTheme();
  const currentTime = useGroupPlaybackStore((s) => s.currentTime);
  const duration = useGroupPlaybackStore((s) => s.duration);
  const formatTime = useGroupPlaybackStore((s) => s.formatTime);

  return (
    <View>
      <CustomSlider
        value={currentTime}
        maxValue={duration || 1}
        onSeek={onSeek}
        trackColor={colors.primary}
        inactiveTrackColor={`${colors.mutedForeground}33`}
        thumbSize={12}
        trackHeight={3}
      />
      <View style={styles.times}>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatTime(currentTime)}
        </Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
});

const Reactions = memo(function Reactions() {
  const { colors } = useTheme();
  const { sendReaction } = useGroupMusic();
  const last = useRef(0);

  const react = useCallback(
    (emoji: string) => {
      const now = Date.now();
      if (now - last.current < REACTION_COOLDOWN_MS) return;
      last.current = now;
      sendReaction(emoji);
    },
    [sendReaction]
  );

  return (
    <View style={styles.reactions}>
      {REACTIONS.map((e) => (
        <PressableScale
          key={e}
          onPress={() => react(e)}
          scaleTo={0.8}
          accessibilityRole='button'
          accessibilityLabel={`React ${e}`}
          style={[styles.reaction, { backgroundColor: colors.raised }]}
        >
          <Text style={styles.reactionText}>{e}</Text>
        </PressableScale>
      ))}
    </View>
  );
});

/**
 * Shared player for the room: what's playing, who added it, controls, progress and quick
 * reactions. The artwork tints the card so every song gives the room its own colour.
 */
export const RoomPlayer = memo(function RoomPlayer({ onChooseSong }: { onChooseSong: () => void }) {
  const { colors, theme } = useTheme();
  const { handlePlayPause, handleSeek, skipSong } = useGroupMusic();

  const song = useGroupPlaybackStore((s) => s.currentSong);
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying);
  const isLoading = useGroupPlaybackStore((s) => s.isLoading);
  const addedBy = useGroupSessionStore((s) => {
    const item = s.currentQueueIndex >= 0 ? s.queue[s.currentQueueIndex] : null;
    return item && !item.addedBy?.isSystem ? item.addedBy?.userName : null;
  });

  const isDark = theme === 'dark';

  if (!song) {
    return (
      <PressableScale
        onPress={onChooseSong}
        accessibilityRole='button'
        style={[styles.empty, { backgroundColor: colors.accent }]}
      >
        <View style={[styles.emptyIcon, { backgroundColor: colors.primary }]}>
          <Ionicons name='musical-notes' size={22} color={colors.primaryForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.emptyTitle, { color: colors.accentForeground }]}>
            Nothing playing yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.accentForeground }]}>
            Pick the first song for everyone.
          </Text>
        </View>
        <Ionicons name='add-circle' size={28} color={colors.primary} />
      </PressableScale>
    );
  }

  const art = song.image?.[2]?.link || song.image?.[1]?.link;
  const artist = song.artist_map?.primary_artists?.[0]?.name || song.subtitle || 'Unknown artist';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {art ? (
        <Image source={{ uri: art }} style={styles.tint} blurRadius={45} fadeDuration={0} />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(27,22,36,0.7)' : 'rgba(255,255,255,0.78)' },
        ]}
      />

      <View style={styles.top}>
        <Image source={{ uri: art }} style={styles.art} fadeDuration={0} />
        <View style={styles.meta}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {song.name}
          </Text>
          <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
          {addedBy ? (
            <Text style={[styles.addedBy, { color: colors.primary }]} numberOfLines={1}>
              Added by {addedBy}
            </Text>
          ) : null}
        </View>
        <PressableScale
          onPress={() => handlePlayPause()}
          scaleTo={0.88}
          accessibilityRole='button'
          accessibilityLabel={isPlaying ? 'Pause for everyone' : 'Play for everyone'}
          style={[styles.play, { backgroundColor: colors.foreground }]}
        >
          {isLoading ? (
            <ActivityIndicator size='small' color={colors.background} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={colors.background}
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          )}
        </PressableScale>
        <PressableScale
          onPress={skipSong}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={6}
          accessibilityRole='button'
          accessibilityLabel='Skip to next song'
          style={styles.skip}
        >
          <Ionicons name='play-skip-forward' size={20} color={colors.foreground} />
        </PressableScale>
      </View>

      <View style={styles.bottom}>
        <Progress onSeek={handleSeek} />
        <Reactions />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', transform: [{ scale: 1.4 }] },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingBottom: 6 },
  art: { width: 64, height: 64, borderRadius: 14 },
  meta: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 17, letterSpacing: -0.3 },
  artist: { fontSize: 13, marginTop: 1 },
  addedBy: { fontSize: 11.5, fontWeight: '600', marginTop: 3 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  skip: { width: 36, height: 48, alignItems: 'center', justifyContent: 'center' },
  bottom: { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  time: { fontSize: 11, fontVariant: ['tabular-nums'] },
  reactions: { flexDirection: 'row', justifyContent: 'space-between' },
  reaction: {
    flex: 1,
    marginHorizontal: 3,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: { fontSize: 18 },

  empty: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 16 },
  emptyText: { fontSize: 13, marginTop: 2, opacity: 0.85 },
});
