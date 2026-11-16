import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { homepageKeys } from '@/api/music/homepage';
import {
  fetchLikedIds,
  fetchLikedSongs,
  likeSong,
  personalKeys,
  unlikeSong,
} from '@/api/music/personal';
import { useProfile } from '@/Context/Context';

/** Which songs you liked, as a set of ids, shared by every heart on the page. */
export const useLikedIds = () => {
  const { user } = useProfile();
  return useQuery({
    queryKey: personalKeys.likedIds(),
    queryFn: fetchLikedIds,
    select: (ids) => new Set(ids),
    enabled: Boolean(user?.userid),
    staleTime: 1000 * 60 * 10,
  });
};

export const useIsLiked = (songId) => {
  const { data } = useLikedIds();
  return Boolean(songId && data?.has(songId));
};

export const useLikedSongsQuery = (options = {}) =>
  useQuery({
    queryKey: personalKeys.liked(),
    queryFn: fetchLikedSongs,
    staleTime: 1000 * 60 * 2,
    ...options,
  });

/**
 * Likes or unlikes a song. The heart changes at once and changes back if saving fails; what's
 * recommended is fetched again, since a like changes it.
 */
export const useToggleLike = () => {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({ song, liked }) => (liked ? likeSong(song) : unlikeSong(song.id)),
    onMutate: async ({ song, liked }) => {
      await queryClient.cancelQueries({ queryKey: personalKeys.likedIds() });
      const previous = queryClient.getQueryData(personalKeys.likedIds());
      queryClient.setQueryData(personalKeys.likedIds(), (ids = []) =>
        liked
          ? [song.id, ...ids.filter((id) => id !== song.id)]
          : ids.filter((id) => id !== song.id)
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(personalKeys.likedIds(), context?.previous);
      toast.error("Couldn't save that. Try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.liked() });
      queryClient.invalidateQueries({ queryKey: personalKeys.shelves() });
      queryClient.invalidateQueries({ queryKey: homepageKeys.recommendations() });
    },
  });

  return useCallback(
    (song, liked) => {
      if (!song?.id) return;
      mutate({ song, liked });
    },
    [mutate]
  );
};
