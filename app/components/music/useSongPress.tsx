import { getFullSong } from '@/api/music';
import { toast } from '@/context/ToastContext';
import { usePlayerStore, useSongPlaybackState } from '@/stores/playerStore';
import { Song } from '@/types/song';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { useCallback, useState } from 'react';
import NewPlayerDrawer from './NewPlayerDrawer';

/** Some lists give a song without its audio link, which playing and queueing both need. */
const playable = async (song: Song) =>
  ensureHttpsForSongUrls(song.download_url?.length ? song : await getFullSong(song.id));

/**
 * Tap plays (or toggles the current song); long-press opens the song's options sheet.
 * Player actions are read when pressed, not subscribed to, and the song's URLs are secured only
 * then too, so a screen full of cards does no work until one of them is touched.
 */
export const useSongPress = (song: Song) => {
  const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id);
  const [optionsFor, setOptionsFor] = useState<Song | null>(null);

  const onPress = useCallback(async () => {
    const player = usePlayerStore.getState();
    if (player.currentSong?.id === song.id) {
      player.handlePlayPause();
      return;
    }
    try {
      player.playSong(await playable(song));
    } catch {
      toast(`Couldn't play ${song.name}`, { type: 'error' });
    }
  }, [song]);

  const onLongPress = useCallback(async () => {
    try {
      setOptionsFor(await playable(song));
    } catch {
      toast(`Couldn't load ${song.name}`, { type: 'error' });
    }
  }, [song]);

  const options = optionsFor ? (
    <NewPlayerDrawer isVisible onClose={() => setOptionsFor(null)} song={optionsFor} />
  ) : null;

  return { onPress, onLongPress, isCurrentSong, isPlaying, options };
};
