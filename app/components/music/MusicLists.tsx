import Card from '@/components/ui/card';
import { usePlayerControls, usePlaybackState, usePlaylistState, usePlayerStore } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useSongRecommendationsQuery } from '@/queries/useMusic';
import { Song } from '@/types/song';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronRightIcon, Trash2Icon, MoreVertical, Sparkles } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated as RNAnimated, FlatList, Image, Pressable, Text, TouchableOpacity, View, StyleSheet, ActivityIndicator } from 'react-native';
import DraggableFlatList, {
  OpacityDecorator,
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from './MusicCards';
import { Ionicons } from '@expo/vector-icons';
import SwipeableModal from '../common/SwipeableModal';

interface AlbumsGridProps {
  albums: any[];
  title: string;
}

interface PlaylistsGridProps {
  playlists: any[];
  title: string;
}

interface ArtistGridProps {
  artists: any[];
  title: string;
}

interface RecommendationGridProps {
  recommendations: any[];
  title: string;
  showMore?: boolean;
}

const SongCardQueue = memo(
  ({
    song,
    drag,
    isActive,
    index,
    onMenuPress,
  }: {
    song: Song;
    drag: () => void;
    isActive: boolean;
    index: number;
    onMenuPress: (song: Song) => void;
  }) => {
    const { colors } = useTheme();
    const { playSong, removeFromQueue } = usePlayerControls();
    const { currentSong } = usePlaybackState();
    const isCurrentSong = currentSong?.id === song.id;
    const swipeableRef = useRef<Swipeable>(null);

    const handlePress = useCallback(() => {
      playSong(song);
    }, [song, playSong]);

    const handleDelete = useCallback(() => {
      removeFromQueue(song.id);
      swipeableRef.current?.close();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, [removeFromQueue, song.id]);

    const songImage = useMemo(() => song.image[1]?.link, [song.image]);
    const songName = useMemo(() => song.name, [song.name]);
    const songArtist = useMemo(
      () => song.subtitle || song.artist_map?.artists?.[0]?.name,
      [song.subtitle, song.artist_map]
    );

    const renderRightActions = useCallback(
      (progress: any, _dragX: any) => {
        const opacity = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0, 1],
        });

        return (
          <RNAnimated.View style={{ opacity, width: 70, height: '100%' }}>
            <RectButton
              onPress={handleDelete}
              style={queueItemStyles.deleteButton}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Trash2Icon size={20} color='white' />
              </View>
            </RectButton>
          </RNAnimated.View>
        );
      },
      [handleDelete]
    );

    return (
      <ScaleDecorator>
        <OpacityDecorator activeOpacity={0.9}>
          <Swipeable
            ref={swipeableRef}
            renderRightActions={isCurrentSong ? undefined : renderRightActions}
            friction={2}
            rightThreshold={40}
            overshootRight={false}
            enableTrackpadTwoFingerGesture={false}
            containerStyle={{ marginVertical: 1, overflow: 'hidden' }}
          >
            <Pressable
              onLongPress={() => {
                if (!isCurrentSong) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  drag();
                }
              }}
              onPress={handlePress}
              disabled={isActive}
              delayLongPress={150}
            >
              <View
                style={[
                  queueItemStyles.itemContainer,
                  {
                    backgroundColor: isCurrentSong ? colors.primary + '12' : colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    queueItemStyles.indexText,
                    {
                      color: isCurrentSong ? colors.primary : colors.mutedForeground,
                    },
                  ]}
                >
                  {isCurrentSong ? '▶' : index + 1}
                </Text>

                <Image
                  source={{ uri: songImage }}
                  style={queueItemStyles.thumbnail}
                  fadeDuration={0}
                  resizeMode='cover'
                />

                <View style={queueItemStyles.textArea}>
                  <Text
                    style={[
                      queueItemStyles.title,
                      {
                        color: isCurrentSong ? colors.primary : colors.text,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {songName}
                  </Text>
                  <Text
                    style={[
                      queueItemStyles.artist,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {songArtist}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => onMenuPress(song)}
                  activeOpacity={0.6}
                  hitSlop={8}
                  style={queueItemStyles.menuButton}
                >
                  <MoreVertical size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </Pressable>
          </Swipeable>
        </OpacityDecorator>
      </ScaleDecorator>
    );
  }
);

const queueItemStyles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 60,
  },
  indexText: {
    width: 24,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginLeft: 10,
  },
  textArea: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    fontSize: 13,
  },
  menuButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
  },
});

