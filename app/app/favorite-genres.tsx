import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { router } from 'expo-router';
import { MusicIcon, CheckIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, ScrollView, FlatList, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';

const GENRES = [
  'Pop',
  'Rock',
  'Hip Hop',
  'R&B',
  'Electronic',
  'Jazz',
  'Classical',
  'Country',
  'Metal',
  'Folk',
  'Blues',
  'Reggae',
  'Indie',
  'Alternative',
  'Punk',
  'Soul',
  'Funk',
  'Latin',
  'World',
  'Gospel',
];

export default function FavoriteGenresScreen() {
  const { user } = useUser();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedGenres, setSelectedGenres] = useState<string[]>(user?.favoriteGenres || []);

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSave = async () => {
    try {
      router.back();
    } catch (error) {
      console.error('Error updating favorite genres:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Math.max(insets.bottom, 20),
        }}
      >
        <View style={{ gap: 20 }}>
          <FlatList
            data={GENRES}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={{ gap: 12 }}
            columnWrapperStyle={{ gap: 12 }}
            renderItem={({ item: genre }) => (
              <Button
                onPress={() => handleGenreToggle(genre)}
                variant={selectedGenres.includes(genre) ? 'default' : 'outline'}
                size='sm'
                style={{
                  flex: 1,
                  minHeight: 60,
                  flexDirection: 'row',
                  gap: 8,
                  paddingHorizontal: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {selectedGenres.includes(genre) && (
                    <CheckIcon size={14} color={colors.primaryForeground} />
                  )}
                </View>
                <Text
                  style={{
                    color: selectedGenres.includes(genre)
                      ? colors.primaryForeground
                      : colors.primary,
                    fontSize: 14,
                    fontWeight: '500',
                  }}
                >
                  {genre}
                </Text>
              </Button>
            )}
            keyExtractor={(item) => item}
          />

          <Button onPress={handleSave} variant='default' size='lg' style={{ marginTop: 20 }}>
            Save Changes
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
