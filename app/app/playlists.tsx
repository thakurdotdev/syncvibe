import { SongCard } from '@/components/music/MusicCards';
import Button from '@/components/ui/button';
import { SONG_URL } from '@/constants';
import { usePlayerControls } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { Song } from '@/types/song';
import { convertToHttps, ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

interface PlaylistData {
  id: string;
  name: string;
  header_desc: string;
  image: string;
  list_count: number;
  follower_count: number;
  songs: Song[];
}

export default function PlaylistScreen() {
  const { colors, theme } = useTheme();
  const { id } = useLocalSearchParams();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const { addToPlaylist, playSong } = usePlayerControls();
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const fetchPlaylistData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SONG_URL}/playlist?id=${id}`);
      const data = response.data;
      setPlaylistData(data.data);
    } catch (error) {
      console.error('Error fetching playlist data:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPlaylistData();
    }
  }, [id, fetchPlaylistData]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const formatCount = useCallback((count: any) => {
    if (count === undefined || count === null) return 'N/A';
    if (count >= 1000000000) return (count / 1000000000).toFixed(1) + 'B';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }, []);

  const headerHeight = useMemo(() => Math.min(width * 0.8, 250), [width]);
  const imageSize = useMemo(() => Math.min(width * 0.4, 240), [width]);

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

  const newSongs = useMemo(() => {
    if (!playlistData?.songs) return [];
    return playlistData?.songs?.map(ensureHttpsForSongUrls) || [];
  }, [playlistData?.songs]);

  const handlePlayAll = () => {
    if (newSongs?.length) {
      const songsWithPlaylistInfo = newSongs.map((song) => ({
        ...song,
        isPlaylist: true,
        playlistId: playlistData?.id,
      }));
      addToPlaylist(songsWithPlaylistInfo);
      playSong(songsWithPlaylistInfo[0]);
    }
  };

  const handleShuffle = () => {
    if (newSongs?.length) {
      const shuffledSongs = [...newSongs]
        .sort(() => Math.random() - 0.5)
        .map((song) => ({
          ...song,
          isPlaylist: true,
          playlistId: playlistData?.id,
        }));
      addToPlaylist(shuffledSongs);
      playSong(shuffledSongs[0]);
    }
  };

  // Get gradient colors based on theme
  const getGradientColors = useMemo(() => {
    return theme === 'dark'
      ? colors.gradients.background
      : ['rgba(30, 30, 30, 0.9)', 'rgba(18, 18, 18, 0.95)'];
  }, [theme, colors]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading playlist...</Text>
      </SafeAreaView>
    );
  }

  if (!playlistData) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>Playlist not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.FlatList
        data={newSongs}
        renderItem={({ item }) => <SongCard song={item} />}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={[styles.separator]} />}
        contentContainerStyle={styles.listContent}
        style={{ paddingHorizontal: 10 }}
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
                  source={{ uri: convertToHttps(playlistData?.image) }}
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
                        source={{ uri: convertToHttps(playlistData?.image) }}
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
                        {playlistData?.header_desc}
                      </Text>
                      <View style={styles.statsContainer}>
                        <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                          {playlistData?.list_count} songs
                        </Text>
                        <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                          {formatCount(playlistData?.follower_count)} followers
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
                icon={<Ionicons name='shuffle' size={22} color={colors.primary} />}
                iconPosition='left'
                variant='outline'
                size='default'
              />
            </View>

            {/* Songs header */}
            <View style={styles.songsHeader}>
              <Text style={[styles.songsHeaderText, { color: colors.text }]}>Songs</Text>
            </View>
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
    gap: 16,
    marginTop: 4,
  },
  statText: {
    fontSize: 13,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  songsHeader: {
    paddingHorizontal: 20,
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
});
