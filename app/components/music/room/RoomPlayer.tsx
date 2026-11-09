import { blurredArt } from '@/lib/artwork';
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
import { useRoomControl } from './useRoomControl';

const REACTIONS = ['🔥', '❤️', '👏', '😍', '🎵'] as const;
const REACTION_COOLDOWN_MS = 300;
const REACTION_HIT_SLOP = { top: 4, bottom: 8 };

/** Progress subscribes to time on its own, so the card around it doesn't re-render per tick. */
const Progress = memo(function Progress({
  onSeek,
  locked,
}: {
  onSeek: (v: number) => void;
  locked: boolean;
}) {
  const { colors } = useTheme();
  const currentTime = useGroupPlaybackStore((s) => s.currentTime);
  const duration = useGroupPlaybackStore((s) => s.duration);
  const formatTime = useGroupPlaybackStore((s) => s.formatTime);

  return (
    <View>
      {/* Keeps the slider's full touch height while taking little room in the layout. */}
      <View style={styles.slider} pointerEvents={locked ? 'none' : 'auto'}>
        <CustomSlider
          value={currentTime}
          maxValue={duration || 1}
          onSeek={onSeek}
          trackColor={colors.primary}
          inactiveTrackColor={`${colors.mutedForeground}33`}
          thumbSize={12}
          trackHeight={3}
        />
      </View>
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
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={REACTION_HIT_SLOP}
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
 * Shared player for the room: the artwork fills the left edge, with what's playing, controls,
 * progress and quick reactions beside it. It also tints the card, so every song gives the room
 * its own colour.
 */
export const RoomPlayer = memo(function RoomPlayer({ onChooseSong }: { onChooseSong: () => void }) {
  const { colors, theme } = useTheme();
  const { handlePlayPause, handleSeek, skipSong } = useGroupMusic();
  const { canControl } = useRoomControl();

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
      {art ? <Image {...blurredArt(art, 45)} style={styles.tint} /> : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(27,22,36,0.7)' : 'rgba(255,255,255,0.78)' },
        ]}
      />

      <View style={styles.row}>
        <Image source={{ uri: art }} style={styles.art} resizeMode='cover' fadeDuration={0} />

        <View style={styles.side}>
          <View style={styles.top}>
            <View style={styles.meta}>
              <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                {song.name}
              </Text>
              <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>
                {artist}
              </Text>
              {!canControl ? (
                <Text style={[styles.addedBy, { color: colors.mutedForeground }]} numberOfLines={1}>
                  Host controls playback
                </Text>
              ) : addedBy ? (
                <Text style={[styles.addedBy, { color: colors.primary }]} numberOfLines={1}>
                  Added by {addedBy}
                </Text>
              ) : null}
            </View>
            <PressableScale
              onPress={() => handlePlayPause()}
              disabled={!canControl}
              scaleTo={BUTTON_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityState={{ disabled: !canControl }}
              accessibilityLabel={isPlaying ? 'Pause for everyone' : 'Play for everyone'}
              style={[
                styles.play,
                { backgroundColor: colors.foreground },
                !canControl && styles.locked,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size='small' color={colors.background} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={19}
                  color={colors.background}
                  style={{ marginLeft: isPlaying ? 0 : 2 }}
                />
              )}
            </PressableScale>
            <PressableScale
              onPress={skipSong}
              disabled={!canControl}
              scaleTo={BUTTON_PRESS_SCALE}
              hitSlop={6}
              accessibilityRole='button'
              accessibilityState={{ disabled: !canControl }}
              accessibilityLabel='Skip to next song'
              style={[styles.skip, !canControl && styles.locked]}
            >
              <Ionicons name='play-skip-forward' size={18} color={colors.foreground} />
            </PressableScale>
          </View>

          <Progress onSeek={handleSeek} locked={!canControl} />
          <Reactions />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', transform: [{ scale: 1.4 }] },
  row: { flexDirection: 'row' },
  // Stretches to the card's height, however tall larger text makes the side column.
  art: { width: 136, alignSelf: 'stretch' },
  side: { flex: 1, minWidth: 0, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  // Above the slider, whose touch area reaches up behind this row.
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 1 },
  meta: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 16, letterSpacing: -0.3 },
  artist: { fontSize: 12.5, marginTop: 1 },
  addedBy: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  skip: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center' },
  locked: { opacity: 0.4 },
  slider: { marginVertical: -13 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 10.5, fontVariant: ['tabular-nums'] },
  reactions: { flexDirection: 'row', gap: 4 },
  reaction: {
    flex: 1,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: { fontSize: 15 },

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
