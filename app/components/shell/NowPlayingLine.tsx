import { PlayingBars } from '@/components/music/PlayingBars';
import { useTheme } from '@/context/ThemeContext';
import { shortSongName } from '@/lib/stations';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { typography } from '@/theme/typography';
import { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

const SWAP = FadeIn.duration(260).reduceMotion(ReduceMotion.System);

/**
 * The line under Home's title: what you're hearing, with moving bars (the room's song in a
 * room), or `fallback` when nothing is playing. The words fade in when the song changes.
 */
export const NowPlayingLine = memo(function NowPlayingLine({ fallback }: { fallback: string }) {
  const { colors } = useTheme();
  const room = useGroupSessionStore((s) => s.currentGroup?.name);
  const roomSong = useGroupPlaybackStore((s) => s.currentSong?.name);
  const roomPlaying = useGroupPlaybackStore((s) => Boolean(s.isPlaying));
  const own = usePlayerStore((s) => s.currentSong?.name);
  const ownPlaying = usePlayerStore((s) => s.isPlaying);

  const name = room ? roomSong : own;
  const playing = room ? roomPlaying : ownPlaying;
  if (!name) {
    return <Text style={[styles.text, { color: colors.mutedForeground }]}>{fallback}</Text>;
  }
  const label = shortSongName(name);
  return (
    <>
      <PlayingBars color={colors.foreground} active={playing} />
      <Animated.Text
        key={label}
        entering={SWAP}
        numberOfLines={1}
        style={[styles.text, styles.song, { color: colors.foreground }]}
      >
        {room ? `${label} · in ${room}` : label}
      </Animated.Text>
    </>
  );
});

const styles = StyleSheet.create({
  text: { ...typography.bodySm, fontSize: 13.5, flexShrink: 1 },
  song: { fontWeight: '600' },
});
