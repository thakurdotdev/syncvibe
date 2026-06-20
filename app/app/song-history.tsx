import SwipeableModal from '@/components/common/SwipeableModal';
import { SongCard } from '@/components/music/MusicCards';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  icon: React.ReactNode;
};

type SortOrder = 'ASC' | 'DESC';

const sortOptions: SortOption[] = [
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
  const [showSearch, setShowSearch] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortBy, setSortBy] = useState('lastPlayedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [isFiltering, setIsFiltering] = useState(false);

  const [currentDataPage, setCurrentDataPage] = useState(1);

  const searchInputRef = useRef<RNTextInput>(null);
  const scrollY = new Animated.Value(0);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchQuery, songHistory.length]);

  useEffect(() => {
    if (user?.userid) {
      getHistorySongs(1, false);
    }
  }, [debouncedSearchQuery, sortBy, sortOrder, user?.userid]);

  const getHistorySongs = useCallback(
    async (pageNum = 1, append = false) => {
      if (!user?.userid) return;

      try {
        // Only set full loading state on initial load
        if (pageNum === 1 && !append && initialLoading) {
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
        });

        if (response.status === 200) {
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
        console.error('Error fetching song history:', error);
      } finally {
        setLoading(false);
        setInitialLoading(false); // Initial loading is done
        setIsFiltering(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [user?.userid, api, debouncedSearchQuery, sortBy, sortOrder, initialLoading]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentDataPage(1);
    getHistorySongs(1, false);
  }, [getHistorySongs]);

  const toggleSortOrder = useCallback(() => {
    setIsFiltering(true);
    setSortOrder((prevOrder) => (prevOrder === 'ASC' ? 'DESC' : 'ASC'));
  }, []);

  const handleSortSelect = useCallback((option: string) => {
    setIsFiltering(true);
    setSortBy(option);
    setShowSortModal(false);
  }, []);

  const toggleSearch = useCallback(() => {
    setShowSearch((prev) => {
      const newState = !prev;
      if (!newState) {
        // Reset search when hiding
        setSearchQuery('');
        setDebouncedSearchQuery('');
      } else {
        // Focus input when showing
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      return newState;
    });
  }, []);

  const loadMoreSongs = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = currentDataPage + 1;
    setCurrentDataPage(nextPage);
    getHistorySongs(nextPage, true);
  };

  const renderHeader = () => {
    const headerOpacity = scrollY.interpolate({
      inputRange: [0, 80, 120],
      outputRange: [1, 0.8, 0.8],
      extrapolate: 'clamp',
    });

    const searchScale = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [1, 0.95],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[styles.header, { opacity: headerOpacity }, { backgroundColor: colors.background }]}
      >
        {!showSearch ? (
          <>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Your Listening History
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                {totalSongs} tracks
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Button
                variant='ghost'
                size='icon'
                icon={<Feather name='search' size={22} color={colors.foreground} />}
                onPress={toggleSearch}
                style={{ marginLeft: 8 }}
              />
              <Button
                variant='ghost'
                size='icon'
                icon={<Feather name='sliders' size={22} color={colors.foreground} />}
                onPress={() => setShowSortModal(true)}
                style={{ marginLeft: 8 }}
              />
            </View>
          </>
        ) : (
          <Animated.View
            style={[
              styles.searchContainer,
              { transform: [{ scale: searchScale }] },
              { flexGrow: 1, width: '100%' },
            ]}
          >
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder='Search songs...'
              variant='filled'
              leftIcon={<Feather name='search' size={20} color={colors.mutedForeground} />}
              rightIcon={
                <TouchableOpacity onPress={toggleSearch}>
                  <Feather name='x' size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              }
              className='flex-1'
              autoFocus
            />
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  const renderSortIndicator = () => {
    if (!sortBy || sortBy === 'lastPlayedAt') return null;

    const currentSort = sortOptions.find((option) => option.value === sortBy);
    if (!currentSort) return null;

    return (
      <View style={[styles.sortIndicator, { backgroundColor: colors.secondary }]}>
        <Text style={[styles.sortText, { color: colors.secondaryForeground }]}>
          Sorted by: {currentSort.label}
          {sortOrder === 'ASC' ? ' (A-Z)' : ' (Z-A)'}
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
        keyExtractor={(item, index) => `${item.id}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, isFiltering && styles.dimmedContent]}
        onEndReached={loadMoreSongs}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: `${colors.border}33` }]} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
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

          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && [
                  styles.sortOptionSelected,
                  { backgroundColor: colors.secondary },
                ],
              ]}
              onPress={() => handleSortSelect(option.value)}
            >
              <View style={styles.sortOptionIcon}>
                {React.cloneElement(option.icon as React.ReactElement, {
                  color: colors.foreground,
                })}
              </View>
              <Text style={[styles.sortOptionText, { color: colors.foreground }]}>
                {option.label}
              </Text>

              {sortBy === option.value && (
                <TouchableOpacity style={styles.sortDirectionButton} onPress={toggleSortOrder}>
                  <Feather
                    name={sortOrder === 'ASC' ? 'arrow-up' : 'arrow-down'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
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
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'white',
    opacity: 0.7,
    fontSize: 16,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 8,
    alignItems: 'center',
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    padding: 8,
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
    paddingTop: 10,
    paddingBottom: 120,
  },
  dimmedContent: {
    opacity: 0.6,
  },
  separator: {
    height: 1,
    // backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 4,
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
    top: 120,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sortOptionSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
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
