import { usePlayerStore, useSongPlaybackState } from '@/stores/playerStore';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { useCallback, useState } from 'react';
import NewPlayerDrawer from './NewPlayerDrawer';

/**
 * Tap plays (or toggles the current song); long-press opens the song's options sheet.
 * Player actions are read when pressed, not subscribed to, and the song's URLs are secured only
 * then too, so a screen full of cards does no work until one of them is touched.
 */
export const useSongPress = (song: Song) => {
  const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const onPress = useCallback(() => {
    const player = usePlayerStore.getState();
    if (player.currentSong?.id === song.id) player.handlePlayPause();
    else player.playSong(ensureHttpsForSongUrls(song));
  }, [song]);

  const onLongPress = useCallback(() => setOptionsOpen(true), []);

  const options = optionsOpen ? (
    <NewPlayerDrawer
      isVisible
      onClose={() => setOptionsOpen(false)}
      song={ensureHttpsForSongUrls(song)}
    />
  ) : null;

  return { onPress, onLongPress, isCurrentSong, isPlaying, options };
};
