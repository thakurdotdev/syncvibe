import PressableScale from '@/components/ui/PressableScale';
import { Song } from '@/types/song';
import { blurredArt } from '@/lib/artwork';
import { SONG_LIST_WINDOW } from '@/lib/lists';
import SwipeableModal from '@/components/SwipeableModal';
import { PlaylistSongRow } from '@/components/music/playlist/PlaylistSongRow';
import { SheetLayout } from '@/components/security/SheetLayout';
import { Button } from '@/components/ui/button';
import { usePlayerControls } from '@/stores/playerStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { convertToHttps } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { HEADER_HEIGHT, HeaderIconButton, StackHeader } from '@/components/ui/AppHeader';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
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
  const api = useApi();
  const { colors, theme } = useTheme();
  const { id } = useLocalSearchParams();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToPlaylist, playSong } = usePlayerControls();
  const { width } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const { addPlaylistToQueue } = useGroupMusic();
  const insets = useSafeAreaInsets();

  // Picking several songs, then removing them with one confirmation.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Songs waiting for "Remove?" to be answered.
  const [pendingRemoval, setPendingRemoval] = useState<Song[] | null>(null);
  const [removing, setRemoving] = useState(false);
  const cancelSwipe = useRef<(() => void) | undefined>(undefined);

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

  const toggleSelected = useCallback((songId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  }, []);

  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  const askToRemove = useCallback((song: Song, cancel?: () => void) => {
    cancelSwipe.current = cancel;
    setPendingRemoval([song]);
  }, []);

  const closeConfirm = useCallback(() => {
    if (removing) return;
    cancelSwipe.current?.();
    cancelSwipe.current = undefined;
    setPendingRemoval(null);
  }, [removing]);

  const confirmRemoval = useCallback(async () => {
    if (!pendingRemoval?.length) return;
    const songIds = pendingRemoval.map((song) => song.id);
    setRemoving(true);
    try {
      await api.post('/api/playlist/remove-song', { playlistId: Number(id), songIds });
      const gone = new Set(songIds);
      setPlaylistData((current) =>
        current
          ? { ...current, songs: current.songs.filter((s) => !gone.has(s.songData?.id)) }
          : current
      );
      toast(songIds.length === 1 ? 'Removed from playlist' : `Removed ${songIds.length} songs`, {
        type: 'success',
      });
      cancelSwipe.current = undefined;
      setPendingRemoval(null);
      stopSelecting();
    } catch {
      toast("Couldn't remove. Try again.", { type: 'error' });
    } finally {
      setRemoving(false);
    }
  }, [api, id, pendingRemoval, stopSelecting]);

  const renderSong = useCallback(
    ({ item }: { item: PlaylistSong }) => (
      <PlaylistSongRow
        song={item.songData}
        selecting={selecting}
        selected={selected.has(item.songData?.id)}
        onToggle={toggleSelected}
        onRemove={askToRemove}
      />
    ),
    [selecting, selected, toggleSelected, askToRemove]
  );

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
      scrollY.set(event.contentOffset.y);
    },
  });

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

  const handleAddToGroup = useCallback(() => {
    if (playlistData?.songs?.length) {
      const songs = playlistData.songs.map((s) => s.songData).filter(Boolean);
      addPlaylistToQueue(songs);
      toast(`Added ${songs.length} songs to group queue`, { type: 'success' });
    }
  }, [playlistData, addPlaylistToQueue]);

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
  const allSelected = songCount > 0 && selected.size === songCount;
  const removalCount = pendingRemoval?.length ?? 0;

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
      <StackHeader
        overlay
        title={selecting ? `${selected.size} selected` : playlistData?.name || 'User Playlist'}
        titleStyle={selecting ? undefined : topTitleAnimatedStyle}
        right={
          songCount ? (
            <HeaderIconButton
              icon={selecting ? 'close' : 'checkmark-done'}
              label={selecting ? 'Stop selecting' : 'Select songs'}
              tone='overlay'
              onPress={selecting ? stopSelecting : () => setSelecting(true)}
            />
          ) : undefined
        }
      />

      <Animated.FlatList
        data={playlistData?.songs}
        renderItem={renderSong}
        extraData={selected}
        {...SONG_LIST_WINDOW}
        keyExtractor={(item) => String(item.id)}
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
              <PressableScale onPress={handlePlayAll} disabled={!songCount} style={{ flex: 1 }}>
                <View
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary, opacity: songCount ? 1 : 0.5 },
                  ]}
                >
                  <Ionicons name='play' size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                    Play All
                  </Text>
                </View>
              </PressableScale>

              <PressableScale onPress={handleShuffle} disabled={!songCount} style={{ flex: 1 }}>
                <View
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                      opacity: songCount ? 1 : 0.5,
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
                disabled={!songCount}
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
                      opacity: songCount ? 1 : 0.5,
                    },
                  ]}
                >
                  <Ionicons name='people' size={18} color={colors.foreground} />
                  <Text style={[styles.groupButtonText, { color: colors.foreground }]}>
                    Add to Group Queue ({songCount})
                  </Text>
                </View>
              </PressableScale>
            )}

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

      {selecting && (
        <View
          style={[
            styles.selectionBar,
            {
              // Under the header: the mini player and tabs cover the bottom of this page.
              top: insets.top + HEADER_HEIGHT + 4,
              backgroundColor: colors.raised,
              borderColor: colors.border,
            },
          ]}
        >
          <Button
            variant='ghost'
            onPress={() =>
              setSelected(
                allSelected
                  ? new Set()
                  : new Set((playlistData?.songs ?? []).map((s) => s.songData?.id).filter(Boolean))
              )
            }
          >
            {allSelected ? 'Clear' : 'Select all'}
          </Button>
          <Button
            variant='destructive'
            disabled={selected.size === 0}
            onPress={() =>
              setPendingRemoval(
                (playlistData?.songs ?? [])
                  .map((s) => s.songData)
                  .filter((song) => song && selected.has(song.id))
              )
            }
          >
            {selected.size ? `Remove (${selected.size})` : 'Remove'}
          </Button>
        </View>
      )}

      <SwipeableModal isVisible={removalCount > 0} onClose={closeConfirm} dragAnywhere>
        <SheetLayout
          icon='trash-2'
          tone='destructive'
          title={removalCount === 1 ? 'Remove this song?' : `Remove ${removalCount} songs?`}
          description={
            removalCount === 1
              ? `“${pendingRemoval?.[0]?.name}” will be taken off “${playlistData?.name}”.`
              : `They will be taken off “${playlistData?.name}”.`
          }
        >
          <Button size='lg' variant='destructive' isLoading={removing} onPress={confirmRemoval}>
            {removalCount === 1 ? 'Remove song' : `Remove ${removalCount} songs`}
          </Button>
          <Button size='lg' variant='ghost' disabled={removing} onPress={closeConfirm}>
            Keep {removalCount === 1 ? 'it' : 'them'}
          </Button>
        </SheetLayout>
      </SwipeableModal>
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
  selectionBar: {
    position: 'absolute',
    zIndex: 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
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
