import { EASE_OUT } from '@/lib/motion';
import { prefetchLyrics, useLyrics } from '@/queries/useLyrics';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useLyricsPrefs } from '@/stores/lyricsPrefsStore';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { glanceHeight, LyricsGlance, PlainLyricsLink } from '../lyrics/LyricsGlance';
import { LyricsSheet } from '../lyrics/LyricsSheet';
import { heardPosition, useLyricsPlayback } from '../lyrics/useLyricsPlayback';

const SPACE = glanceHeight('room') + 12;
const OPEN = { duration: 360, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;

/**
 * The room's song, two lines at a time, under the room's player; everyone's on the same line.
 * Tapping them opens the whole song. Takes no space when the song has no lyrics.
 */
export const RoomLyrics = memo(function RoomLyrics() {
  const client = useQueryClient();
  const lyrics = useLyricsPlayback();
  const songName = useGroupPlaybackStore((s) => s.currentSong?.name);
  const showLyrics = useLyricsPrefs((s) => s.showLyrics);
  const { data } = useLyrics(lyrics.songId, showLyrics);
  const [open, setOpen] = useState(false);
  const glance = showLyrics && (data?.kind === 'synced' || data?.kind === 'plain') ? data : null;

  useEffect(() => {
    if (showLyrics) prefetchLyrics(client, lyrics.nextSongId);
  }, [client, lyrics.nextSongId, showLyrics]);

  const space = useSharedValue(glance ? SPACE : 0);
  useEffect(() => {
    space.set(withTiming(glance ? SPACE : 0, OPEN));
  }, [glance, space]);
  const style = useAnimatedStyle(() => ({ height: space.get(), opacity: space.get() / SPACE }));

  return (
    <>
      <Animated.View style={[styles.root, style]}>
        {glance?.kind === 'synced' ? (
          <LyricsGlance
            lines={glance.lines}
            getPosition={heardPosition}
            active
            size='room'
            onOpen={() => setOpen(true)}
          />
        ) : glance?.kind === 'plain' ? (
          <PlainLyricsLink lyrics={glance} onOpen={() => setOpen(true)} />
        ) : null}
      </Animated.View>
      <LyricsSheet
        isVisible={open}
        onClose={() => setOpen(false)}
        songId={lyrics.songId}
        nextSongId={lyrics.nextSongId}
        songName={songName}
        onSeek={lyrics.onSeek}
      />
    </>
  );
});

const styles = StyleSheet.create({
  root: { paddingTop: 12, paddingHorizontal: 8, overflow: 'hidden' },
});
