import { styles } from '@/assets/styles/search.style';
import { SongCard } from '@/components/music/MusicCards';
import SearchHistory from '@/components/music/SearchHistory';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { searchSongs } from '@/utils/api/getSongs';
import { SearchHistoryItem, searchHistoryManager } from '@/utils/searchHistory';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchMusic() {
  const { colors, theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [historyKey, setHistoryKey] = useState(0);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchHistoryItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const executeSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSongs([]);
      setIsLoading(false);
      setShowHistory(true);
      setError('');
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError('');
    setShowHistory(false);
    setShowSuggestions(false);

    try {
      const results = await searchSongs(query);
      setSongs(results);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError('Failed to search songs. Please try again.');
        setSongs([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (text.trim().length === 0) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        abortRef.current?.abort();
        setSongs([]);
        setIsLoading(false);
        setError('');
        setShowHistory(true);
        setShowSuggestions(false);
        return;
      }

      if (text.trim().length > 0 && text.trim().length < 3) {
        setShowSuggestions(true);
        setShowHistory(false);
        loadSearchSuggestions(text.trim());
      } else {
        setShowSuggestions(false);
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => executeSearch(text), 450);
    },
    [executeSearch]
  );

  const loadSearchSuggestions = useCallback(async (query: string) => {
    try {
      const filtered = await searchHistoryManager.getHistory(query);
      setSearchSuggestions(filtered.slice(0, 5));
    } catch {
      setSearchSuggestions([]);
    }
  }, []);

  const handleHistoryItemPress = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setShowSuggestions(false);
      inputRef.current?.blur();
      executeSearch(query);
    },
    [executeSearch]
  );

  const clearSearch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    abortRef.current?.abort();
    setSearchQuery('');
    setSongs([]);
    setIsLoading(false);
    setError('');
    setShowHistory(true);
    setShowSuggestions(false);
    setHistoryKey((prev) => prev + 1);
    inputRef.current?.focus();
  }, []);

  const handleInputFocus = useCallback(() => {
    if (!searchQuery.trim()) setShowHistory(true);
  }, [searchQuery]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (!searchQuery.trim()) {
        setShowHistory(true);
        setShowSuggestions(false);
      }
    });
    return () => sub.remove();
  }, [searchQuery]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor:
              theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
          },
        ]}
      >
        <Feather name='search' size={20} color={colors.mutedForeground} style={styles.searchIcon} />
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
          autoCorrect={false}
          autoFocus
        />
        {isLoading && searchQuery.length > 0 && (
          <ActivityIndicator size='small' color={colors.primary} style={{ marginRight: 6 }} />
        )}
        {searchQuery && !isLoading ? (
          <TouchableOpacity
            onPress={clearSearch}
            style={styles.clearButton}
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
        ) : null}
      </View>
    </View>
  );

  const renderSuggestions = () => {
    if (!showSuggestions || searchSuggestions.length === 0) return null;
    return (
      <View style={[styles.historyContainer, { flex: 1 }]}>
        <View style={styles.historySection}>
          <View style={styles.historySectionHeader}>
            <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
              Suggestions
            </Text>
          </View>
          {searchSuggestions.map((item) => (
            <TouchableOpacity
              key={item.id}
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
          ))}
        </View>
      </View>
    );
  };

  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;
    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondary }]}>
            <Feather name='search' size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No results for "{searchQuery}"
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Try different keywords or check your spelling
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: colors.secondary }]}>
          <Ionicons name='musical-notes' size={32} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search for music</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Find artists, songs, and albums
        </Text>
      </View>
    );
  }, [isLoading, searchQuery, colors]);

  const renderItem = useCallback(
    ({ item }: { item: Song }) => (
      <SongCard
        song={item}
        onPress={async () => {
          if (searchQuery.trim()) {
            await searchHistoryManager.addToHistoryOnSongClick(searchQuery.trim());
          }
        }}
      />
    ),
    [searchQuery]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 82,
      offset: 82 * index,
      index,
    }),
    []
  );

  const Separator = useCallback(() => <View style={{ height: 10 }} />, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor='transparent'
        translucent
      />

      {renderHeader()}

      {error ? (
        <View style={styles.errorContainer}>
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
            onPress={() => executeSearch(searchQuery)}
          >
            <Text style={[styles.retryButtonText, { color: colors.foreground }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : showSuggestions ? (
        renderSuggestions()
      ) : showHistory ? (
        <SearchHistory
          key={historyKey}
          onHistoryItemPress={handleHistoryItemPress}
          currentQuery={searchQuery}
        />
      ) : isLoading ? (
        <Animated.View style={styles.loadingContainer} entering={FadeIn.duration(120)}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Searching...</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={songs}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          scrollEventThrottle={16}
          ItemSeparatorComponent={Separator}
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={8}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode='on-drag'
        />
      )}
    </SafeAreaView>
  );
}
