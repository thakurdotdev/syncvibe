import { blurredArt } from '@/lib/artwork';
import { CustomSlider } from '@/components/music/MusicCards';
import { Gloss } from '@/components/ui/Finish';
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
          style={[styles.reaction, { backgroundColor: colors.gradients.surface[0] }]}
        >
          <Text style={styles.reactionText}>{e}</Text>
        </PressableScale>
      ))}
    </View>
  );
});

/**
 * Shared player for the room. One row says what's playing and holds the controls, so the title
 * gets the width; progress and quick reactions run the full card below. The artwork also tints
 * the card, so every song gives the room its own colour.
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
        style={[styles.empty, { borderColor: colors.hairline }]}
      >
        <Gloss tone='surface' />
        <View style={[styles.emptyIcon, { backgroundColor: colors.raised }]}>
          <Ionicons name='musical-notes' size={20} color={colors.foreground} />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing playing yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Pick the first song for everyone.
          </Text>
        </View>
        <View style={[styles.emptyAdd, { backgroundColor: colors.primary }]}>
          <Gloss />
          <Ionicons name='add' size={20} color={colors.primaryForeground} />
        </View>
      </PressableScale>
    );
  }

  const art = song.image?.[2]?.link || song.image?.[1]?.link;
  const artist = song.artist_map?.primary_artists?.[0]?.name || song.subtitle || 'Unknown artist';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.hairline }]}>
      {art ? <Image {...blurredArt(art, 45)} style={styles.tint} /> : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(10,10,11,0.74)' : 'rgba(255,255,255,0.82)' },
        ]}
      />

      <View style={styles.body}>
        <View style={styles.top}>
          <Image
            source={{ uri: art }}
            style={[styles.art, { backgroundColor: colors.raised }]}
            resizeMode='cover'
            fadeDuration={0}
          />
          <View style={styles.meta}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {song.name}
            </Text>
            <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>
              {artist}
            </Text>
            {!canControl ? (
              <View style={styles.note}>
                <Ionicons name='lock-closed' size={10} color={colors.mutedForeground} />
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                  Host controls playback
                </Text>
              </View>
            ) : addedBy ? (
              <Text style={[styles.noteText, { color: colors.mutedForeground }]} numberOfLines={1}>
                Added by <Text style={{ color: colors.foreground }}>{addedBy}</Text>
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
            style={[styles.play, { backgroundColor: colors.primary }, !canControl && styles.locked]}
          >
            <Gloss />
            {isLoading ? (
              <ActivityIndicator size='small' color={colors.primaryForeground} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={colors.primaryForeground}
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
            <Ionicons name='play-skip-forward' size={19} color={colors.foreground} />
          </PressableScale>
        </View>

        <Progress onSeek={handleSeek} locked={!canControl} />
        <Reactions />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', transform: [{ scale: 1.4 }] },
  body: { padding: 12, gap: 8 },
  // Above the slider, whose touch area reaches up behind this row.
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 1 },
  art: { width: 56, height: 56, borderRadius: 14 },
  meta: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 16.5, letterSpacing: -0.3 },
  artist: { fontSize: 13, marginTop: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  noteText: { fontSize: 11.5, fontWeight: '500', marginTop: 3 },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  skip: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  locked: { opacity: 0.4 },
  slider: { marginVertical: -11 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 10.5, fontVariant: ['tabular-nums'] },
  reactions: { flexDirection: 'row', gap: 6 },
  reaction: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: { fontSize: 15 },

  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 16 },
  emptyText: { fontSize: 13, marginTop: 2 },
  emptyAdd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
