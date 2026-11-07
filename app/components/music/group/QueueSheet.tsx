import PressableScale from '@/components/ui/PressableScale';
import { SortableQueue } from '@/components/music/player/SortableQueue';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { BUTTON_PRESS_SCALE, IMAGE_FADE_MS, LIST_PRESS_DELAY, ROW_PRESS_SCALE } from '@/lib/motion';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import SwipeableModal from '@/components/SwipeableModal';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import useApi from '@/utils/hooks/useApi';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { QueueItem } from '@/stores/groupMusic/types';
import { Song } from '@/types/song';
import { searchSongs } from '@/utils/api/getSongs';
import { ensureHttpsForSongUrls } from '@/utils/getHttpsUrls';
import { useSharedValue } from 'react-native-reanimated';
import {
  fetchSongRecommendations,
  getGroupHistory,
  getHomePageMusic,
  getMusicHistory,
} from '@/api/music';

type TabKey = 'queue' | 'playlists' | 'recommended';

const QUEUE_ROW_HEIGHT = 64;
const SOURCE_TABS: SegmentOption<TabKey>[] = [
  { value: 'queue', label: 'Up next' },
  { value: 'playlists', label: 'Playlists' },
  { value: 'recommended', label: 'For you' },
];

/**
 * Up-next row. Tap plays it for everyone, hold to reorder, swipe left to remove. Who added it
 * shows as their face at the end, and a sparkle marks a song autoplay chose.
 */
