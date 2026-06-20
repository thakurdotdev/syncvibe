import { SongCard } from '@/components/music/MusicCards';
import Button from '@/components/ui/button';
import { usePlayerControls } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { convertToHttps } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type PlaylistSong = {
  id: string;
  songData: any; // Your song type
};

type PlaylistData = {
  id: string;
  name: string;
  description: string;
  userId: number;
  createdat: string;
  image: { link: string }[] | string;
  songs: PlaylistSong[];
};

export default function UserPlaylistDetails() {
  const api = useApi();
  const { colors, theme } = useTheme();
  const { id } = useLocalSearchParams();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToPlaylist, playSong } = usePlayerControls();
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const fetchPlaylistData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/api/playlist/details`, {
        params: { id },
      });
      setPlaylistData(response.data.data);
    } catch (error) {
      console.error('Error fetching playlist data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPlaylistData();
    }
  }, [id, fetchPlaylistData]);

  const handlePlayAll = useCallback(() => {
    if (playlistData?.songs?.length) {
      addToPlaylist(playlistData.songs.map((s) => s.songData));
      playSong(playlistData.songs[0].songData);
    }
  }, [playlistData, addToPlaylist, playSong]);

  const handleShuffle = useCallback(() => {
    if (playlistData?.songs?.length) {
      const shuffledSongs = [...playlistData.songs]
        .map((s) => s.songData)
        .sort(() => Math.random() - 0.5);
      addToPlaylist(shuffledSongs);
      playSong(shuffledSongs[0]);
    }
  }, [playlistData, addToPlaylist, playSong]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerHeight = useMemo(() => Math.min(width * 0.8, 250), [width]);
  const imageSize = useMemo(() => Math.min(width * 0.4, 160), [width]);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, headerHeight * 0.5, headerHeight],
      [1, 0.8, 0],
      Extrapolation.CLAMP
    );

    const scale = interpolate(scrollY.value, [0, headerHeight], [1, 0.85], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [
        { scale },
        {
          translateY: interpolate(scrollY.value, [0, headerHeight], [0, -50], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(scrollY.value, [0, headerHeight], [1, 0.9], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const getBgUrl = useMemo(() => {
    if (!playlistData?.image) return '';
    return Array.isArray(playlistData.image) ? playlistData.image[2]?.link : playlistData.image;
  }, [playlistData]);

  // Get gradient colors based on theme
  const getGradientColors = useMemo(() => {
    return theme === 'dark'
      ? colors.gradients.background
      : ['rgba(30, 30, 30, 0.9)', 'rgba(18, 18, 18, 0.95)'];
  }, [theme, colors]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading playlist...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.FlatList
        data={playlistData?.songs}
        renderItem={({ item }) => <SongCard song={item.songData} />}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.separator]} />}
        contentContainerStyle={styles.listContent}
        style={{ paddingHorizontal: 20 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <Animated.View
              style={[{ height: headerHeight }, styles.headerContainer, headerAnimatedStyle]}
            >
              <LinearGradient
                colors={getGradientColors}
                style={[styles.headerGradient, { height: headerHeight }]}
              >
                <Image
                  source={{ uri: convertToHttps(getBgUrl) }}
                  style={[styles.backgroundImage, { height: headerHeight }]}
                  blurRadius={30}
                />
                <BlurView
                  intensity={80}
                  tint={theme === 'dark' ? 'dark' : 'light'}
                  style={styles.blurOverlay}
                >
                  <View style={styles.headerContent}>
                    <Animated.View style={imageAnimatedStyle}>
                      <Image
                        source={{ uri: convertToHttps(getBgUrl) }}
                        style={[styles.playlistImage, { width: imageSize, height: imageSize }]}
                        resizeMode='cover'
                      />
                    </Animated.View>
                    <View style={styles.infoContainer}>
                      <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={2}>
                        {playlistData?.name}
                      </Text>
                      <Text
                        style={[styles.description, { color: colors.mutedForeground }]}
                        numberOfLines={3}
                      >
                        {playlistData?.description || 'No description'}
                      </Text>
                      <View style={styles.statsContainer}>
                        <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                          {playlistData?.songs?.length || 0} songs
                        </Text>
                        <View
                          style={[styles.statDivider, { backgroundColor: colors.mutedForeground }]}
                        />
                        <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                          {new Date(playlistData?.createdat || '').toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </BlurView>
              </LinearGradient>
            </Animated.View>

            {/* Action buttons */}
            <View style={styles.actionsContainer}>
              <Button
                onPress={handlePlayAll}
                disabled={!playlistData?.songs?.length}
                title='Play All'
                icon={<Ionicons name='play' size={22} color={colors.primaryForeground} />}
                iconPosition='left'
                variant='default'
                size='default'
              />
              <Button
                onPress={handleShuffle}
                disabled={!playlistData?.songs?.length}
                title='Shuffle'
                icon={<Ionicons name='shuffle' size={22} color={colors.text} />}
                iconPosition='left'
                variant='outline'
                size='default'
              />
            </View>

            {/* Songs header */}
            {playlistData?.songs?.length ? (
              <View style={styles.songsHeader}>
                <Text style={[styles.songsHeaderText, { color: colors.text }]}>Songs</Text>
              </View>
            ) : (
              <View style={styles.emptySongsContainer}>
                <Ionicons name='musical-note' size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptySongsText, { color: colors.mutedForeground }]}>
                  No songs in this playlist yet
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptySongsContainer}>
            <Ionicons name='musical-note' size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptySongsText, { color: colors.mutedForeground }]}>
              No songs in this playlist yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

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
    marginTop: 16,
    fontSize: 16,
  },
  headerContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerGradient: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    opacity: 0.6,
  },
  blurOverlay: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  playlistImage: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  playlistName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statText: {
    fontSize: 13,
  },
  statDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  songsHeader: {
    paddingBottom: 16,
  },
  songsHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    marginVertical: 5,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptySongsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptySongsText: {
    fontSize: 16,
    marginTop: 12,
  },
});
