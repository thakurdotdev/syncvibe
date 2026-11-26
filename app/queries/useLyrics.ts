import { getLyrics, reportLyrics, type Lyrics } from '@/api/lyrics';
import { toast } from '@/context/ToastContext';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

export const lyricsKey = (songId: string) => ['lyrics', songId] as const;

// Found lyrics don't change; "none" is asked again later, as the server may find some by then.
const staleTimeOf = (data: Lyrics | undefined) =>
  data && data.kind !== 'none' ? Infinity : 10 * 60 * 1000;

const options = (songId: string) => ({
  queryKey: lyricsKey(songId),
  queryFn: () => getLyrics(songId),
  staleTime: ({ state }: { state: { data?: Lyrics } }) => staleTimeOf(state.data),
  gcTime: 30 * 60 * 1000,
});

export const useLyrics = (songId: string | undefined, enabled = true) =>
  useQuery({ ...options(songId ?? ''), enabled: Boolean(songId) && enabled });

/** Loads a song's lyrics ahead, so they're there the moment it starts. */
export const prefetchLyrics = (client: QueryClient, songId: string | undefined) => {
  if (songId) void client.prefetchQuery(options(songId));
};

export const useReportLyrics = (songId: string | undefined) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => reportLyrics(songId ?? ''),
    onSuccess: (data) => {
      if (!songId) return;
      client.setQueryData(lyricsKey(songId), data);
      toast(data.kind === 'none' ? 'Thanks. No other lyrics found' : 'Thanks. Found other lyrics');
    },
    onError: () => toast("Couldn't send that. Try again", { type: 'error' }),
  });
};
