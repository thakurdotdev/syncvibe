import { getFullSong } from '@/api/music';
import { playable } from '@/components/music/useSongPress';
import { toast } from '@/context/ToastContext';
import { usePlayerStore } from '@/stores/playerStore';
import { Song } from '@/types/song';

/** What's queued behind the song you tap: enough to keep the vibe going. */
const QUEUE_AFTER = 10;
let latestPlay = 0;

/**
 * Plays a song and queues the rest of its vibe after it. Sound comes first: songs that still need
 * their audio link fetching join the queue when it arrives, so they never hold up the one you tapped.
 */
export const playStationFrom = async (songs: Song[], index: number) => {
  const song = songs[index];
  const player = usePlayerStore.getState();
  if (!song) return;

  if (player.activePlayerMode === 'group') {
    toast('Your music is paused while the room plays');
    return;
  }
  if (player.currentSong?.id === song.id) {
    player.handlePlayPause();
    return;
  }

  const thisPlay = ++latestPlay;
  try {
    const first = await playable(song);
    if (thisPlay !== latestPlay) return;

    const rest = songs.slice(index + 1, index + 1 + QUEUE_AFTER);
    const firstMissing = rest.findIndex((s) => !s.download_url?.length);
    const ready = firstMissing < 0 ? rest : rest.slice(0, firstMissing);
    const later = firstMissing < 0 ? [] : rest.slice(firstMissing);

    // Starts the song first, as a queue of its own. Setting the queue before it starts would ask
    // for recommendations based on whatever was playing before.
    usePlayerStore.setState({ playlist: [], originalPlaylist: [] });
    usePlayerStore.getState().playSong(first);
    usePlayerStore.getState().addToQueue(ready);

    if (later.length) {
      const fetched = await Promise.allSettled(
        later.map((s) => (s.download_url?.length ? Promise.resolve(s) : getFullSong(s.id)))
      );
      if (thisPlay !== latestPlay) return;
      usePlayerStore
        .getState()
        .addToQueue(fetched.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])));
    }
  } catch {
    toast(`Couldn't play ${song.name}`, { type: 'error' });
  }
};
