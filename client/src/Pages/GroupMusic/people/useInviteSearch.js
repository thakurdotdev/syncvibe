import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SEARCH_DELAY_MS = 350;

const byFollowingThenOnline = (a, b) =>
  Number(Boolean(b.isFollowing)) - Number(Boolean(a.isFollowing)) ||
  Number(Boolean(b.isOnline)) - Number(Boolean(a.isOnline));

const fetchInviteList = async (text, signal) => {
  const params = text ? `?search=${encodeURIComponent(text)}` : '';
  const response = await axios.get(
    `${import.meta.env.VITE_API_URL}/api/user/invite-list${params}`,
    { withCredentials: true, signal }
  );
  return response.data?.users || [];
};

/** People you could invite: suggestions with an empty query, matches otherwise. */
export const useInviteSearch = () => {
  const [query, setQuery] = useState('');
  const [settledQuery, setSettledQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching, isSuccess } = useQuery({
    queryKey: ['group-invite-list', settledQuery],
    queryFn: ({ signal }) => fetchInviteList(settledQuery, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const handleChange = useCallback((event) => setQuery(event.target.value), []);
  const clear = useCallback(() => {
    setQuery('');
    setSettledQuery('');
  }, []);

  const users = useMemo(() => [...(data ?? [])].sort(byFollowingThenOnline), [data]);
  const isSearching = query.trim().length > 0;

  return {
    query,
    isSearching,
    users,
    // Typing counts as loading until the debounced request has answered.
    isLoading: isFetching || query.trim() !== settledQuery,
    hasLoaded: isSuccess,
    handleChange,
    clear,
  };
};
