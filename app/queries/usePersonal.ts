import {
  getBlend,
  getFriendsNow,
  getLikedIds,
  getLikedSongs,
  getMoodStation,
  getMoods,
  getRecap,
  getShelves,
  getTaste,
  likeSong,
  saveTaste,
  unlikeSong,
  type Taste,
} from '@/api/personal';
import { fetchSongRecommendations } from '@/api/music';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { usePlayerStore } from '@/stores/playerStore';
import type { Song } from '@/types/song';
import { api } from '@/utils/hooks/useApi';
import { isRecommended } from '@/utils/playEvents';
import { LANGUAGE_STORAGE_KEY } from '@/lib/languages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export const personalKeys = {
  likedIds: ['personal', 'likedIds'] as const,
  liked: ['personal', 'liked'] as const,
  taste: ['personal', 'taste'] as const,
  shelves: ['personal', 'shelves'] as const,
  moods: ['personal', 'moods'] as const,
  friendsNow: ['personal', 'friendsNow'] as const,
  recap: ['personal', 'recap'] as const,
  blend: (userId: string) => ['personal', 'blend', userId] as const,
};

const useSignedIn = () => {
  const { user } = useUser();
  return Boolean(user?.userid);
};

/** Which songs you liked, shared by every heart on screen. */
export const useLikedIds = () =>
  useQuery({
    queryKey: personalKeys.likedIds,
    queryFn: getLikedIds,
    enabled: useSignedIn(),
    staleTime: 10 * 60 * 1000,
  });

export const useIsLiked = (songId: string | undefined) => {
  const { data } = useLikedIds();
  const ids = useMemo(() => new Set(data ?? []), [data]);
  return Boolean(songId && ids.has(songId));
};

export const useLikedSongs = () =>
  useQuery({ queryKey: personalKeys.liked, queryFn: getLikedSongs, enabled: useSignedIn() });

/**
 * Likes or unlikes a song. The heart changes at once and changes back if saving fails; what's
 * recommended is fetched again, since a like changes it.
 */
export const useToggleLike = () => {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: ({ song, liked }: { song: Song; liked: boolean }) =>
      liked ? likeSong(song) : unlikeSong(song.id),
    onMutate: async ({ song, liked }) => {
      await queryClient.cancelQueries({ queryKey: personalKeys.likedIds });
      const previous = queryClient.getQueryData<string[]>(personalKeys.likedIds);
      queryClient.setQueryData<string[]>(personalKeys.likedIds, (ids = []) =>
        liked
          ? [song.id, ...ids.filter((id) => id !== song.id)]
          : ids.filter((id) => id !== song.id)
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(personalKeys.likedIds, context?.previous);
      toast("Couldn't save that. Try again.", { type: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: personalKeys.liked });
      queryClient.invalidateQueries({ queryKey: personalKeys.shelves });
      queryClient.invalidateQueries({ queryKey: ['recentMusic'] });
    },
  });
  return useCallback((song: Song, liked: boolean) => mutate({ song, liked }), [mutate]);
};

export const useTaste = () =>
  useQuery({ queryKey: personalKeys.taste, queryFn: getTaste, enabled: useSignedIn() });

export const useSaveTaste = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taste: Partial<Taste>) => saveTaste(taste),
    // Shown at once; put back if saving fails.
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: personalKeys.taste });
      const previous = queryClient.getQueryData<Taste>(personalKeys.taste);
      if (previous) queryClient.setQueryData<Taste>(personalKeys.taste, { ...previous, ...change });
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(personalKeys.taste, context.previous);
    },
    onSuccess: (taste) => {
      queryClient.setQueryData<Taste>(personalKeys.taste, (old) => ({ ...old, ...taste }));
      queryClient.invalidateQueries({ queryKey: personalKeys.shelves });
      queryClient.invalidateQueries({ queryKey: ['recentMusic'] });
    },
  });
};

/**
 * Languages used to be kept only on the phone. Once signed in, if the account has none yet, the
 * phone's choice is saved to it, so recommendations follow it everywhere.
 */
export const useLanguageSync = () => {
  const { user } = useUser();
  const { data: taste } = useTaste();
  const { mutate } = useSaveTaste();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !user?.userid || !taste || taste.languages.length > 0) return;
    sent.current = true;
    // Only a choice someone made: the app's default of Hindi isn't one.
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        const languages = (saved ?? '').split(',').filter(Boolean);
        if (languages.length > 0) mutate({ languages });
      })
      .catch(() => {});
  }, [user?.userid, taste, mutate]);
};

export const useShelves = () =>
  useQuery({
    queryKey: personalKeys.shelves,
    queryFn: getShelves,
    enabled: useSignedIn(),
    staleTime: 15 * 60 * 1000,
  });

export const useMoods = () =>
  useQuery({ queryKey: personalKeys.moods, queryFn: getMoods, staleTime: Infinity });

/** A mood station's songs, fetched when its place on the dial is reached. */
export const moodStationQuery = (mood: string) => ({
  queryKey: ['personal', 'mood', mood],
  queryFn: () => getMoodStation(mood),
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const useFriendsNow = () =>
  useQuery({
    queryKey: personalKeys.friendsNow,
    queryFn: getFriendsNow,
    enabled: useSignedIn(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

export const useRecap = () =>
  useQuery({
    queryKey: personalKeys.recap,
    queryFn: getRecap,
    enabled: useSignedIn(),
    staleTime: 30 * 60 * 1000,
  });

export const useBlend = (userId: string | undefined) =>
  useQuery({
    queryKey: personalKeys.blend(userId ?? ''),
    queryFn: () => getBlend(userId!),
    enabled: Boolean(userId),
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

/**
 * Swaps autoplay's upcoming picks for ones that go where you ask. Songs you queued yourself stay,
 * in front of the new picks. A plain add, so it works from whichever of your devices you're on.
 */
export const steerQueue = async (steer: string, label: string): Promise<boolean> => {
  const { currentSong } = usePlayerStore.getState();
  if (!currentSong?.id) return false;
  const picks = await fetchSongRecommendations(api, currentSong.id, steer);
  if (!picks.length) {
    toast('Nothing new to play that way yet');
    return false;
  }
  const store = usePlayerStore.getState();
  const index = store.playlist.findIndex((song) => song.id === currentSong.id);
  const yours = store.playlist.slice(index + 1).filter((song) => !isRecommended(song.id));
  store.removeFromQueueBelow(currentSong.id);
  store.addToQueue([...yours, ...picks]);
  toast(`Up next: ${label}`);
  return true;
};
