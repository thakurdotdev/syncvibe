import { SONG_URL } from '@/constants';
import { useUser } from '@/context/UserContext';
import type { MusicHistoryResponse } from '@/types/music';
import { searchSongs } from '@/utils/api/getSongs';
import useApi from '@/utils/hooks/useApi';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';

export type PlaylistResult = {
  id: string | number;
  name: string;
  subtitle?: string;
  image?: unknown;
  songCount?: number | string;
  previewSongs?: { image?: unknown }[];
};

export type PersonResult = {
  userid: string | number;
  name: string;
  username?: string;
  profilepic?: string;
};

/** Below this, a search across the server matches too much to be useful. */
export const MIN_REMOTE_QUERY = 2;

// Everything under ['search'] lets the search field show one spinner for whichever tab is open.
// A short gcTime keeps results out of the long-lived persisted query cache.
const RESULTS = { gcTime: 5 * 60 * 1000, placeholderData: keepPreviousData } as const;

export const useSongSearch = (query: string) =>
  useQuery({
    ...RESULTS,
    queryKey: ['search', 'songs', query],
    queryFn: ({ signal }) => searchSongs(query, signal),
    enabled: query.length > 0,
  });

/** With no query, this is simply what you played most recently. */
export const useHistorySearch = (query: string) => {
  const api = useApi();
  const { user } = useUser();
  return useQuery({
    ...RESULTS,
    queryKey: ['search', 'history', user?.userid, query],
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/api/music/latestHistory', {
        params: {
          page: 1,
          limit: 30,
          searchQuery: query,
          sortBy: query ? 'relevance' : 'lastPlayedAt',
          sortOrder: 'DESC',
        },
        signal,
      });
      return data.data as MusicHistoryResponse;
    },
    enabled: Boolean(user?.userid),
  });
};

export const useOwnPlaylists = () => {
  const api = useApi();
  const { user } = useUser();
  return useQuery({
    gcTime: RESULTS.gcTime,
    queryKey: ['search', 'ownPlaylists', user?.userid],
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/api/playlist/get', { signal });
      return (data?.data ?? []) as PlaylistResult[];
    },
    enabled: Boolean(user?.userid),
  });
};

export const useCatalogPlaylistSearch = (query: string) =>
  useQuery({
    ...RESULTS,
    queryKey: ['search', 'catalogPlaylists', query],
    queryFn: async ({ signal }) => {
      const { data } = await axios.get(`${SONG_URL}/search/playlists`, {
        params: { q: query },
        signal,
      });
      return (data?.data?.results ?? []) as PlaylistResult[];
    },
    enabled: query.length >= MIN_REMOTE_QUERY,
  });

export const usePeopleSearch = (query: string) => {
  const api = useApi();
  return useQuery({
    ...RESULTS,
    queryKey: ['search', 'people', query],
    queryFn: async ({ signal }) => {
      try {
        const { data } = await api.get('/api/user/search', { params: { name: query }, signal });
        return (data?.users ?? []) as PersonResult[];
      } catch (error: any) {
        // The endpoint answers "no matches" with a 404.
        if (error?.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: query.length >= MIN_REMOTE_QUERY,
  });
};
