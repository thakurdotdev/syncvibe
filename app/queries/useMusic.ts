'use client';

import {
  addToHistory,
  dislikeSong,
  fetchSongRecommendations,
  getAlbumDetails,
  getArtistDetails,
  getHomePageMusic,
  getMusicHistory,
  getPlaylistDetails,
  getRecentMusic,
  getRelatedSongs,
  searchMusic,
  undoDislikeSong,
} from '@/api/music';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { Station, StationSource, uniqueSongs } from '@/lib/stations';
import { usePlayerStore } from '@/stores/playerStore';
import { MusicHistoryParams } from '@/types/music';
import { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useHomePageMusic = () => {
  const { selectedLanguages, restored } = useUser();
  const language = selectedLanguages || 'hindi';

  return useQuery({
    queryKey: ['homePageMusic', language],
    queryFn: () => getHomePageMusic(language),
    // Until the saved languages are read, `language` is only the default: fetching it would
    // cost a request and swap the whole page a moment later.
    enabled: restored,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
};

export const useRecentMusic = () => {
  const api = useApi();
  const { user } = useUser();

  return useQuery({
    queryKey: ['recentMusic'],
    queryFn: () => getRecentMusic(api),
    enabled: !!user?.userid, // Only fetch if user is logged in
    staleTime: 90 * 1000,
    refetchOnMount: true,
  });
};

/**
 * "Don't recommend this song": saved on the server, so autoplay and Made for you leave it out on
 * every device. It also leaves the queue now, and skips ahead if it is playing.
 */
export const useDislikeSong = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (song: Song) => dislikeSong(api, song),
    onSuccess: (_data, song) => {
      const { currentSong, playlist, handleNextSong, removeFromQueue } = usePlayerStore.getState();
      if (currentSong?.id === song.id && playlist.length > 1) handleNextSong();
      removeFromQueue(song.id);
      queryClient.invalidateQueries({ queryKey: ['recentMusic'] });
      toast("We won't recommend this song again", {
        action: {
          label: 'Undo',
          onPress: () => {
            undoDislikeSong(api, song.id)
              .then(() => queryClient.invalidateQueries({ queryKey: ['recentMusic'] }))
              .catch(() => toast("Couldn't undo. Try again.", { type: 'error' }));
          },
        },
      });
    },
    onError: () => toast("Couldn't save that. Try again.", { type: 'error' }),
  });
};

export const useMusicHistory = (params: MusicHistoryParams) => {
  const api = useApi();
  return useQuery({
    queryKey: ['musicHistory', params],
    queryFn: () => getMusicHistory(api, params),
  });
};

export const useAddToHistory = () => {
  const queryClient = useQueryClient();
  const api = useApi();
  return useMutation({
    mutationFn: ({ songData, playedTime }: { songData: Song; playedTime?: number }) =>
      addToHistory(api, songData, playedTime),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentMusic'] });
    },
  });
};

export const useRelatedSongs = (songId: string | undefined) => {
  return useQuery({
    queryKey: ['relatedSongs', songId],
    queryFn: () => getRelatedSongs(songId!),
    enabled: !!songId, // Only fetch if songId is provided
  });
};

export const usePlaylistDetails = (playlistId: string | undefined) => {
  return useQuery({
    queryKey: ['playlistDetails', playlistId],
    queryFn: () => getPlaylistDetails(playlistId!),
    enabled: !!playlistId,
  });
};

export const useAlbumDetails = (albumId: string | undefined) => {
  return useQuery({
    queryKey: ['albumDetails', albumId],
    queryFn: () => getAlbumDetails(albumId!),
    enabled: !!albumId,
  });
};

export const useArtistDetails = (artistId: string | undefined) => {
  return useQuery({
    queryKey: ['artistDetails', artistId],
    queryFn: () => getArtistDetails(artistId!),
    enabled: !!artistId,
  });
};

export const useSearchMusic = (query: string) => {
  return useQuery({
    queryKey: ['searchMusic', query],
    queryFn: () => searchMusic(query),
    enabled: !!query,
  });
};

export const useSongRecommendationsQuery = (
  id: string | undefined,
  options?: { enabled?: boolean }
) => {
  const api = useApi();

  return useQuery({
    queryKey: ['songRecommendations', id],
    queryFn: () => fetchSongRecommendations(api, id!),
    enabled: (options?.enabled ?? true) && !!id,
  });
};

const STATION_SONGS = 15;

/** One station's songs, trimmed so a vibe doesn't add a whole playlist to the saved cache. */
export const stationQuery = (source: StationSource) => ({
  queryKey: ['station', source.kind, source.id],
  queryFn: async () => {
    const details =
      source.kind === 'playlist'
        ? await getPlaylistDetails(source.id)
        : await getAlbumDetails(source.id);
    return uniqueSongs(((details as any)?.songs ?? []) as Song[]).slice(0, STATION_SONGS);
  },
  staleTime: 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const useStationSongs = (station?: Station) => {
  const fetched = useQuery({
    ...stationQuery(station?.source ?? { kind: 'playlist', id: '' }),
    enabled: Boolean(station?.source),
  });
  return station?.songs
    ? { songs: station.songs, isLoading: false, isError: false, refetch: fetched.refetch }
    : {
        songs: fetched.data ?? EMPTY_SONGS,
        isLoading: fetched.isLoading,
        isError: fetched.isError,
        refetch: fetched.refetch,
      };
};

const EMPTY_SONGS: Song[] = [];