export const MusicQueue = memo(() => {
  const { colors } = useTheme();
  const { reorderPlaylist, clearQueue, addToQueue, removeFromQueue, removeFromQueueBelow } = usePlayerControls();
  const { playlist } = usePlaylistState();
  const { currentSong } = usePlaybackState();
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
  const setAutoFetchRecommendations = usePlayerStore((s) => s.setAutoFetchRecommendations);
  const scrollRef = useRef(null);

  const [menuSong, setMenuSong] = useState<Song | null>(null);
  const [recTargetId, setRecTargetId] = useState<string | undefined>(undefined);
  const [isFetchingRecs, setIsFetchingRecs] = useState(false);

  const { data: recommendations = [], isFetched: recsFetched } = useSongRecommendationsQuery(recTargetId, {
    enabled: !!recTargetId,
  });

  useEffect(() => {
    if (!recTargetId || !recsFetched) return;
    if (recommendations.length > 0) {
      addToQueue(recommendations);
      toast(`Added ${recommendations.length} songs to queue`);
    } else {
      toast('No recommendations found');
    }
    setRecTargetId(undefined);
    setIsFetchingRecs(false);
  }, [recTargetId, recsFetched, recommendations, addToQueue]);

  const upcomingCount = useMemo(() => {
    if (!currentSong) return playlist.length;
    return playlist.filter((s) => s.id !== currentSong.id).length;
  }, [playlist, currentSong]);

  const handleDragEnd = useCallback(
    ({ data }: { data: Song[] }) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      reorderPlaylist(data);
    },
    [reorderPlaylist]
  );

  const handleClearQueue = useCallback(() => {
    if (playlist.length <= 1) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clearQueue();
    toast('Queue cleared');
  }, [playlist, clearQueue]);

  const handleFetchRecommendations = useCallback((songId?: string) => {
    const targetId = songId || currentSong?.id;
    if (!targetId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFetchingRecs(true);
    setRecTargetId(targetId);
  }, [currentSong?.id]);

  const handleToggleAutoFetch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAutoFetchRecommendations(!autoFetchRecommendations);
    toast(autoFetchRecommendations ? 'Auto-fetch: Off' : 'Auto-fetch: On');
  }, [autoFetchRecommendations, setAutoFetchRecommendations]);

  const handleRemoveBelow = useCallback((songId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeFromQueueBelow(songId);
    toast('Removed songs below');
    setMenuSong(null);
  }, [removeFromQueueBelow]);

  const handleMenuRemove = useCallback((songId: string) => {
    removeFromQueue(songId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toast('Removed from queue');
    setMenuSong(null);
  }, [removeFromQueue]);

  const handleMenuFetchRecs = useCallback((songId: string) => {
    setMenuSong(null);
    handleFetchRecommendations(songId);
  }, [handleFetchRecommendations]);

  if (!playlist.length) {
    return (
      <Animated.View
        entering={FadeIn.duration(400)}
        style={queueStyles.emptyContainer}
      >
        <View style={[queueStyles.emptyIconCircle, { backgroundColor: colors.muted }]}>
          <Ionicons name="musical-notes-outline" size={32} color={colors.mutedForeground} />
        </View>
        <Text style={[queueStyles.emptyTitle, { color: colors.text }]}>
          Your queue is empty
        </Text>
        <Text style={[queueStyles.emptySubtitle, { color: colors.mutedForeground }]}>
          Add songs to start vibing
        </Text>
      </Animated.View>
    );
  }

  const isMenuSongCurrent = menuSong?.id === currentSong?.id;

  return (
    <View style={{ flex: 1 }}>
      <View style={queueStyles.header}>
        <Text style={[queueStyles.countText, { color: colors.mutedForeground }]}>
          {upcomingCount} {upcomingCount === 1 ? 'song' : 'songs'}
        </Text>
        <View style={queueStyles.headerActions}>
          <TouchableOpacity
            onPress={() => handleFetchRecommendations()}
            activeOpacity={0.7}
            disabled={isFetchingRecs || !currentSong?.id}
            style={queueStyles.headerBtn}
          >
            {isFetchingRecs ? (
              <ActivityIndicator size={14} color={colors.primary} />
            ) : (
              <Sparkles size={14} color={colors.primary} />
            )}
            <Text style={[queueStyles.headerBtnText, { color: colors.primary }]}>
              {isFetchingRecs ? 'Fetching...' : 'Get Recs'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleAutoFetch}
            activeOpacity={0.7}
            style={queueStyles.headerBtn}
          >
            <Ionicons
              name={autoFetchRecommendations ? 'sync' : 'sync-outline'}
              size={14}
              color={autoFetchRecommendations ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                queueStyles.headerBtnText,
                { color: autoFetchRecommendations ? colors.primary : colors.mutedForeground },
              ]}
            >
              Auto
            </Text>
          </TouchableOpacity>

          {playlist.length > 1 && (
            <TouchableOpacity
              onPress={handleClearQueue}
              activeOpacity={0.7}
              style={queueStyles.headerBtn}
            >
              <Trash2Icon size={14} color={colors.destructive} />
              <Text style={[queueStyles.headerBtnText, { color: colors.destructive }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <DraggableFlatList
        ref={scrollRef}
        data={playlist}
        renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<Song>) => (
          <SongCardQueue
            song={item}
            drag={drag}
            isActive={isActive}
            index={getIndex() ?? 0}
            onMenuPress={setMenuSong}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        bounces={true}
        onDragEnd={handleDragEnd}
      />

      {menuSong && (
        <SwipeableModal isVisible={!!menuSong} onClose={() => setMenuSong(null)}>
          <View style={queueMenuStyles.container}>
            <View style={queueMenuStyles.header}>
              <Image
                source={{ uri: menuSong.image[1]?.link }}
                style={queueMenuStyles.headerImage}
              />
              <View style={queueMenuStyles.headerInfo}>
                <Text style={[queueMenuStyles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {menuSong.name}
                </Text>
                <Text style={[queueMenuStyles.headerArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {menuSong.subtitle || menuSong.artist_map?.artists?.[0]?.name}
                </Text>
              </View>
            </View>

            <View style={[queueMenuStyles.divider, { backgroundColor: colors.border }]} />

            <View style={queueMenuStyles.options}>
              <TouchableOpacity
                style={[queueMenuStyles.optionRow, { backgroundColor: colors.card }]}
                onPress={() => handleMenuFetchRecs(menuSong.id)}
              >
                <View style={[queueMenuStyles.iconContainer, { backgroundColor: colors.muted }]}>
                  <Sparkles size={18} color={colors.foreground} />
                </View>
                <Text style={[queueMenuStyles.optionText, { color: colors.foreground }]}>
                  Fetch Recommendations
                </Text>
              </TouchableOpacity>

              {!isMenuSongCurrent && (
                <>
                  <TouchableOpacity
                    style={[queueMenuStyles.optionRow, { backgroundColor: colors.card }]}
                    onPress={() => handleRemoveBelow(menuSong.id)}
                  >
                    <View style={[queueMenuStyles.iconContainer, { backgroundColor: colors.muted }]}>
                      <Ionicons name="remove-circle-outline" size={20} color={colors.foreground} />
                    </View>
                    <Text style={[queueMenuStyles.optionText, { color: colors.foreground }]}>
                      Remove Below
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[queueMenuStyles.optionRow, { backgroundColor: colors.card }]}
                    onPress={() => handleMenuRemove(menuSong.id)}
                  >
                    <View style={[queueMenuStyles.iconContainer, { backgroundColor: colors.destructive + '20' }]}>
                      <Trash2Icon size={18} color={colors.destructive} />
                    </View>
                    <Text style={[queueMenuStyles.optionText, { color: colors.destructive }]}>
                      Remove from Queue
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </SwipeableModal>
      )}
    </View>
  );
});

const queueMenuStyles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerArtist: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  options: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

const queueStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    fontSize: 14,
  },
});

export const AlbumsGrid = ({ albums, title }: AlbumsGridProps) => {
  const { colors } = useTheme();
  if (!albums?.length) return null;

  return (
    <View className='mb-6'>
      {title && (
        <Text className='text-xl font-bold mb-2 ml-3' style={{ color: colors.text }}>
          {title}
        </Text>
      )}
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(400)}>
            <AlbumCard album={item} />
          </Animated.View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

export const PlaylistsGrid = ({ playlists, title }: PlaylistsGridProps) => {
  const { colors } = useTheme();
  if (!playlists?.length) return null;

  return (
    <View className='mb-6'>
      {title && (
        <Text className='text-xl font-bold mb-2 ml-3' style={{ color: colors.text }}>
          {title}
        </Text>
      )}
      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(400)}>
            <PlaylistCard playlist={item} isUser={false} />
          </Animated.View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

export const RecommendationGrid = ({
  recommendations,
  title,
  showMore = false,
}: RecommendationGridProps) => {
  const { colors } = useTheme();
  if (!recommendations?.length) return null;

  return (
    <View className='mb-6'>
      <View className='flex-row justify-between items-center mb-2 ml-3'>
        {title && (
          <Text className='text-xl font-bold' style={{ fontFamily: 'System', color: colors.text }}>
            {title}
          </Text>
        )}
        {showMore && (
          <TouchableOpacity className='px-3 py-1' onPress={() => router.push('/song-history')}>
            <ChevronRightIcon size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={recommendations}
        keyExtractor={(item, index) => item?.id || index.toString()}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(400)}>
            <NewSongCard song={item} />
          </Animated.View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        className='pb-2'
      />
    </View>
  );
};

export const TrendingSongs = memo(({ songs, title }: { songs: Song[]; title: string }) => {
  const { colors } = useTheme();
  if (!songs?.length) return null;

  return (
    <View className='mb-6'>
      {title && (
        <Text className='text-xl font-bold mb-2 ml-3' style={{ color: colors.text }}>
          {title}
        </Text>
      )}
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(400)}>
            <NewSongCard song={item} />
          </Animated.View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
});

export const ArtistGrid = memo(({ artists, title }: ArtistGridProps) => {
  const { colors } = useTheme();
  if (!artists?.length) return null;

  return (
    <View className='mb-6'>
      {title && (
        <Text className='text-xl font-bold mb-2 ml-3' style={{ color: colors.text }}>
          {title}
        </Text>
      )}
      <FlatList
        data={artists}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(400)}>
            <ArtistCard artist={item} />
          </Animated.View>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
});
