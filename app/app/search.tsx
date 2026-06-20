import { styles } from '@/assets/styles/search.style';
import { SongCard } from '@/components/music/MusicCards';
import SearchHistory from '@/components/music/SearchHistory';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { searchSongs } from '@/utils/api/getSongs';
import { useDebounce } from '@/utils/hooks/useDebounce';
import { SearchHistoryItem, searchHistoryManager } from '@/utils/searchHistory';
import { Feather, Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated as RNAnimated,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchMusic() {
  const { colors, theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [historyKey, setHistoryKey] = useState(0); // For refreshing history component
  const [searchSuggestions, setSearchSuggestions] = useState<SearchHistoryItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const scrollY = new RNAnimated.Value(0);
  const inputRef = useRef<TextInput>(null);

  const debouncedSearch = useDebounce(async (query: string) => {
    if (!query.trim()) {
      setSongs([]);
      setShowHistory(true);
      return;
    }

    setIsLoading(true);
    setError('');
    setShowHistory(false);

    try {
      const results = await searchSongs(query);
      setSongs(results);
    } catch (err) {
      setError('Failed to search songs');
      setSongs([]);
    } finally {
      setIsLoading(false);
    }
  }, 500);
  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);

      // Show suggestions while typing (but not for empty queries)
      if (text.trim().length > 0 && text.trim().length < 3) {
        setShowSuggestions(true);
        setShowHistory(false);
        loadSearchSuggestions(text.trim());
      } else {
        setShowSuggestions(false);
        if (text.trim().length === 0) {
          setShowHistory(true);
        }
      }

      debouncedSearch(text);
    },
    [debouncedSearch]
  );

  const loadSearchSuggestions = useCallback(async (query: string) => {
    try {
      const filtered = await searchHistoryManager.getHistory(query);
      setSearchSuggestions(filtered.slice(0, 5));
    } catch (error) {
      console.error('Error loading search suggestions:', error);
      setSearchSuggestions([]);
    }
  }, []);

  const handleHistoryItemPress = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setShowSuggestions(false);
      inputRef.current?.blur(); // Hide keyboard
      debouncedSearch(query);
    },
    [debouncedSearch]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSongs([]);
    setShowHistory(true);
    setShowSuggestions(false);
    setError('');
    setHistoryKey((prev) => prev + 1); // Refresh history
    inputRef.current?.focus();
  }, []);

  // Handle input focus to show history
  const handleInputFocus = useCallback(() => {
    if (!searchQuery.trim()) {
      setShowHistory(true);
    }
  }, [searchQuery]);

  // Handle keyboard dismiss
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (!searchQuery.trim()) {
        setShowHistory(true);
        setShowSuggestions(false);
      }
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [searchQuery]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.setValue(event.nativeEvent.contentOffset.y);
  };

  const renderHeader = () => {
    const headerOpacity = scrollY.interpolate({
      inputRange: [0, 80, 120],
      outputRange: [1, 0.8, 0.8],
      extrapolate: 'clamp',
    });

    const searchScale = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [1, 0.98],
      extrapolate: 'clamp',
    });

    return (
      <RNAnimated.View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            opacity: headerOpacity,
          },
        ]}
      >
        <RNAnimated.View
          style={[
            styles.searchContainer,
            {
              transform: [{ scale: searchScale }],
              backgroundColor:
                theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
            },
          ]}
        >
          <Feather
            name='search'
            size={20}
            color={colors.mutedForeground}
            style={styles.searchIcon}
          />
          <TextInput
            ref={inputRef}
            className='flex-1'
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder='Search for songs...'
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={handleInputFocus}
            returnKeyType='search'
            autoCapitalize='none'
            autoFocus
          />
          {searchQuery ? (
            <Animated.View
              entering={SlideInRight.duration(200)}
              exiting={SlideOutLeft.duration(200)}
            >
              <TouchableOpacity
                onPress={clearSearch}
                style={[styles.clearButton]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  style={[
                    styles.clearButtonInner,
                    {
                      backgroundColor:
                        theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
                    },
                  ]}
                >
                  <Feather name='x' size={16} color={colors.foreground} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </RNAnimated.View>
      </RNAnimated.View>
    );
  };

  const renderEmptyState = () => {
    if (showSuggestions) {
      return (
        <Animated.View
          style={styles.historyContainer}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
                Suggestions
              </Text>
            </View>
            {searchSuggestions.map((item, index) => (
              <Animated.View key={item.id} entering={FadeIn.delay(index * 50)}>
                <TouchableOpacity
                  style={[
                    styles.historyItem,
                    {
                      backgroundColor:
                        theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
                    },
                  ]}
                  onPress={() => handleHistoryItemPress(item.query)}
                  activeOpacity={0.7}
                >
                  <View style={styles.historyItemContent}>
                    <Feather
                      name='search'
                      size={16}
                      color={colors.mutedForeground}
                      style={styles.historyItemIcon}
                    />
                    <Text
                      style={[styles.historyItemText, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.query}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      );
    }

    if (showHistory) {
      return (
        <SearchHistory
          key={historyKey}
          onHistoryItemPress={handleHistoryItemPress}
          currentQuery={searchQuery}
        />
      );
    }

    if (searchQuery) {
      return (
        <Animated.View
          style={styles.emptyContainer}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondary }]}>
            <Feather name='search' size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No results for "{searchQuery}"
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Try different keywords or check your spelling
          </Text>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={styles.emptyContainer}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondary }]}>
          <Ionicons name='musical-notes' size={32} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search for music</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Find artists, songs, and albums
        </Text>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }: { item: Song; index: number }) => (
    <Animated.View
      entering={FadeIn.delay(index * 50)}
      exiting={FadeOut.delay(index * 50)}
      layout={LinearTransition.springify()}
    >
      <SongCard
        song={item}
        onPress={async () => {
          // Track that user clicked on a song from this search query
          if (searchQuery.trim()) {
            await searchHistoryManager.addToHistoryOnSongClick(searchQuery.trim());
          }
        }}
      />
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor='transparent'
        translucent
      />

      {renderHeader()}

      {isLoading ? (
        <Animated.View
          style={styles.loadingContainer}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <ActivityIndicator size='small' color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Searching for "{searchQuery}"...
          </Text>
        </Animated.View>
      ) : error ? (
        <Animated.View
          style={styles.errorContainer}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <View style={[styles.errorIconContainer, { backgroundColor: colors.secondary }]}>
            <Ionicons name='alert-circle' size={32} color={colors.primary} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>{error}</Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              {
                backgroundColor:
                  theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
              },
            ]}
            onPress={() => handleSearch(searchQuery)}
          >
            <Text style={[styles.retryButtonText, { color: colors.foreground }]}>Try Again</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <>
          {showHistory || showSuggestions ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={songs}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={renderEmptyState}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              removeClippedSubviews={true}
              initialNumToRender={10}
              maxToRenderPerBatch={5}
              windowSize={10}
              ItemSeparatorComponent={() => <View className='h-3' />}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
