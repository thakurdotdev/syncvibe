import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { fetchLyrics, lyricsKey, reportLyrics } from '@/api/music/lyrics';

// Found lyrics don't change; "none" is asked again later, as the server may find some by then.
const options = (songId) => ({
  queryKey: lyricsKey(songId),
  queryFn: () => fetchLyrics(songId),
  staleTime: (query) =>
    query.state.data && query.state.data.kind !== 'none' ? Infinity : 10 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const useLyrics = (songId, enabled = true) =>
  useQuery({ ...options(songId), enabled: Boolean(songId) && enabled });

/** Loads a song's lyrics ahead, so they're there the moment it starts. */
export const usePrefetchLyrics = () => {
  const client = useQueryClient();
  return useCallback(
    (songId) => {
      if (songId) void client.prefetchQuery(options(songId));
    },
    [client]
  );
};

export const useReportLyrics = (songId) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => reportLyrics(songId),
    onSuccess: (data) => {
      client.setQueryData(lyricsKey(songId), data);
      toast(data.kind === 'none' ? 'Thanks. No other lyrics found' : 'Thanks. Found other lyrics');
    },
    onError: () => toast.error("Couldn't send that. Try again"),
  });
};
