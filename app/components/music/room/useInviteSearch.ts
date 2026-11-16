import useApi from '@/utils/hooks/useApi';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SEARCH_DELAY_MS = 350;

export interface InviteUser {
  userid: number;
  name: string;
  username: string;
  profilepic: string;
  isFollowing?: boolean;
  /** Sent only for people you follow. */
  isOnline?: boolean;
}

const byFollowingThenOnline = (a: InviteUser, b: InviteUser) =>
  Number(Boolean(b.isFollowing)) - Number(Boolean(a.isFollowing)) ||
  Number(Boolean(b.isOnline)) - Number(Boolean(a.isOnline));

/** People you could invite: suggestions with an empty query, matches otherwise. */
export function useInviteSearch() {
  const api = useApi();
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching, isSuccess } = useQuery({
    queryKey: ['group-invite-list', settledQuery],
    queryFn: async ({ signal }) => {
      const params = settledQuery ? `?search=${encodeURIComponent(settledQuery)}` : '';
      const response = await api.get(`/api/user/invite-list${params}`, { signal });
      return (response.data?.users ?? []) as InviteUser[];
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const clear = useCallback(() => {
    setQuery('');
    setSettledQuery('');
  }, []);

  const users = useMemo(() => [...(data ?? [])].sort(byFollowingThenOnline), [data]);

  return {
    query,
    setQuery,
    clear,
    users,
    isSearching: query.trim().length > 0,
    // Typing counts as loading until the debounced request has answered.
    isLoading: isFetching || query.trim() !== settledQuery,
    hasLoaded: isSuccess,
  };
}
