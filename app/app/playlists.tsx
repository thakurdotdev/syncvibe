import PressableScale from '@/components/ui/PressableScale';
import { blurredArt } from '@/lib/artwork';
import { SONG_LIST_WINDOW } from '@/lib/lists';
import { SongCard } from '@/components/music/MusicCards';
import { SONG_URL } from '@/constants';
import { usePlayerControls } from '@/stores/playerStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { Song } from '@/types/song';
import { convertToHttps, ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
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
import { StackHeader } from '@/components/ui/AppHeader';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';

interface PlaylistData {
  id: string;
  name: string;
  header_desc: string;
  image: string;
  list_count: number;
  follower_count: number;
  songs: Song[];
}

const renderSong = ({ item }: { item: Song }) => <SongCard song={item} />;

export default function PlaylistScreen() {
  const { colors, theme } = useTheme();
  const { id } = useLocalSearchParams();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const { addToPlaylist, playSong } = usePlayerControls();
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const { addPlaylistToQueue } = useGroupMusic();

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
      scrollY.set(event.contentOffset.y);
    },
  });

  const formatCount = useCallback((count: any) => {
    if (count === undefined || count === null) return 'N/A';
    if (count >= 1000000000) return (count / 1000000000).toFixed(1) + 'B';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  }, []);

  const imageSize = useMemo(() => Math.min(width * 0.45, 175), [width]);

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.get(), [0, 150], [1, 0], Extrapolation.CLAMP);
    const scale = interpolate(scrollY.get(), [0, 150], [1, 0.9], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const topTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.get(), [100, 160], [0, 1], Extrapolation.CLAMP);
    return { opacity };
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

  const handleAddToGroup = () => {
    if (!newSongs?.length) return;
    addPlaylistToQueue(newSongs);
    toast(`Added ${newSongs.length} songs to group queue`, { type: 'success' });
  };

  const isDark = theme === 'dark';
  const coverUrl = convertToHttps(playlistData?.image || '');

  const metaText = useMemo(() => {
    const parts = [];
    if (playlistData?.list_count) parts.push(`${playlistData.list_count} songs`);
    if (playlistData?.follower_count)
      parts.push(`${formatCount(playlistData.follower_count)} followers`);
    return parts.join('  •  ');
  }, [playlistData, formatCount]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  if (!playlistData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.foreground }]}>Playlist not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Edge-to-Edge Ambient Background */}
      <Image {...blurredArt(coverUrl, 60)} style={styles.heroBackgroundImage} />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.1)',
          isDark ? 'rgba(11,11,12,0.85)' : 'rgba(245,245,247,0.9)',
          colors.background,
        ]}
        style={styles.backdropGradient}
      />

      {/* Shared header: same back button and title reveal as every pushed page */}
      <StackHeader overlay title={playlistData.name} titleStyle={topTitleAnimatedStyle} />

      <Animated.FlatList
        data={newSongs}
        renderItem={renderSong}
        {...SONG_LIST_WINDOW}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        style={{ paddingHorizontal: 16 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <Animated.View style={[styles.heroContent, heroAnimatedStyle]}>
              <View style={styles.artworkShadow}>
                <Image
                  source={{ uri: coverUrl }}
                  style={[styles.playlistImage, { width: imageSize, height: imageSize }]}
                  resizeMode='cover'
                  fadeDuration={0}
                />
              </View>

              <Text style={[styles.playlistName, { color: colors.foreground }]} numberOfLines={2}>
                {playlistData?.name}
              </Text>

              {metaText ? (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{metaText}</Text>
              ) : null}
            </Animated.View>

            {/* Clean Action Bar */}
            <View style={styles.actionsContainer}>
              <PressableScale
                onPress={handlePlayAll}
                disabled={!newSongs.length}
                style={{ flex: 1 }}
              >
                <View style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                  <Ionicons name='play' size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                    Play All
                  </Text>
                </View>
              </PressableScale>

              <PressableScale
                onPress={handleShuffle}
                disabled={!newSongs.length}
                style={{ flex: 1 }}
              >
                <View
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <Ionicons name='shuffle' size={18} color={colors.foreground} />
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                    Shuffle
                  </Text>
                </View>
              </PressableScale>
            </View>

            {currentGroup && (
              <PressableScale
                onPress={handleAddToGroup}
                disabled={!newSongs.length}
                style={{ marginBottom: 16 }}
              >
                <View
                  style={[
                    styles.groupButton,
                    {
                      backgroundColor: isDark
                        ? 'rgba(127, 127, 127, 0.16)'
                        : 'rgba(127, 127, 127, 0.1)',
                      borderColor: isDark
                        ? 'rgba(127, 127, 127, 0.35)'
                        : 'rgba(127, 127, 127, 0.25)',
                    },
                  ]}
                >
                  <Ionicons name='people' size={18} color={colors.foreground} />
                  <Text style={[styles.groupButtonText, { color: colors.foreground }]}>
                    Add to Group Queue ({newSongs.length})
                  </Text>
                </View>
              </PressableScale>
            )}

            {/* Songs Section Label */}
            <View style={styles.songsHeader}>
              <Text style={[styles.songsHeaderText, { color: colors.foreground }]}>Tracks</Text>
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
    fontSize: 15,
    fontWeight: '500',
  },
  headerWrapper: {
    paddingTop: 8,
    marginBottom: 12,
  },
  heroBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    opacity: 0.5,
  },
  backdropGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  artworkShadow: {
    borderRadius: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    marginBottom: 16,
  },
  playlistImage: {
    borderRadius: 16,
  },
  playlistName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 23,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  songsHeader: {
    marginTop: 4,
    marginBottom: 8,
  },
  songsHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  groupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
  },
  groupButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: DECK_CLEARANCE,
  },
});
