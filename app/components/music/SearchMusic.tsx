import { usePlayerControls } from '@/stores/playerStore';
import { Song } from '@/types/song';
import { searchSongs } from '@/utils/api/getSongs';
import { useDebounce } from '@/utils/hooks/useDebounce';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatPlayCount = (count: number) => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M plays`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K plays`;
  }
  return `${count} plays`;
};

export default function SearchMusic() {
  const { playSong } = usePlayerControls();
  const [searchQuery, setSearchQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const securedSongs = useMemo(() => {
    return songs.map((song) => ensureHttpsForSongUrls(song));
  }, [songs]);

  const debouncedSearch = useDebounce(async (query: string) => {
    if (!query.trim()) {
      setSongs([]);
      return;
    }

    setIsLoading(true);
    setError('');

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

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const renderSongItem = ({ item }: { item: Song }) => {
    const song = ensureHttpsForSongUrls(item);

    return (
      <TouchableOpacity className='mb-3 mx-3' activeOpacity={0.7} onPress={() => playSong(song)}>
        <LinearGradient
          colors={['rgba(30, 30, 40, 0.8)', 'rgba(20, 20, 28, 0.9)']}
          className='rounded-xl overflow-hidden border border-gray-800/30'
        >
          <View className='flex-row items-center p-3'>
            <View className='w-14 h-14 rounded-lg overflow-hidden mr-3'>
              <Image
                source={{ uri: song.image[2]?.link || song.image[0]?.link }}
                className='w-full h-full'
                resizeMode='cover'
              />
              <BlurView intensity={10} tint='dark' className='absolute inset-0 opacity-25' />
            </View>

            <View className='flex-1 pr-2'>
              <Text className='text-base font-semibold text-white mb-1' numberOfLines={1}>
                {song.name}
              </Text>
              <Text className='text-sm text-gray-300 mb-1.5' numberOfLines={1}>
                {song.subtitle}
              </Text>
              <View className='flex-row items-center'>
                <Ionicons name='play-circle-outline' size={14} color='#9CA3AF' />
                <Text className='text-xs text-gray-400 ml-1'>
                  {formatPlayCount(song.play_count)}
                </Text>
                <Text className='text-gray-400 mx-2'>•</Text>
                <Ionicons name='time-outline' size={14} color='#9CA3AF' />
                <Text className='text-xs text-gray-400 ml-1'>{formatDuration(song.duration)}</Text>
              </View>
            </View>

            <TouchableOpacity
              className='p-2.5 rounded-full bg-green-500/90'
              onPress={() => playSong(song)}
            >
              <Ionicons name='play' size={18} color='#fff' />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View className='flex-1 bg-zinc-900'>
      <View className='p-4 pb-2'>
        <View className='flex-row items-center bg-white/8 rounded-xl px-3.5 h-12 border border-white/10'>
          <Ionicons name='search' size={18} color='#9CA3AF' />
          <TextInput
            className='flex-1 h-12 px-3 text-white'
            placeholder='Search for songs...'
            placeholderTextColor='#9CA3AF'
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType='search'
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')} className='p-2'>
              <Ionicons name='close-circle' size={18} color='#9CA3AF' />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator size='small' color='#10B981' />
          <Text className='text-gray-400 mt-3 text-sm'>Searching...</Text>
        </View>
      ) : error ? (
        <View className='flex-1 items-center justify-center p-4'>
          <View className='p-3 rounded-full bg-red-500/10'>
            <Ionicons name='alert-circle' size={32} color='#EF4444' />
          </View>
          <Text className='text-red-400 mt-4 text-base font-medium'>{error}</Text>
          <TouchableOpacity
            className='mt-4 px-5 py-2.5 bg-white/10 rounded-lg'
            onPress={() => handleSearch(searchQuery)}
          >
            <Text className='text-white font-medium'>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={securedSongs}
          renderItem={renderSongItem}
          keyExtractor={(item) => item.id}
          className='flex-1'
          contentContainerClassName='pt-1 pb-24'
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            searchQuery ? (
              <View className='flex-1 items-center justify-center p-8 mt-10'>
                <View className='p-4 rounded-full bg-zinc-800/50'>
                  <Ionicons name='search' size={32} color='#9CA3AF' />
                </View>
                <Text className='text-gray-300 mt-4 text-center font-medium'>
                  No songs found for "{searchQuery}"
                </Text>
                <Text className='text-gray-500 mt-1 text-center text-sm'>
                  Try a different search term
                </Text>
              </View>
            ) : (
              <View className='flex-1 items-center justify-center p-8 mt-10'>
                <View className='p-4 rounded-full bg-zinc-800/50'>
                  <Ionicons name='musical-notes' size={32} color='#10B981' />
                </View>
                <Text className='text-gray-300 mt-4 text-center font-medium'>
                  Find your favorite music
                </Text>
                <Text className='text-gray-500 mt-1 text-center text-sm'>
                  Search for artists, songs, or albums
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}
