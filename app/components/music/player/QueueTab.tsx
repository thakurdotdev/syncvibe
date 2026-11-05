import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import {
  checkAndFetchRecommendations,
  useCurrentSong,
  usePlayerControls,
  usePlayerStore,
  usePlaylist,
  useSongPlaybackState,
} from '@/stores/playerStore';
import { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { MoreVertical, Sparkles, Trash2Icon } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeableModal from '../../SwipeableModal';
import { SortableQueue } from './SortableQueue';

const ITEM_HEIGHT = 58;
/** Row height + its vertical margins: the distance between one row and the next. */
const ROW_STEP = ITEM_HEIGHT + 4;
/** Long enough for the player's open animation to finish before the list starts mounting. */
const PREPARE_DELAY_MS = 400;

const SongCardQueue = memo(
  function SongCardQueue({
    song,
    isActive,
    onMenuPress,
  }: {
    song: Song;
    isActive: boolean;
    onMenuPress: (song: Song) => void;
  }) {
    const { colors } = useTheme();
    const { playSong, handlePlayPause } = usePlayerControls();
    const { isCurrentSong, isPlaying } = useSongPlaybackState(song.id);

    const handlePress = useCallback(() => {
      if (isCurrentSong) {
        handlePlayPause();
      } else {
        playSong(song);
      }
    }, [song, playSong, isCurrentSong, handlePlayPause]);

    const handleMenuPress = useCallback(() => onMenuPress(song), [onMenuPress, song]);

    const songImage = song.image?.[1]?.link || song.image?.[0]?.link || song.image?.[2]?.link;
    const songName = song.name;
    const songArtist = song.subtitle || song.artist_map?.artists?.[0]?.name;

    return (
      <Pressable
        onPress={handlePress}
        disabled={isActive}
        style={[
          queueItemStyles.itemContainer,
          {
            backgroundColor: isActive
              ? colors.card
              : isCurrentSong
                ? `${colors.foreground}10`
                : 'transparent',
            borderColor: isActive ? colors.border : 'transparent',
          },
        ]}
        android_ripple={{ color: `${colors.foreground}10`, borderless: false }}
      >
        <View style={queueItemStyles.thumbnailWrapper}>
          <Image
            source={{ uri: songImage, cache: 'force-cache' }}
            style={queueItemStyles.thumbnail}
            fadeDuration={0}
            resizeMode='cover'
          />
          {isCurrentSong && (
            <View style={queueItemStyles.thumbnailOverlay}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color='#fff' />
            </View>
          )}
        </View>

        <View style={queueItemStyles.textArea}>
          <Text
            style={[
              queueItemStyles.title,
              { color: colors.text, fontWeight: isCurrentSong ? '700' : '600' },
            ]}
            numberOfLines={1}
          >
            {songName}
          </Text>
          <Text
            style={[queueItemStyles.artist, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {songArtist}
          </Text>
        </View>

        <Pressable onPress={handleMenuPress} hitSlop={8} style={queueItemStyles.menuButton}>
          <MoreVertical size={18} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.song.id === next.song.id &&
    prev.isActive === next.isActive &&
    prev.onMenuPress === next.onMenuPress
);

export const QueueTab = memo(function QueueTab({
  playerOpen,
  visible,
  dragGesture,
}: {
  playerOpen: boolean;
  visible: boolean;
  /** Attached to the top of the queue, so it can be dragged back down. */
  dragGesture: GestureType;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // The list costs nothing until the player first opens. It mounts just after that, so the rows
  // are already there when a swipe starts lifting the queue, and then stays mounted.
  const [opened, setOpened] = useState(visible);
  useEffect(() => {
    if (opened) return;
    if (visible) {
      setOpened(true);
      return;
    }
    if (!playerOpen) return;
    const timer = setTimeout(() => setOpened(true), PREPARE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [opened, playerOpen, visible]);
  const { reorderPlaylist, clearQueue, removeFromQueue, removeFromQueueBelow, playSong } =
    usePlayerControls();
  // Narrow selectors: this must not re-render when playback merely pauses or buffers.
  const playlist = usePlaylist();
  const currentSong = useCurrentSong();
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
  const setAutoFetchRecommendations = usePlayerStore((s) => s.setAutoFetchRecommendations);
  const [menuSong, setMenuSong] = useState<Song | null>(null);
  const [isFetchingRecs, setIsFetchingRecs] = useState(false);

  const upcomingCount = useMemo(() => {
    if (!currentSong) return playlist.length;
    return playlist.filter((s) => s.id !== currentSong.id).length;
  }, [playlist, currentSong]);

  const handleMenuPress = useCallback((song: Song) => {
    setMenuSong(song);
  }, []);

  const renderRow = useCallback(
    (song: Song, isActive: boolean) => (
      <SongCardQueue song={song} isActive={isActive} onMenuPress={handleMenuPress} />
    ),
    [handleMenuPress]
  );
  const canDrag = useCallback((song: Song) => song.id !== currentSong?.id, [currentSong?.id]);

  const handleClearQueue = useCallback(() => {
    if (playlist.length <= 1) return;
    clearQueue();
    toast('Queue cleared');
  }, [playlist, clearQueue]);

  const handleFetchRecommendations = useCallback(
    async (songId?: string) => {
      const target = songId ? playlist.find((s) => s.id === songId) : currentSong;
      if (!target?.id) return;
      setIsFetchingRecs(true);
      try {
        await checkAndFetchRecommendations(target, true);
        toast('Updated recommendations');
      } catch {
        toast('Failed to fetch recommendations');
      } finally {
        setIsFetchingRecs(false);
      }
    },
    [currentSong, playlist]
  );

  const handleToggleAutoFetch = useCallback(() => {
    const nextVal = !autoFetchRecommendations;
    setAutoFetchRecommendations(nextVal);
    toast(nextVal ? 'Auto-fetch: On' : 'Auto-fetch: Off');
  }, [autoFetchRecommendations, setAutoFetchRecommendations]);

  const handleRemoveBelow = useCallback(
    (songId: string) => {
      removeFromQueueBelow(songId);
      toast('Removed songs below');
      setMenuSong(null);
    },
    [removeFromQueueBelow]
  );

  // Reads the song from the store, not `playlist`: this stays stable as the queue changes, so
  // the rows it's handed to don't all re-render.
  const handleRemove = useCallback(
    (songId: string) => {
      const name = usePlayerStore.getState().playlist.find((s) => s.id === songId)?.name;
      const undo = removeFromQueue(songId);
      setMenuSong(null);
      if (undo) toast(`Removed ${name}`, { action: { label: 'Undo', onPress: undo } });
    },
    [removeFromQueue]
  );

  const handleMenuFetchRecs = useCallback(
    (songId: string) => {
      setMenuSong(null);
      handleFetchRecommendations(songId);
    },
    [handleFetchRecommendations]
  );

  const handleMenuPlayNow = useCallback(
    (song: Song) => {
      setMenuSong(null);
      playSong(song);
    },
    [playSong]
  );

  if (!playlist.length) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={queueStyles.emptyContainer}>
        <View style={[queueStyles.emptyIconCircle, { backgroundColor: colors.muted }]}>
          <Ionicons name='musical-notes-outline' size={32} color={colors.mutedForeground} />
        </View>
        <Text style={[queueStyles.emptyTitle, { color: colors.text }]}>Your queue is empty</Text>
        <Text style={[queueStyles.emptySubtitle, { color: colors.mutedForeground }]}>
          Add songs to start vibing
        </Text>
      </Animated.View>
    );
  }

  const isMenuSongCurrent = menuSong?.id === currentSong?.id;

  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={dragGesture}>
        <View style={queueStyles.dragArea}>
          <View style={[queueStyles.grabber, { backgroundColor: `${colors.foreground}33` }]} />
          <View style={queueStyles.header}>
            <Text style={[queueStyles.countText, { color: colors.mutedForeground }]}>
              {upcomingCount} {upcomingCount === 1 ? 'song' : 'songs'}
            </Text>
            <View style={queueStyles.headerActions}>
              <Pressable
                onPress={() => handleFetchRecommendations()}
                disabled={isFetchingRecs || !currentSong?.id}
                style={({ pressed }) => [queueStyles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
              >
                {isFetchingRecs ? (
                  <ActivityIndicator size={14} color={colors.primary} />
                ) : (
                  <Sparkles size={14} color={colors.primary} />
                )}
                <Text style={[queueStyles.headerBtnText, { color: colors.primary }]}>
                  {isFetchingRecs ? 'Fetching...' : 'Get Recs'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleToggleAutoFetch}
                style={({ pressed }) => [queueStyles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
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
              </Pressable>

              {playlist.length > 1 && (
                <Pressable
                  onPress={handleClearQueue}
                  style={({ pressed }) => [queueStyles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Trash2Icon size={14} color={colors.destructive} />
                  <Text style={[queueStyles.headerBtnText, { color: colors.destructive }]}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </GestureDetector>

      {opened && (
        <SortableQueue
          data={playlist}
          rowHeight={ROW_STEP}
          bottomPadding={insets.bottom + 24}
          canDrag={canDrag}
          renderRow={renderRow}
          onReorder={reorderPlaylist}
          onRemove={handleRemove}
        />
      )}

      {menuSong && (
        <SwipeableModal isVisible={!!menuSong} onClose={() => setMenuSong(null)}>
          <View style={queueMenuStyles.container}>
            <View style={queueMenuStyles.header}>
              <Image
                source={{
                  uri:
                    menuSong.image?.[1]?.link ||
                    menuSong.image?.[0]?.link ||
                    menuSong.image?.[2]?.link,
                  cache: 'force-cache',
                }}
                style={queueMenuStyles.headerImage}
              />
              <View style={queueMenuStyles.headerInfo}>
                <Text
                  style={[queueMenuStyles.headerTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {menuSong.name}
                </Text>
                <Text
                  style={[queueMenuStyles.headerArtist, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {menuSong.subtitle || menuSong.artist_map?.artists?.[0]?.name}
                </Text>
              </View>
            </View>

            <View style={[queueMenuStyles.divider, { backgroundColor: colors.border }]} />

            <View style={queueMenuStyles.options}>
              {!isMenuSongCurrent && (
                <Pressable
                  style={({ pressed }) => [
                    queueMenuStyles.optionRow,
                    { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => handleMenuPlayNow(menuSong)}
                >
                  <View style={[queueMenuStyles.iconContainer, { backgroundColor: colors.muted }]}>
                    <Ionicons name='play' size={18} color={colors.foreground} />
                  </View>
                  <Text style={[queueMenuStyles.optionText, { color: colors.foreground }]}>
                    Play Now
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  queueMenuStyles.optionRow,
                  { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => handleMenuFetchRecs(menuSong.id)}
              >
                <View style={[queueMenuStyles.iconContainer, { backgroundColor: colors.muted }]}>
                  <Sparkles size={18} color={colors.foreground} />
                </View>
                <Text style={[queueMenuStyles.optionText, { color: colors.foreground }]}>
                  Fetch Recommendations
                </Text>
              </Pressable>

              {!isMenuSongCurrent && (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      queueMenuStyles.optionRow,
                      { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => handleRemoveBelow(menuSong.id)}
                  >
                    <View
                      style={[queueMenuStyles.iconContainer, { backgroundColor: colors.muted }]}
                    >
                      <Ionicons name='remove-circle-outline' size={20} color={colors.foreground} />
                    </View>
                    <Text style={[queueMenuStyles.optionText, { color: colors.foreground }]}>
                      Remove Below
                    </Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      queueMenuStyles.optionRow,
                      { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => handleRemove(menuSong.id)}
                  >
                    <View
                      style={[
                        queueMenuStyles.iconContainer,
                        { backgroundColor: colors.destructive + '20' },
                      ]}
                    >
                      <Trash2Icon size={18} color={colors.destructive} />
                    </View>
                    <Text style={[queueMenuStyles.optionText, { color: colors.destructive }]}>
                      Remove from Queue
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </SwipeableModal>
      )}
    </View>
  );
});

const queueItemStyles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    height: ITEM_HEIGHT,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  dragArea: { paddingTop: 2 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
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
