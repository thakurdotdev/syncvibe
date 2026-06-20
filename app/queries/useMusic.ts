'use client';

import {
  addToHistory,
  fetchSongRecommendations,
  getAlbumDetails,
  getArtistDetails,
  getHomePageMusic,
  getMusicHistory,
  getPlaylistDetails,
  getRecentMusic,
  getRelatedSongs,
  searchMusic,
} from '@/api/music';
import { useUser } from '@/context/UserContext';
import { MusicHistoryParams } from '@/types/music';
import { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useHomePageMusic = () => {
  return useQuery({
    queryKey: ['homePageMusic'],
    queryFn: () => getHomePageMusic(),
  });
};

export const useRecentMusic = () => {
  const api = useApi();
  const { user } = useUser();

  return useQuery({
    queryKey: ['recentMusic'],
    queryFn: () => getRecentMusic(api),
    enabled: !!user?.userid, // Only fetch if user is logged in
    refetchOnMount: 'always', // Always refetch when the component mounts
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
  options?: { enabled?: boolean },
) => {
  const api = useApi();

  return useQuery({
    queryKey: ['songRecommendations', id],
    queryFn: () => fetchSongRecommendations(api, id!),
    enabled: (options?.enabled ?? true) && !!id,
  })
}
