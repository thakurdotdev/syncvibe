import { styles } from '@/assets/styles/search.style';
import { useTheme } from '@/context/ThemeContext';
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface SearchSuggestionsProps {
  onSuggestionPress: (suggestion: string) => void;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({ onSuggestionPress }) => {
  const { colors, theme } = useTheme();

  const trendingSuggestions = [
    { text: 'Latest hits', icon: 'trending-up' },
    { text: 'Bollywood songs', icon: 'music' },
    { text: 'English pop', icon: 'headphones' },
    { text: 'Party playlist', icon: 'zap' },
    { text: 'Romantic songs', icon: 'heart' },
    { text: 'Workout music', icon: 'activity' },
  ] as const;

  return (
    <View style={styles.historyContainer}>
      <Animated.View style={styles.historySection} entering={FadeIn.duration(300)}>
        <View style={styles.historySectionHeader}>
          <Text style={[styles.historySectionTitle, { color: colors.foreground }]}>
            Trending Searches
          </Text>
        </View>

        <View style={styles.suggestionsContainer}>
          {trendingSuggestions.map((suggestion, index) => (
            <Animated.View key={suggestion.text} entering={FadeIn.delay(index * 100)}>
              <TouchableOpacity
                style={[
                  styles.suggestionChip,
                  {
                    borderColor: colors.border,
                    backgroundColor:
                      theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  },
                ]}
                onPress={() => onSuggestionPress(suggestion.text)}
              >
                <Feather
                  name={suggestion.icon}
                  size={14}
                  color={colors.mutedForeground}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.suggestionChipText, { color: colors.foreground }]}>
                  {suggestion.text}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

export default SearchSuggestions;
