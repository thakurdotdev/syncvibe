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
import { Music2Icon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
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

interface AlbumData {
  id: string;
  name: string;
  year: string;
  songcount: number;
  image: { link: string }[];
  songs: Song[];
  artist_map?: {
    artists?: { name: string }[];
  };
}

export default function AlbumScreen() {
  const { colors, theme } = useTheme();
  const { id } = useLocalSearchParams();
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);
  const { addToPlaylist, playSong } = usePlayerControls();
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const fetchAlbumData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${SONG_URL}/album?id=${id}`);
      const data = response.data;
      setAlbumData(data.data);
    } catch (error) {
      console.error('Error fetching album data:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchAlbumData();
    }
  }, [id, fetchAlbumData]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerHeight = useMemo(() => Math.min(width * 0.8, 250), [width]);
  const imageSize = useMemo(() => Math.min(width * 0.4, 250), [width]);

  const albumCoverUrl = useMemo(() => {
    return albumData?.image?.[2]?.link || albumData?.image?.[0]?.link;
  }, [albumData]);

  const artistName = useMemo(() => {
    return albumData?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((artist) => artist.name)
      .join(', ');
  }, [albumData]);

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
    if (!albumData?.songs) return [];
    return albumData?.songs?.map(ensureHttpsForSongUrls) || [];
  }, [albumData?.songs]);

  const handlePlayAll = () => {
    if (newSongs?.length) {
      const songsWithPlaylistInfo = newSongs.map((song) => ({
        ...song,
        isPlaylist: true,
        playlistId: albumData?.id,
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
          playlistId: albumData?.id,
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
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading album...</Text>
      </SafeAreaView>
    );
  }

  if (!albumData) {
    return (
      <SafeAreaView style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Music2Icon size={100} color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.text }]}>No album found</Text>
        <Button variant='default' title='Retry' onPress={fetchAlbumData} />
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
                  source={{ uri: convertToHttps(albumCoverUrl) }}
                  style={[styles.backgroundImage, { height: headerHeight }]}
                  blurRadius={30}
                />
                <BlurView
                  intensity={80}
                  tint={theme === 'dark' ? 'dark' : 'light'}
                  style={styles.blurOverlay}
                >
                  <View style={styles.headerContent}>
                    <Animated.View style={[styles.albumCoverContainer, imageAnimatedStyle]}>
                      <Image
                        source={{ uri: convertToHttps(albumCoverUrl) }}
                        style={[styles.albumCover, { width: imageSize, height: imageSize }]}
                        resizeMode='cover'
                      />
                    </Animated.View>
                    <View style={styles.infoContainer}>
                      <Text style={[styles.albumTitle, { color: colors.text }]} numberOfLines={2}>
                        {albumData.name}
                      </Text>
                      {artistName && (
                        <Text
                          style={[styles.artistName, { color: colors.mutedForeground }]}
                          numberOfLines={2}
                        >
                          {artistName}
                        </Text>
                      )}
                      <View style={styles.statsContainer}>
                        {albumData.year && (
                          <View style={styles.stat}>
                            <Ionicons
                              name='calendar-outline'
                              size={14}
                              color={colors.mutedForeground}
                            />
                            <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                              {albumData.year}
                            </Text>
                          </View>
                        )}
                        <View style={styles.stat}>
                          <Ionicons name='musical-note' size={14} color={colors.mutedForeground} />
                          <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                            {albumData.songcount} {albumData.songcount === 1 ? 'song' : 'songs'}
                          </Text>
                        </View>
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
                disabled={!albumData?.songs?.length}
                title='Play All'
                icon={<Ionicons name='play' size={22} color={colors.primaryForeground} />}
                iconPosition='left'
                variant='default'
                size='default'
              />
              <Button
                onPress={handleShuffle}
                disabled={!albumData?.songs?.length}
                title='Shuffle'
                icon={<Ionicons name='shuffle' size={22} color={colors.text} />}
                iconPosition='left'
                variant='outline'
                size='default'
              />
            </View>

            {/* Songs header */}
            <View style={styles.songsHeader}>
              <Text style={[styles.songsHeaderText, { color: colors.text }]}>Tracks</Text>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  headerContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerGradient: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    gap: 10,
  },
  albumCoverContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  albumCover: {
    borderRadius: 12,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
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
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 1,
    marginVertical: 5,
  },
});
