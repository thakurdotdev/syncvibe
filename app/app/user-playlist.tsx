import { SongCard } from '@/components/music/MusicCards';
import { usePlayerControls } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { convertToHttps } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PlaylistSong = {
  id: string;
  songData: any;
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
  const insets = useSafeAreaInsets();
  const api = useApi();
  const { colors, theme } = useTheme();
  const { id } = useLocalSearchParams();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToPlaylist, playSong } = usePlayerControls();
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const playScale = useSharedValue(1);
  const shuffleScale = useSharedValue(1);

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

  const imageSize = useMemo(() => Math.min(width * 0.45, 175), [width]);

  const heroAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 150], [1, 0], Extrapolation.CLAMP);
    const scale = interpolate(scrollY.value, [0, 150], [1, 0.9], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const topTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [100, 160], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  const playBtnAnim = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  const shuffleBtnAnim = useAnimatedStyle(() => ({
    transform: [{ scale: shuffleScale.value }],
  }));

  const getBgUrl = useMemo(() => {
    if (!playlistData?.image) return '';
    return Array.isArray(playlistData.image) ? playlistData.image[2]?.link : playlistData.image;
  }, [playlistData]);

  const isDark = theme === 'dark';
  const coverUrl = convertToHttps(getBgUrl || '');

  const metaText = useMemo(() => {
    const parts = [];
    if (playlistData?.songs?.length) parts.push(`${playlistData.songs.length} songs`);
    if (playlistData?.createdat) parts.push(new Date(playlistData.createdat).toLocaleDateString());
    return parts.join('  •  ');
  }, [playlistData]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  const songCount = playlistData?.songs?.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Edge-to-Edge Ambient Background */}
      <Image source={{ uri: coverUrl }} style={styles.heroBackgroundImage} blurRadius={60} />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.1)',
          isDark ? 'rgba(11,11,12,0.85)' : 'rgba(245,245,247,0.9)',
          colors.background,
        ]}
        style={styles.backdropGradient}
      />

      {/* Floating Top Nav Bar */}
      <View style={[styles.topNavBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' },
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name='arrow-back' size={20} color={colors.foreground} />
        </TouchableOpacity>

        <Animated.Text
          style={[styles.topNavTitle, { color: colors.foreground }, topTitleAnimatedStyle]}
          numberOfLines={1}
        >
          {playlistData?.name || 'User Playlist'}
        </Animated.Text>

        <View style={{ width: 36 }} />
      </View>

      <Animated.FlatList
        data={playlistData?.songs}
        renderItem={({ item }) => <SongCard song={item.songData} />}
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
              <Pressable
                onPress={handlePlayAll}
                disabled={!songCount}
                onPressIn={() => (playScale.value = withTiming(0.96, { duration: 60 }))}
                onPressOut={() =>
                  (playScale.value = withSpring(1, { damping: 16, stiffness: 350 }))
                }
                style={{ flex: 1 }}
              >
                <Animated.View
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary, opacity: songCount ? 1 : 0.5 },
                    playBtnAnim,
                  ]}
                >
                  <Ionicons name='play' size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                    Play All
                  </Text>
                </Animated.View>
              </Pressable>

              <Pressable
                onPress={handleShuffle}
                disabled={!songCount}
                onPressIn={() => (shuffleScale.value = withTiming(0.96, { duration: 60 }))}
                onPressOut={() =>
                  (shuffleScale.value = withSpring(1, { damping: 16, stiffness: 350 }))
                }
                style={{ flex: 1 }}
              >
                <Animated.View
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      opacity: songCount ? 1 : 0.5,
                    },
                    shuffleBtnAnim,
                  ]}
                >
                  <Ionicons name='shuffle' size={18} color={colors.foreground} />
                  <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                    Shuffle
                  </Text>
                </Animated.View>
              </Pressable>
            </View>

            {/* Songs Section Label */}
            {songCount ? (
              <View style={styles.songsHeader}>
                <Text style={[styles.songsHeaderText, { color: colors.foreground }]}>Songs</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptySongsContainer}>
            <Ionicons name='musical-notes-outline' size={48} color={colors.mutedForeground} />
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
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    maxWidth: '70%',
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
  listContent: {
    paddingBottom: 130,
  },
  emptySongsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptySongsText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
