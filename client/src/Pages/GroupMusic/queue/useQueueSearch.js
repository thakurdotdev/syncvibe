import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { useCallback, useEffect } from 'react';

const store = useGroupSessionStore;

/** Song search for the queue panel, backed by the shared group session store. */
export const useQueueSearch = () => {
  const searchQuery = store((s) => s.searchQuery);
  const searchResults = store((s) => s.searchResults);
  const isSearchLoading = store((s) => s.isSearchLoading);

  const handleChange = useCallback((event) => {
    const query = event.target.value;
    store.setState({
      searchQuery: query,
      searchResults: [],
      isSearchLoading: Boolean(query.trim()),
    });
    store.getState().debouncedSearch(query);
  }, []);

  const clear = useCallback(() => {
    store.getState().debouncedSearch.cancel?.();
    store.setState({ searchQuery: '', searchResults: [], isSearchLoading: false });
  }, []);

  // Leaving the room (or unmounting the panel) shouldn't leave a stale search behind.
  useEffect(() => clear, [clear]);

  return {
    searchQuery,
    searchResults,
    isSearchLoading,
    isSearching: searchQuery.length > 0,
    handleChange,
    clear,
  };
};
