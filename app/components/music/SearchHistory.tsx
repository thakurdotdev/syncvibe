import PressableScale from '@/components/ui/PressableScale';
import { styles } from '@/assets/styles/search.style';
import { useTheme } from '@/context/ThemeContext';
import { SearchHistoryItem, searchHistoryManager } from '@/utils/searchHistory';
import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import SearchSuggestions from './SearchSuggestions';

/** Closes the gap a removed search leaves behind. */
const ROW_REFLOW = LinearTransition.duration(180);

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

  const renderHistoryItem = (item: SearchHistoryItem) => (
    <Animated.View key={item.id} layout={ROW_REFLOW}>
      <PressableScale
        style={[
          styles.historyItem,
          {
            backgroundColor:
              theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
          },
        ]}
        onPress={() => onHistoryItemPress(item.query)}
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

          <PressableScale
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
          </PressableScale>
        </View>
      </PressableScale>
    </Animated.View>
  );

  const renderSuggestions = () => {
    const suggestions = ['Popular hits', 'Latest songs', 'Trending now', 'Your favorites'];

    return (
      <View style={styles.suggestionsContainer}>
        {suggestions.map((suggestion) => (
          <View key={suggestion}>
            <PressableScale
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
            </PressableScale>
          </View>
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
      <View style={styles.historySection}>
        <View style={styles.historySectionHeader}>
          <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
            Recent Searches
          </Text>
          <PressableScale
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
          </PressableScale>
        </View>
        {searchHistory.map(renderHistoryItem)}
      </View>

      {/* Quick Suggestions */}
      <View style={[styles.historySection, { marginBottom: 40 }]}>
        <View style={styles.historySectionHeader}>
          <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
            Quick Suggestions
          </Text>
        </View>
        {renderSuggestions()}
      </View>
    </ScrollView>
  );
};

export default SearchHistory;
