import { ensureHttpsForDownloadUrls } from '@/Pages/Music/Common';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * Plays a list from one of its songs. The songs before it go to the end, so tapping the fifth
 * song of a mix still plays the whole mix; autoplay carries on after it.
 */
export const playSongs = (songs, startIndex = 0) => {
  const playable = (songs ?? []).filter((song) => song?.id && song.download_url?.length);
  if (playable.length === 0) return false;
  const start = Math.max(playable.indexOf(songs[startIndex]), 0);
  const ordered = [...playable.slice(start), ...playable.slice(0, start)].map(
    ensureHttpsForDownloadUrls
  );
  const { setPlaylist, playSong } = usePlayerStore.getState();
  setPlaylist(ordered);
  playSong(ordered[0]);
  return true;
};
