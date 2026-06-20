import { useUser } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, ChevronRight, Music, X, Search } from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { Alert, Animated, ScrollView, Text, View, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';

const validLangs = [
  'hindi',
  'maithili',
  'bhojpuri',
  'english',
  'gujarati',
  'punjabi',
  'tamil',
  'telugu',
  'marathi',
  'bengali',
  'kannada',
  'malayalam',
  'urdu',
  'haryanvi',
  'rajasthani',
  'odia',
  'assamese',
];

const { width } = Dimensions.get('window');
const BUTTON_WIDTH = (width - 48) / 2; // 48 = padding (16) * 2 + gap (16)

const LanguagePreference = () => {
  const { selectedLanguages, setSelectedLanguages } = useUser();
  const { colors } = useTheme();
  const [selectedLangs, setSelectedLangs] = useState(
    new Set(selectedLanguages.split(',') || ['hindi'])
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLangs = useMemo(() => {
    return validLangs.filter((lang) => lang.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  const handleLanguageToggle = (lang: string) => {
    setSelectedLangs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        if (newSet.size > 1) {
          newSet.delete(lang);
        }
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  };

  const handleContinue = async () => {
    await AsyncStorage.setItem('language-preferance', Array.from(selectedLangs).join(','));
    setSelectedLanguages(Array.from(selectedLangs).join(','));
    Alert.alert('SyncVibe', 'Music preferences updated successfully');
  };

  return (
    <View className='flex-1' style={{ backgroundColor: colors.background }}>
      <Animated.View className='flex flex-col px-5'>
        <Card className='mb-4'>
          <CardHeader>
            <View
              className='flex-row items-center px-3 py-2 rounded-lg mb-4'
              style={{ backgroundColor: colors.secondary }}
            >
              <Search size={18} color={colors.mutedForeground} />
              <TextInput
                className='flex-1 ml-2 text-base'
                placeholder='Search languages...'
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{ color: colors.foreground }}
              />
            </View>
          </CardHeader>

          <CardContent>
            <ScrollView
              className='h-[55vh]'
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {filteredLangs.map((lang) => (
                  <View key={lang} style={{ width: '48%' }}>
                    <Button
                      variant={selectedLangs.has(lang) ? 'default' : 'outline'}
                      size='lg'
                      onPress={() => handleLanguageToggle(lang)}
                      icon={
                        selectedLangs.has(lang) ? (
                          <View className='bg-white rounded-full p-1' style={{ marginLeft: 8 }}>
                            <Check size={14} color={colors.primary} />
                          </View>
                        ) : undefined
                      }
                      iconPosition='right'
                    >
                      <Text
                        className='capitalize text-base'
                        style={{
                          color: selectedLangs.has(lang)
                            ? colors.primaryForeground
                            : colors.primary,
                        }}
                      >
                        {lang}
                      </Text>
                    </Button>
                  </View>
                ))}
              </View>
            </ScrollView>
          </CardContent>
        </Card>

        <Button
          variant='default'
          size='lg'
          onPress={handleContinue}
          className='mt-4'
          icon={<ChevronRight size={20} color={colors.primaryForeground} />}
          iconPosition='right'
        >
          Save Preferences
        </Button>
      </Animated.View>
    </View>
  );
};

export default LanguagePreference;
