import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { dislikeSong, undoDislikeSong } from '@/api/music/dislikes';
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
