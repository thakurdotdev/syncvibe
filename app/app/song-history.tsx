import SwipeableModal from '@/components/SwipeableModal';
import { SongCard } from '@/components/music/MusicCards';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TextInput as RNTextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ITEMS_PER_PAGE = 15;

type SortOption = {
  label: string;
  value: string;
  icon: React.ReactElement<{ color?: string }>;
};

type SortOrder = 'ASC' | 'DESC';

const baseSortOptions: SortOption[] = [
  {
    label: 'Recently Played',
    value: 'lastPlayedAt',
    icon: <Ionicons name='time-outline' size={20} color='white' />,
  },
  {
    label: 'Song Title',
    value: 'songName',
    icon: <Ionicons name='text-outline' size={20} color='white' />,
  },
  {
    label: 'Most Played',
    value: 'playedCount',
    icon: <Ionicons name='repeat-outline' size={20} color='white' />,
  },
  {
    label: 'Language',
    value: 'songLanguage',
    icon: <Ionicons name='language-outline' size={20} color='white' />,
  },
];

const searchSortOptions: SortOption[] = [
  {
    label: 'Most Relevant',
    value: 'relevance',
    icon: <Ionicons name='sparkles-outline' size={20} color='white' />,
  },
  ...baseSortOptions,
];

const SongHistory = () => {
  const api = useApi();
  const { user } = useUser();
  const { colors } = useTheme();
  const [songHistory, setSongHistory] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true); // New state for initial loading
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalSongs, setTotalSongs] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortBy, setSortBy] = useState('lastPlayedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [isFiltering, setIsFiltering] = useState(false);

  const activeSortOptions = debouncedSearchQuery ? searchSortOptions : baseSortOptions;

  const [currentDataPage, setCurrentDataPage] = useState(1);

  const searchInputRef = useRef<RNTextInput>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialLoadingRef = useRef(true);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      const nextQuery = searchQuery.trim();
      setDebouncedSearchQuery(nextQuery.length >= 2 ? nextQuery : '');
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery]);

  const getHistorySongs = useCallback(
    async (pageNum = 1, append = false) => {
      if (!user?.userid) return;

      const requestId = ++requestIdRef.current;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Only set full loading state on initial load
        if (pageNum === 1 && !append && initialLoadingRef.current) {
          setLoading(true);
        } else if (
          !append &&
          (debouncedSearchQuery || sortBy !== 'lastPlayedAt' || sortOrder !== 'DESC')
        ) {
          // Show the filtering indicator for search and sort operations
          setIsFiltering(true);
        }

        if (append) {
          setLoadingMore(true);
        }

        const response = await api.get('/api/music/latestHistory', {
          params: {
            page: pageNum,
            limit: ITEMS_PER_PAGE,
            searchQuery: debouncedSearchQuery,
            sortBy,
            sortOrder,
          },
          signal: controller.signal,
        });

        if (response.status === 200 && requestId === requestIdRef.current) {
          const { songs, count } = response.data.data;

          if (append) {
            setSongHistory((prevSongs) => [...prevSongs, ...songs]);
          } else {
            setSongHistory(songs);
          }

          setTotalSongs(count);
          setHasMore(pageNum * ITEMS_PER_PAGE < count);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Error fetching song history:', error);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          initialLoadingRef.current = false;
          setInitialLoading(false);
          setIsFiltering(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [user?.userid, api, debouncedSearchQuery, sortBy, sortOrder]
  );

  useEffect(() => {
    if (!user?.userid) return;

    setCurrentDataPage(1);
    void getHistorySongs(1, false);
  }, [debouncedSearchQuery, sortBy, sortOrder, user?.userid, getHistorySongs]);

  useEffect(() => {
    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentDataPage(1);
    void getHistorySongs(1, false);
  }, [getHistorySongs]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prevOrder) => (prevOrder === 'ASC' ? 'DESC' : 'ASC'));
  }, []);

  const handleSortSelect = useCallback((option: string) => {
    setSortBy(option);
    setShowSortModal(false);
  }, []);

  const loadMoreSongs = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentDataPage + 1;
    setCurrentDataPage(nextPage);
    void getHistorySongs(nextPage, true);
  }, [currentDataPage, getHistorySongs, hasMore, loadingMore]);

  const renderHeader = () => {
    return (
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBlock}>
            <TouchableOpacity
              accessibilityLabel='Go back'
              accessibilityRole='button'
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Feather name='chevron-left' size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Listening history
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                {totalSongs} {totalSongs === 1 ? 'track' : 'tracks'}
              </Text>
            </View>
          </View>
          <Button
            variant='ghost'
            size='icon'
            icon={<Feather name='sliders' size={21} color={colors.foreground} />}
            onPress={() => setShowSortModal(true)}
            accessibilityLabel='Sort listening history'
          />
        </View>
        <View style={styles.searchContainer}>
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder='Search songs, artists, albums'
            variant='filled'
            leftIcon={<Feather name='search' size={19} color={colors.mutedForeground} />}
            rightIcon={
              searchQuery ? (
                <TouchableOpacity
                  accessibilityLabel='Clear search'
                  accessibilityRole='button'
                  onPress={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <Feather name='x' size={19} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : undefined
            }
            autoFocus={false}
            returnKeyType='search'
          />
        </View>
      </View>
    );
  };

  const renderSortIndicator = () => {
    if (!sortBy || (sortBy === 'lastPlayedAt' && sortOrder === 'DESC')) return null;

    const currentSort = activeSortOptions.find((option) => option.value === sortBy);
    if (!currentSort) return null;

    const directionLabel =
      sortBy === 'lastPlayedAt'
        ? sortOrder === 'ASC'
          ? 'Oldest first'
          : 'Newest first'
        : sortBy === 'playedCount'
          ? sortOrder === 'ASC'
            ? 'Least played'
            : 'Most played'
          : sortOrder === 'ASC'
            ? 'A–Z'
            : 'Z–A';

    return (
      <View style={[styles.sortIndicator, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.sortText, { color: colors.secondaryForeground }]}>
          {currentSort.label} · {directionLabel}
        </Text>
        <TouchableOpacity style={styles.sortOrderButton} onPress={toggleSortOrder}>
          <Feather
            name={sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down'}
            size={16}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size='small' color={colors.primary} />
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        {debouncedSearchQuery ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No songs found matching "{debouncedSearchQuery}"
          </Text>
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            You haven't listened to any songs yet.
          </Text>
        )}
      </View>
    );
  };

  // Only show the full-screen loader for the initial load
  if (loading && initialLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.foreground }]}>
          Loading your music history...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      {renderSortIndicator()}

      {/* Common loader for search and filtering */}
      {(isFiltering || (loading && !initialLoading)) && (
        <View
          style={[
            styles.filteringIndicator,
            { backgroundColor: `${colors.primary}CC` }, // CC adds 80% opacity
          ]}
        >
          <ActivityIndicator
            size='small'
            color={colors.primaryForeground}
            style={styles.filteringLoader}
          />
          <Text style={[styles.filteringText, { color: colors.primaryForeground }]}>
            {debouncedSearchQuery ? 'Searching...' : 'Updating results...'}
          </Text>
        </View>
      )}

      <FlatList
        data={songHistory}
        renderItem={({ item }) => <SongCard song={item} />}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMoreSongs}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
      />

      {/* Sort Options Modal */}
      <SwipeableModal
        isVisible={showSortModal}
        onClose={() => setShowSortModal(false)}
        maxHeight='45%'
      >
        <View style={styles.sortModalContent}>
          <Text style={[styles.sortModalTitle, { color: colors.foreground }]}>Sort by</Text>

          {activeSortOptions.map((option) => (
            <View
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && [
                  styles.sortOptionSelected,
                  { backgroundColor: colors.secondary },
                ],
              ]}
            >
              <TouchableOpacity
                style={styles.sortOptionMain}
                onPress={() => handleSortSelect(option.value)}
              >
                <View style={styles.sortOptionIcon}>
                  {React.cloneElement(option.icon, { color: colors.foreground })}
                </View>
                <Text style={[styles.sortOptionText, { color: colors.foreground }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>

              {sortBy === option.value && (
                <TouchableOpacity
                  accessibilityLabel='Toggle sort direction'
                  accessibilityRole='button'
                  style={styles.sortDirectionButton}
                  onPress={toggleSortOrder}
                >
                  <Feather
                    name={sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <Button
            variant='secondary'
            title='Close'
            onPress={() => setShowSortModal(false)}
            className='mt-6'
          />
        </View>
      </SwipeableModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  headerTextGroup: {
    justifyContent: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 1,
  },
  searchContainer: {
    marginTop: 12,
  },
  sortIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sortText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sortOrderButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    minHeight: 300,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.7,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  filteringIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    top: 155,
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filteringLoader: {
    marginRight: 8,
  },
  filteringText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  sortModalContent: {
    padding: 20,
  },
  sortModalTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  sortOptionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sortOptionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 54,
  },
  sortOptionIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sortOptionText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  sortOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  sortDirectionButton: {
    padding: 8,
  },
});

export default SongHistory;