const QueueItemRow = React.memo(
  ({
    item,
    onPlay,
    isActive,
    colors,
  }: {
    item: QueueItem;
    onPlay: (item: QueueItem) => void;
    isActive?: boolean;
    colors: any;
  }) => {
    const artist = item.song?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';
    const addedBy = item.isAutoRecommended ? 'autoplay' : item.addedBy?.userName;

    return (
      <PressableScale
        onPress={() => onPlay(item)}
        disabled={isActive}
        unstable_pressDelay={LIST_PRESS_DELAY}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='button'
        accessibilityLabel={`Play ${item.song?.name} by ${artist} now${addedBy ? `, added by ${addedBy}` : ''}`}
        accessibilityHint='Hold to reorder, swipe left to remove'
        style={[styles.queueItem, isActive && { backgroundColor: colors.raised, borderRadius: 12 }]}
      >
        <Image
          source={{ uri: item.song?.image?.[1]?.link }}
          style={[styles.itemArt, { backgroundColor: colors.raised }]}
          fadeDuration={IMAGE_FADE_MS}
        />
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
            {item.song?.name}
          </Text>
          <Text style={[styles.itemArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        {item.isAutoRecommended ? (
          <Ionicons name='sparkles' size={15} color={colors.mutedForeground} />
        ) : item.addedBy?.profilePic ? (
          <Image
            source={{ uri: String(item.addedBy.profilePic) }}
            style={[styles.itemAvatar, { backgroundColor: colors.raised }]}
            fadeDuration={0}
          />
        ) : null}
      </PressableScale>
    );
  }
);

const SearchResultRow = React.memo(
  ({
    song,
    onAddToQueue,
    onPlayNow,
    onPlayNext,
    colors,
  }: {
    song: Song;
    onAddToQueue: (song: Song) => void;
    onPlayNow: (song: Song) => void;
    onPlayNext: (song: Song) => void;
    colors: any;
  }) => {
    const artist = song.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';

    return (
      <View style={styles.searchItem}>
        <Image
          source={{ uri: song.image?.[1]?.link }}
          style={[styles.itemArt, { backgroundColor: colors.secondary }]}
          fadeDuration={0}
        />
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
            {song.name}
          </Text>
          <Text style={[styles.itemArtist, { color: colors.mutedForeground }]} numberOfLines={1}>
            {artist}
          </Text>
        </View>
        <View style={styles.searchActions}>
          <PressableScale
            onPress={() => onPlayNext(song)}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel={`Play ${song.name} next`}
            style={styles.actionBtn}
          >
            <Feather name='skip-forward' size={16} color={colors.foreground} />
          </PressableScale>
          <PressableScale
            onPress={() => onPlayNow(song)}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel={`Play ${song.name} now`}
            style={[styles.actionBtn, { backgroundColor: colors.foreground }]}
          >
            <Ionicons name='play' size={14} color={colors.background} style={{ marginLeft: 1 }} />
          </PressableScale>
          <PressableScale
            onPress={() => onAddToQueue(song)}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel={`Add ${song.name} to the queue`}
            style={styles.actionBtn}
          >
            <Feather name='plus' size={19} color={colors.foreground} />
          </PressableScale>
        </View>
      </View>
    );
  }
);

const PlaylistBrowser: React.FC<{
  onPlayNow: (song: Song) => void;
  onPlayNext: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onAddAll: (songs: Song[]) => void;
  colors: any;
}> = ({ onPlayNow, onPlayNext, onAddToQueue, onAddAll, colors }) => {
  const api = useApi();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ id: string; name: string } | null>(
    null
  );
  const [playlistDetail, setPlaylistDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true);
    try {
      const response = await api.get('/api/playlist/get');
      setPlaylists(response.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
      setPlaylists([]);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, [api]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleSelectPlaylist = useCallback(
    async (pl: any) => {
      setSelectedPlaylist({ id: pl.id, name: pl.name });
      setIsLoadingDetail(true);
      try {
        const response = await api.get('/api/playlist/details', { params: { id: pl.id } });
        setPlaylistDetail(response.data?.data || null);
      } catch (err) {
        console.error('Failed to fetch playlist details:', err);
        setPlaylistDetail(null);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [api]
  );

  const songs: Song[] = useMemo(() => {
    if (!playlistDetail?.songs) return [];
    return playlistDetail.songs
      .map((item: any) => ensureHttpsForSongUrls(item.songData || item))
      .filter((s: Song) => s?.id);
  }, [playlistDetail]);

  if (selectedPlaylist) {
    return (
      <View style={styles.flex}>
        <View style={styles.playlistDetailHeader}>
          <PressableScale
            onPress={() => {
              setSelectedPlaylist(null);
              setPlaylistDetail(null);
            }}
            style={[styles.backButton, { backgroundColor: colors.secondary }]}
          >
            <Ionicons name='arrow-back' size={18} color={colors.foreground} />
          </PressableScale>
          <View style={styles.flex}>
            <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
              {selectedPlaylist.name}
            </Text>
            <Text style={[styles.itemArtist, { color: colors.mutedForeground }]}>
              {songs.length} songs
            </Text>
          </View>
          {songs.length > 0 && (
            <PressableScale
              onPress={() => onAddAll(songs)}
              style={[styles.addAllBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name='plus' size={14} color={colors.primaryForeground} />
              <Text style={[styles.addAllBtnText, { color: colors.primaryForeground }]}>
                Add All
              </Text>
            </PressableScale>
          )}
        </View>

        {isLoadingDetail ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size='large' color={colors.primary} />
          </View>
        ) : songs.length === 0 ? (
          <View style={styles.centeredState}>
            <Feather name='music' size={28} color={colors.mutedForeground + '40'} />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
              This playlist is empty
            </Text>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SearchResultRow
                song={item}
                onAddToQueue={onAddToQueue}
                onPlayNow={onPlayNow}
                onPlayNext={onPlayNext}
                colors={colors}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  }

  if (isLoadingPlaylists) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  if (playlists.length === 0) {
    return (
      <View style={styles.centeredState}>
        <Feather name='disc' size={28} color={colors.mutedForeground + '40'} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No playlists yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
          Create playlists from your music library
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={playlists}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => {
        const imageUrl =
          typeof item.image === 'string'
            ? item.image
            : item.image?.[1]?.link || item.image?.[0]?.link || '';
        return (
          <PressableScale onPress={() => handleSelectPlaylist(item)} style={styles.playlistRow}>
            <Image
              source={{ uri: imageUrl }}
              style={[styles.itemArt, { backgroundColor: colors.secondary }]}
              fadeDuration={0}
            />
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text
                style={[styles.itemArtist, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {item.description || 'Custom Playlist'}
              </Text>
            </View>
            <Feather name='chevron-right' size={18} color={colors.mutedForeground} />
          </PressableScale>
        );
      }}
      showsVerticalScrollIndicator={false}
    />
  );
};

/**
 * `inline` renders without the modal wrapper; `embedded` additionally drops the title row
 * for hosts that already label the panel (the room's Chat / Queue / People switch).
 */
export const QueueSheet: React.FC<{ inline?: boolean; embedded?: boolean }> = ({
  inline = false,
  embedded = false,
}) => {
  const api = useApi();
  const { user } = useUser();
  const { colors } = useTheme();
  const {
    removeFromQueue,
    reorderQueue,
    addToQueue,
    playNow,
    playNext,
    addPlaylistToQueue,
    clearQueue,
    toggleAutoRecommendations,
  } = useGroupMusic();
  const insets = useSafeAreaInsets();

  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const autoPlay = currentGroup?.settings?.autoPlayRecommendations !== false;

  const isQueueOpen = useGroupSessionStore((s) => s.isQueueOpen);
  const queue = useGroupSessionStore((s) => s.queue);
  const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex);
  const currentSong = useGroupPlaybackStore((s) => s.currentSong);
  const isPlaying = useGroupPlaybackStore((s) => s.isPlaying);

  const [activeTab, setActiveTab] = useState<TabKey>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const recommendations = useGroupSessionStore((s) => s.quickPickRecs);
  const setRecommendations = useCallback((updater: Song[] | ((prev: Song[]) => Song[])) => {
    if (typeof updater === 'function') {
      useGroupSessionStore.setState((s) => ({ quickPickRecs: updater(s.quickPickRecs) }));
    } else {
      useGroupSessionStore.setState({ quickPickRecs: updater });
    }
  }, []);

  const lastRecsSongIdRef = useRef<string | null>(null);
  const queueRef = useRef(queue);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsSourceName, setRecsSourceName] = useState('');
  const [recsLockedSongId, setRecsLockedSongId] = useState<string | null>(null);

  const searchTimer = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollOffset = useSharedValue(0);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    if (queue.length === 0 && recsLockedSongId) {
      setRecsLockedSongId(null);
    }
  }, [queue.length, recsLockedSongId]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.set(event.nativeEvent.contentOffset.y);
    },
    [scrollOffset]
  );

  const currentQueueItem = useMemo(
    () => (currentQueueIndex >= 0 && queue[currentQueueIndex] ? queue[currentQueueIndex] : null),
    [queue, currentQueueIndex]
  );

  const upcomingQueue = useMemo(
    () => queue.filter((_, idx) => idx > currentQueueIndex),
    [queue, currentQueueIndex]
  );

  useEffect(() => {
    if (isQueueOpen) {
      setActiveTab('queue');
      setSearchQuery('');
      setSearchResults([]);
      scrollOffset.set(0);
    }
  }, [isQueueOpen]);

  const fetchRecs = useCallback(
    async (songId: string, force = false) => {
      if (!songId) return;
      if (!force && lastRecsSongIdRef.current === songId) return;
      lastRecsSongIdRef.current = songId;
      setRecsLoading(true);
      const currentQueue = queueRef.current || [];
      const songItem = currentQueue.find((q) => q.song?.id === songId);
      setRecsSourceName(songItem?.song?.name || '');
      try {
        const data = await fetchSongRecommendations(api, songId);
        const existingIds = new Set(currentQueue.map((q) => q.song?.id));
        const filtered = (data || []).filter((s) => !existingIds.has(s.id));
        setRecommendations(filtered.slice(0, 15));
      } catch {
        setRecommendations([]);
      } finally {
        setRecsLoading(false);
      }
    },
    [api, setRecommendations]
  );

  const fetchSmartFallbackRecs = useCallback(
    async (force = false) => {
      if (!force && lastRecsSongIdRef.current === 'fallback') return;
      lastRecsSongIdRef.current = 'fallback';
      setRecsLoading(true);

      try {
        if (user?.userid) {
          const groupHist = await getGroupHistory(api, String(user.userid));
          if (groupHist && groupHist.length > 0) {
            const lastSong = groupHist[groupHist.length - 1]?.songData;
            if (lastSong?.id) {
              setRecsSourceName(`Last Session: ${lastSong.name}`);
              const data = await fetchSongRecommendations(api, lastSong.id);
              if (data && data.length > 0) {
                const currentQueue = queueRef.current || [];
                const existingIds = new Set(currentQueue.map((q) => q.song?.id));
                const filtered = data.filter((s) => !existingIds.has(s.id));
                setRecommendations(filtered.slice(0, 15));
                return;
              }
            }
          }
        }

        const musicHist = await getMusicHistory(api, { page: 1, limit: 5 });
        if (musicHist?.songs && musicHist.songs.length > 0) {
          const lastSong = musicHist.songs[0];
          if (lastSong?.id) {
            setRecsSourceName(`Music History: ${lastSong.name}`);
            const data = await fetchSongRecommendations(api, lastSong.id);
            if (data && data.length > 0) {
              const currentQueue = queueRef.current || [];
              const existingIds = new Set(currentQueue.map((q) => q.song?.id));
              const filtered = data.filter((s) => !existingIds.has(s.id));
              setRecommendations(filtered.slice(0, 15));
              return;
            }
          }
        }

        const modules = await getHomePageMusic();
        if (modules?.trending?.data && modules.trending.data.length > 0) {
          setRecsSourceName('Trending Now');
          const currentQueue = queueRef.current || [];
          const existingIds = new Set(currentQueue.map((q) => q.song?.id));
          const filtered = modules.trending.data
            .map(ensureHttpsForSongUrls)
            .filter((s) => !existingIds.has(s.id));
          setRecommendations(filtered.slice(0, 15));
        }
      } catch (err) {
        console.error('Failed to load fallback recommendations:', err);
      } finally {
        setRecsLoading(false);
      }
    },
    [api, user?.userid, setRecommendations]
  );

  useEffect(() => {
    if (recsLockedSongId) return;

    const activeSongId = currentQueueItem?.song?.id || currentSong?.id;
    if (activeSongId) {
      if (activeSongId !== lastRecsSongIdRef.current) {
        fetchRecs(activeSongId);
      }
    } else {
      fetchSmartFallbackRecs();
    }
  }, [
    currentQueueItem?.song?.id,
    currentSong?.id,
    recsLockedSongId,
    fetchRecs,
    fetchSmartFallbackRecs,
  ]);

  const handleClose = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: false });
  }, []);

  const handleRemove = useCallback(
    (queueItemId: string) => removeFromQueue(queueItemId),
    [removeFromQueue]
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchSongs(query);
        setSearchResults(results.map(ensureHttpsForSongUrls));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const handleAddToQueue = useCallback(
    (song: Song) => {
      addToQueue(song);
      setRecommendations((prev) => prev.filter((s) => s.id !== song.id));
    },
    [addToQueue, setRecommendations]
  );

  const handlePlayNow = useCallback((song: Song) => playNow(song), [playNow]);

  // There's no "jump to queue item" event, so play it now and drop the queued copy.
  const handlePlayQueued = useCallback(
    (item: QueueItem) => {
      removeFromQueue(item.id);
      playNow(item.song);
    },
    [removeFromQueue, playNow]
  );

  const handleReorder = useCallback(
    (next: QueueItem[]) => {
      const { queue: current, currentQueueIndex: playing } = useGroupSessionStore.getState();
      const offset = playing + 1;
      const before = current.slice(offset);
      const first = next.findIndex((item, i) => item.id !== before[i]?.id);
      if (first < 0) return;
      let last = next.length - 1;
      while (last > first && next[last].id === before[last]?.id) last--;
      // One row moved, so either it went down from `first`, or up from `last`.
      const [from, to] = next[last].id === before[first].id ? [first, last] : [last, first];
      // Show the new order immediately; the server confirms with queue-updated.
      useGroupSessionStore.setState({ queue: [...current.slice(0, offset), ...next] });
      reorderQueue(offset + from, offset + to);
    },
    [reorderQueue]
  );

  const handlePlayNext = useCallback((song: Song) => playNext(song), [playNext]);

  const handleClearQueue = useCallback(() => {
    Alert.alert('Clear Upcoming Queue', 'Remove all upcoming tracks from the queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearQueue();
          toast('Upcoming queue cleared', { type: 'info' });
        },
      },
    ]);
  }, [clearQueue]);

  const currentArtist = currentSong?.artist_map?.primary_artists?.[0]?.name || 'Unknown Artist';

  const renderQueueItem = useCallback(
    (item: QueueItem, isActive: boolean) => (
      <QueueItemRow item={item} onPlay={handlePlayQueued} isActive={isActive} colors={colors} />
    ),
    [handlePlayQueued, colors]
  );
  const canReorder = useCallback(() => true, []);

  const renderSearchResult = useCallback(
    ({ item }: { item: Song }) => (
      <SearchResultRow
        song={item}
        onAddToQueue={handleAddToQueue}
        onPlayNow={handlePlayNow}
        onPlayNext={handlePlayNext}
        colors={colors}
      />
    ),
    [handleAddToQueue, handlePlayNow, handlePlayNext, colors]
  );

  const songKeyExtractor = useCallback((item: Song) => item.id, []);

  /**
   * One compact row above the up-next list. In the room the player sits right above
   * this panel, so the "now playing" card only shows in the standalone sheet.
   */
  const renderQueueHeader = useCallback(() => {
    const showNowPlaying = !embedded && !!currentSong && !!currentQueueItem;

    return (
      <View>
        {showNowPlaying && (
          <View style={[styles.nowPlaying, { backgroundColor: colors.secondary }]}>
            <Image
              source={{ uri: currentSong.image?.[1]?.link }}
              style={styles.nowPlayingArt}
              fadeDuration={0}
            />
            <View style={styles.nowPlayingInfo}>
              <Text style={[styles.nowPlayingText, { color: colors.primary }]}>NOW PLAYING</Text>
              <Text style={[styles.nowPlayingName, { color: colors.foreground }]} numberOfLines={1}>
                {currentSong.name}
              </Text>
              <Text
                style={[styles.nowPlayingArtist, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {currentArtist}
              </Text>
            </View>
            {isPlaying && (
              <View style={styles.playingIndicator}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.playingBar, { backgroundColor: colors.primary }]} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.listHeader}>
          <PressableScale
            onPress={() => toggleAutoRecommendations()}
            accessibilityRole='switch'
            accessibilityState={{ checked: autoPlay }}
            accessibilityLabel='Autoplay recommendations'
            hitSlop={10}
            style={styles.textAction}
          >
            <Ionicons
              name={autoPlay ? 'sparkles' : 'sparkles-outline'}
              size={14}
              color={autoPlay ? colors.foreground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.textActionLabel,
                { color: autoPlay ? colors.foreground : colors.mutedForeground },
              ]}
            >
              Autoplay {autoPlay ? 'on' : 'off'}
            </Text>
          </PressableScale>
          {upcomingQueue.length > 0 && (
            <PressableScale
              onPress={handleClearQueue}
              accessibilityRole='button'
              accessibilityLabel='Clear upcoming queue'
              hitSlop={10}
              style={styles.textAction}
            >
              <Text style={[styles.textActionLabel, { color: colors.mutedForeground }]}>Clear</Text>
            </PressableScale>
          )}
        </View>
      </View>
    );
  }, [
    embedded,
    currentSong,
    currentQueueItem,
    upcomingQueue.length,
    colors,
    currentArtist,
    isPlaying,
    autoPlay,
    handleClearQueue,
    toggleAutoRecommendations,
  ]);

  const listBottomInset = Math.max(insets.bottom, 12) + 16;

  const Wrapper: any = inline ? View : SwipeableModal;
  const wrapperProps = inline
    ? { style: styles.inlineWrapper }
    : {
        isVisible: isQueueOpen,
        onClose: handleClose,
        maxHeight: '100%',
        scrollable: true,
        scrollOffset,
        hideHandle: true,
        fullScreen: true,
      };

  return (
    <Wrapper {...wrapperProps}>
      <View style={styles.container}>
        {!embedded && (
          <View style={[styles.header, { paddingTop: 16 }]}>
            <View style={styles.headerLeft}>
              {!inline && (
                <PressableScale
                  onPress={handleClose}
                  style={[styles.backButton, { backgroundColor: colors.secondary }]}
                  accessibilityRole='button'
                  accessibilityLabel='Close queue'
                >
                  <Ionicons name='arrow-back' size={20} color={colors.foreground} />
                </PressableScale>
              )}
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Queue</Text>
              {upcomingQueue.length > 0 && (
                <Text style={[styles.countText, { color: colors.mutedForeground }]}>
                  {upcomingQueue.length} next
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Search + source chips: one compact toolbar instead of a second segmented bar. */}
        <View style={[styles.toolbar, embedded && { paddingTop: 10 }]}>
          <Input
            ref={inputRef}
            placeholder='Search songs to add'
            value={searchQuery}
            onChangeText={handleSearch}
            variant='filled'
            size='sm'
            returnKeyType='search'
            leftIcon={<Feather name='search' size={16} color={colors.mutedForeground} />}
            rightIcon={
              searchQuery ? (
                <PressableScale
                  onPress={() => handleSearch('')}
                  accessibilityRole='button'
                  accessibilityLabel='Clear search'
                  hitSlop={8}
                >
                  <Feather name='x' size={16} color={colors.mutedForeground} />
                </PressableScale>
              ) : null
            }
          />

          {!searchQuery.trim() && (
            <Segmented
              options={SOURCE_TABS}
              value={activeTab}
              onChange={(next) => {
                setActiveTab(next);
                scrollOffset.set(0);
              }}
              accessibilityLabel='Where to find songs'
            />
          )}
        </View>

        {/* Search View when query entered */}
        {searchQuery.trim() ? (
          <View style={styles.flex}>
            {isSearching ? (
              <View style={styles.centeredState}>
                <ActivityIndicator size='large' color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={songKeyExtractor}
                renderItem={renderSearchResult}
                ListEmptyComponent={
                  <View style={styles.centeredState}>
                    <Feather name='search' size={28} color={colors.mutedForeground + '40'} />
                    <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                      No results found
                    </Text>
                  </View>
                }
                contentContainerStyle={[styles.listContent, { paddingBottom: listBottomInset }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps='handled'
                onScroll={handleScroll}
                scrollEventThrottle={16}
              />
            )}
          </View>
        ) : (
          /* Tab Content */
          <View style={styles.flex}>
            {activeTab === 'queue' && (
              <View style={styles.flex}>
                {renderQueueHeader()}
                {upcomingQueue.length > 0 ? (
                  // The same list as the player's queue. The row moves only on the UI thread, and
                  // a drop changes no layout, so nothing can flicker when the new order arrives.
                  <SortableQueue
                    data={upcomingQueue}
                    rowHeight={QUEUE_ROW_HEIGHT}
                    bottomPadding={listBottomInset}
                    canDrag={canReorder}
                    renderRow={renderQueueItem}
                    onReorder={handleReorder}
                    onRemove={handleRemove}
                  />
                ) : (
                  <View style={styles.emptyQueue}>
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                      Nothing up next
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                      Search above to add a song.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'playlists' && (
              <PlaylistBrowser
                onPlayNow={handlePlayNow}
                onPlayNext={handlePlayNext}
                onAddToQueue={handleAddToQueue}
                onAddAll={addPlaylistToQueue}
                colors={colors}
              />
            )}

            {activeTab === 'recommended' && (
              <View style={styles.flex}>
                {recsLoading ? (
                  <View style={styles.centeredState}>
                    <ActivityIndicator size='large' color={colors.primary} />
                    <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                      Finding songs for you...
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={recommendations}
                    keyExtractor={songKeyExtractor}
                    renderItem={renderSearchResult}
                    ListHeaderComponent={
                      recsSourceName ? (
                        <View style={styles.recsHeaderRow}>
                          <Text
                            style={[styles.recsSource, { color: colors.mutedForeground }]}
                            numberOfLines={1}
                          >
                            Based on{' '}
                            <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                              {recsSourceName}
                            </Text>
                          </Text>
                          <PressableScale
                            accessibilityRole='button'
                            accessibilityLabel='Refresh recommendations'
                            style={[styles.miniPill, { backgroundColor: colors.secondary }]}
                            onPress={() => {
                              const activeSongId = currentQueueItem?.song?.id || currentSong?.id;
                              if (activeSongId) {
                                fetchRecs(activeSongId, true);
                              } else {
                                fetchSmartFallbackRecs(true);
                              }
                            }}
                            hitSlop={8}
                          >
                            <Feather name='refresh-cw' size={11} color={colors.mutedForeground} />
                            <Text style={[styles.miniPillText, { color: colors.mutedForeground }]}>
                              Refresh
                            </Text>
                          </PressableScale>
                        </View>
                      ) : null
                    }
                    ListEmptyComponent={
                      <View style={styles.centeredState}>
                        <Feather name='zap' size={28} color={colors.mutedForeground + '40'} />
                        <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>
                          No recommendations yet
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                          Play a song to get personalized recommendations
                        </Text>
                      </View>
                    }
                    contentContainerStyle={[styles.listContent, { paddingBottom: listBottomInset }]}
                    showsVerticalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  inlineWrapper: { flex: 1, minHeight: 0 },
  flex: { flex: 1 },
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  listHeader: {
    height: 40,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textActionLabel: { fontSize: 13, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
  },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
  },
  miniPillText: { fontSize: 11.5, fontWeight: '600' },
  recsSource: { flex: 1, fontSize: 12.5, marginRight: 8 },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 10,
  },
  nowPlayingText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 1,
  },
  nowPlayingArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  nowPlayingInfo: {
    marginLeft: 10,
    flex: 1,
  },
  nowPlayingName: {
    fontSize: 14,
    fontWeight: '600',
  },
  nowPlayingArtist: {
    fontSize: 12,
    marginTop: 1,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 14,
    marginLeft: 8,
  },
  playingBar: {
    width: 2.5,
    borderRadius: 1,
    height: '60%',
  },
  recsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: QUEUE_ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: QUEUE_ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: QUEUE_ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  addAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addAllBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemArt: { width: 48, height: 48, borderRadius: 6 },
  itemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  itemArtist: { fontSize: 13, marginTop: 2 },
  itemAvatar: { width: 22, height: 22, borderRadius: 11, marginLeft: 8 },
  searchActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueue: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  centeredState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
