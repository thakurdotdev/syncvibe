import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import he from 'he';
import {
  dislikeArtist,
  dislikeSong,
  undoDislikeArtist,
  undoDislikeSong,
} from '@/api/music/dislikes';
import { personalKeys } from '@/api/music/personal';
import { homepageKeys } from '@/api/music/homepage';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * "Don't recommend this song": saved on the server, so autoplay and Made for you leave it out on
 * every device. It also leaves the queue now, and skips ahead if it is playing.
 */
export const useDislikeSong = () => {
  const queryClient = useQueryClient();

  return useCallback(
    async (song) => {
      if (!song?.id) return;
      try {
        await dislikeSong(song);
      } catch {
        toast.error("Couldn't save that. Try again.");
        return;
      }

      const { currentSong, playlist, handleNextSong, setPlaylist } = usePlayerStore.getState();
      if (currentSong?.id === song.id && playlist.length > 1) handleNextSong();
      if (playlist.some((item) => item.id === song.id)) {
        setPlaylist(usePlayerStore.getState().playlist.filter((item) => item.id !== song.id));
      }
      queryClient.invalidateQueries({ queryKey: homepageKeys.recommendations() });

      toast("We won't recommend this song again", {
        action: {
          label: 'Undo',
          onClick: () =>
            undoDislikeSong(song.id)
              .then(() =>
                queryClient.invalidateQueries({ queryKey: homepageKeys.recommendations() })
              )
              .catch(() => toast.error("Couldn't undo. Try again.")),
        },
      });
    },
    [queryClient]
  );
};

/** Who a song is by, for "Don't recommend <artist>": its first primary artist or singer. */
export const mainArtistOf = (song) => {
  const map = song?.artist_map;
  const pick =
    map?.primary_artists?.[0] ??
    map?.artists?.find((artist) => artist?.role === 'singer') ??
    map?.artists?.[0];
  return pick?.id && pick?.name
    ? { id: String(pick.id), name: he.decode(String(pick.name)) }
    : null;
};

/** "Don't recommend <artist>": their songs leave autoplay, Made for you and your shelves. */
export const useDislikeArtist = () => {
  const queryClient = useQueryClient();
  return useCallback(
    async (artist) => {
      if (!artist?.id) return;
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: homepageKeys.recommendations() });
        queryClient.invalidateQueries({ queryKey: personalKeys.shelves() });
      };
      try {
        await dislikeArtist(artist);
      } catch {
        toast.error("Couldn't save that. Try again.");
        return;
      }
      refresh();
      toast(`We won't recommend ${artist.name}`, {
        action: {
          label: 'Undo',
          onClick: () =>
            undoDislikeArtist(artist.id)
              .then(refresh)
              .catch(() => toast.error("Couldn't undo. Try again.")),
        },
      });
    },
    [queryClient]
  );
};
