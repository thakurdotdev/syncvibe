import { useGroupSessionStore } from '@/stores/groupMusic/sessionStore';
import { useCallback, useEffect } from 'react';

// Note: always call the store hook by its `use*` name. The React Compiler only
// recognises hooks by name; an alias (e.g. `const store = useGroupSessionStore`)
// gets memoized like a plain function, which breaks hook order at runtime.

/** Song search for the queue panel, backed by the shared group session store. */
export const useQueueSearch = () => {
  const searchQuery = useGroupSessionStore((s) => s.searchQuery) ?? '';
  const searchResults = useGroupSessionStore((s) => s.searchResults) ?? [];
  const isSearchLoading = useGroupSessionStore((s) => s.isSearchLoading);

  const handleChange = useCallback((event) => {
    const query = event.target.value;
    useGroupSessionStore.setState({
      searchQuery: query,
      searchResults: [],
      isSearchLoading: Boolean(query.trim()),
    });
    useGroupSessionStore.getState().debouncedSearch(query);
  }, []);

  const clear = useCallback(() => {
    useGroupSessionStore.getState().debouncedSearch.cancel?.();
    useGroupSessionStore.setState({ searchQuery: '', searchResults: [], isSearchLoading: false });
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
