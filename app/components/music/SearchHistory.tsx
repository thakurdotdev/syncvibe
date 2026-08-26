import { styles } from '@/assets/styles/search.style';
import { useTheme } from '@/context/ThemeContext';
import { SearchHistoryItem, searchHistoryManager } from '@/utils/searchHistory';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import SearchSuggestions from './SearchSuggestions';

interface SearchHistoryProps {
  onHistoryItemPress: (query: string) => void;
  currentQuery?: string;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ onHistoryItemPress, currentQuery }) => {
  const { colors, theme } = useTheme();
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const recent = await searchHistoryManager.getRecentSearches(currentQuery, 10);
      setSearchHistory(recent);
    } catch (error) {
      console.error('Error loading search history:', error);
    } finally {
      setLoading(false);
    }
  }, [currentQuery]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRemoveItem = useCallback(
    async (item: SearchHistoryItem) => {
      try {
        // Optimistically remove from UI first
        setSearchHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));

        // Then remove from storage
        await searchHistoryManager.removeHistoryItem(item.id);
      } catch (error) {
        console.error('Error removing history item:', error);
        // Reload on error to ensure consistency
        await loadHistory();
      }
    },
    [loadHistory]
  );

  const handleClearHistory = useCallback(() => {
    Alert.alert('Clear Search History', 'Are you sure you want to clear all your search history?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await searchHistoryManager.clearHistory();
            setSearchHistory([]);
          } catch (error) {
            console.error('Error clearing history:', error);
          }
        },
      },
    ]);
  }, []);

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString();
  };

  const renderHistoryItem = (item: SearchHistoryItem, index: number) => (
    <Animated.View
      key={item.id}
      entering={FadeIn.delay(index * 50)}
      layout={LinearTransition.springify()}
    >
      <TouchableOpacity
        style={[
          styles.historyItem,
          {
            backgroundColor:
              theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
          },
        ]}
        onPress={() => onHistoryItemPress(item.query)}
        activeOpacity={0.7}
      >
        <View style={styles.historyItemContent}>
          <Feather
            name='clock'
            size={16}
            color={colors.mutedForeground}
            style={styles.historyItemIcon}
          />
          <Text style={[styles.historyItemText, { color: colors.foreground }]} numberOfLines={1}>
            {item.query}
          </Text>
        </View>

        <View style={styles.historyItemMeta}>
          <Text style={[styles.historyItemTime, { color: colors.mutedForeground }]}>
            {formatTimeAgo(item.timestamp)}
          </Text>

          <TouchableOpacity
            style={[
              styles.historyItemRemove,
              {
                backgroundColor:
                  theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
              },
            ]}
            onPress={() => handleRemoveItem(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name='x' size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSuggestions = () => {
    const suggestions = ['Popular hits', 'Latest songs', 'Trending now', 'Your favorites'];

    return (
      <View style={styles.suggestionsContainer}>
        {suggestions.map((suggestion, index) => (
          <Animated.View key={suggestion} entering={FadeIn.delay(index * 100)}>
            <TouchableOpacity
              style={[
                styles.suggestionChip,
                {
                  borderColor: colors.border,
                  backgroundColor:
                    theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
                },
              ]}
              onPress={() => onHistoryItemPress(suggestion)}
            >
              <Text style={[styles.suggestionChipText, { color: colors.foreground }]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderNoHistory = () => <SearchSuggestions onSuggestionPress={onHistoryItemPress} />;

  if (loading) {
    return null; // Or return a skeleton loader
  }

  const hasHistory = searchHistory.length > 0;

  if (!hasHistory) {
    return renderNoHistory();
  }

  return (
    <ScrollView
      style={styles.historyContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps='handled'
    >
      {/* Search History */}
      <Animated.View style={styles.historySection} entering={FadeIn.duration(300)}>
        <View style={styles.historySectionHeader}>
          <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
            Recent Searches
          </Text>
          <TouchableOpacity
            style={[
              styles.clearHistoryButton,
              {
                backgroundColor:
                  theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
              },
            ]}
            onPress={handleClearHistory}
          >
            <Text style={[styles.clearHistoryText, { color: colors.mutedForeground }]}>Clear</Text>
          </TouchableOpacity>
        </View>
        {searchHistory.map((item, index) => renderHistoryItem(item, index))}
      </Animated.View>

      {/* Quick Suggestions */}
      <Animated.View
        style={[styles.historySection, { marginBottom: 40 }]}
        entering={FadeIn.duration(300).delay(100)}
      >
        <View style={styles.historySectionHeader}>
          <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
            Quick Suggestions
          </Text>
        </View>
        {renderSuggestions()}
      </Animated.View>
    </ScrollView>
  );
};

export default SearchHistory;
