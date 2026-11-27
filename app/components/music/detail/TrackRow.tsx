import NewPlayerDrawer from '@/components/music/NewPlayerDrawer';
import { PlayingBars } from '@/components/music/PlayingBars';
import { playable } from '@/components/music/useSongPress';
import { CachedImage } from '@/components/ui/CachedImage';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { BUTTON_PRESS_SCALE, IMAGE_FADE_MS, LIST_PRESS_DELAY, ROW_PRESS_SCALE } from '@/lib/motion';
import { useSongPlaybackState } from '@/stores/playerStore';
import { fonts, typography } from '@/theme/typography';
import type { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useOptionalDetail } from './context';
import { artistsLine, clock, coverOf, secondsOf } from './format';
import { rowRise } from './motion';

export interface TrackRowProps {
  song: Song;
  index: number;
  /** Plays the list from this row. */
  onPlay: (index: number) => void;
  /** Albums leave the cover out: every song has the same one. */
  showCover?: boolean;
  /** Albums leave the album's name out of each song's line. */
  dropAlbum?: boolean;
  /** Your own playlist's rows offer removing the song in their options. */
  onRemoveFromPlaylist?: () => void;
}

/**
 * A numbered song in a list. The playing one trades its number for moving bars. Tap plays the
 * list from here; long-press or ⋯ opens its options.
 */
export const TrackRow = memo(function TrackRow({
  song,
  index,
  onPlay,
  showCover = true,
  dropAlbum = false,
  onRemoveFromPlaylist,
}: TrackRowProps) {
  const { colors } = useTheme();
  const { isCurrentSong, isPlaying } = useSongPlaybackState(song?.id);
  const [options, setOptions] = useState<Song | null>(null);
  const detail = useOptionalDetail();
  // Decided once, as the row first mounts: rows scrolled back into view don't animate again.
  const [delay] = useState(() => detail?.rowDelay(index) ?? null);

  const openOptions = useCallback(async () => {
    try {
      setOptions(await playable(song));
    } catch {
      toast(`Couldn't load ${song.name}`, { type: 'error' });
    }
  }, [song]);

  if (!song?.id) return null;
  const time = clock(secondsOf(song));

  return (
    <Animated.View entering={delay === null ? undefined : rowRise(delay)}>
      <PressableScale
        onPress={() => onPlay(index)}
        onLongPress={openOptions}
        delayLongPress={350}
        unstable_pressDelay={LIST_PRESS_DELAY}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`${song.name}, ${artistsLine(song, dropAlbum)}`}
        accessibilityHint={isCurrentSong ? 'Plays or pauses' : 'Plays the list from this song'}
        style={[styles.row, isCurrentSong && { backgroundColor: `${colors.primary}14` }]}
      >
        <View style={styles.lead}>
          {isCurrentSong ? (
            <PlayingBars color={colors.primary} active={isPlaying} />
          ) : (
            <Text style={[styles.number, { color: colors.mutedForeground }]}>{index + 1}</Text>
          )}
        </View>

        {showCover && (
          <CachedImage
            source={{ uri: coverOf(song.image, 1) }}
            transition={IMAGE_FADE_MS}
            style={[styles.cover, { backgroundColor: colors.raised }]}
          />
        )}

        <View style={styles.text}>
          <Text
            style={[styles.title, { color: isCurrentSong ? colors.primary : colors.foreground }]}
            numberOfLines={1}
          >
            {song.name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artistsLine(song, dropAlbum)}
          </Text>
        </View>

        {time ? <Text style={[styles.time, { color: colors.mutedForeground }]}>{time}</Text> : null}

        <PressableScale
          onPress={openOptions}
          hitSlop={10}
          scaleTo={BUTTON_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel={`Options for ${song.name}`}
          style={styles.more}
        >
          <Ionicons name='ellipsis-horizontal' size={18} color={colors.mutedForeground} />
        </PressableScale>
      </PressableScale>

      {options && (
        <NewPlayerDrawer
          isVisible
          onClose={() => setOptions(null)}
          song={options}
          onRemoveFromPlaylist={onRemoveFromPlaylist}
        />
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: 8,
    paddingLeft: 4,
    paddingRight: 2,
    marginHorizontal: 12,
    marginVertical: 1,
    borderRadius: 14,
  },
  lead: { width: 36, alignItems: 'center', justifyContent: 'center' },
  number: {
    fontFamily: fonts.displaySemibold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  cover: { width: 44, height: 44, borderRadius: 7, marginLeft: 2, marginRight: 12 },
  text: { flex: 1, justifyContent: 'center', paddingLeft: 2 },
  title: { ...typography.labelLg, fontSize: 15, letterSpacing: -0.2 },
  subtitle: { ...typography.bodySm, fontSize: 12.5, marginTop: 1 },
  time: { ...typography.caption, marginLeft: 10, fontVariant: ['tabular-nums'] },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
