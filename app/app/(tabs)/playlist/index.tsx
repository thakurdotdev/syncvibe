import LoginModal from '@/components/LoginModal';
import LoginScreen from '@/components/LoginScreen';
import SwipeableModal from '@/components/SwipeableModal';
import Button from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { usePlaylistState } from '@/stores/playerStore';
import { convertToHttps, ensureHttpsForPlaylistUrls } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import type { PlaylistPreviewSong } from '@/types/music';
import { router } from 'expo-router';
import { AlertCircle, Edit3, Plus, Trash2, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  StyleSheet,
  useWindowDimensions,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { HeaderIconButton, TabHeader } from '@/components/ui/AppHeader';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import PressableScale from '@/components/ui/PressableScale';
import { BUTTON_PRESS_SCALE, EASE_OUT } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';

const LoadingState = () => {
  const { colors } = useTheme();

  return (
    <TabSafeAreaView style={[styles.centerContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size='large' color={colors.primary} />
    </TabSafeAreaView>
  );
};

const getImageUrl = (image: unknown): string => {
  if (typeof image === 'string') return convertToHttps(image);
  if (image && typeof image === 'object' && !Array.isArray(image)) {
    const link = (image as { link?: unknown }).link;
    return typeof link === 'string' ? convertToHttps(link) : '';
  }
  if (!Array.isArray(image)) return '';

  for (let index = image.length - 1; index >= 0; index -= 1) {
    const item = image[index];
    if (typeof item === 'string' && item) return convertToHttps(item);
    if (item && typeof item === 'object') {
      const link = (item as { link?: unknown }).link;
      if (typeof link === 'string' && link) return convertToHttps(link);
    }
  }

  return '';
};

const formatRelativeDate = (value?: string | null): string | null => {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days}d ago`;

  return `Updated ${new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
};

type SortMode = 'recent' | 'name';

const lastAddedTime = (p: any) => {
  const t = p?.lastAddedAt ? new Date(p.lastAddedAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

/** Tiles fade in quickly when they mount or the sort changes: snappy, never a slide. */
const TILE_ENTER = FadeIn.duration(160).easing(EASE_OUT);

const CREATE_TILE = { id: 'create', isCreate: true } as const;

const PlaylistScreen = () => {
  const api = useApi();
  const { colors, theme } = useTheme();
  const { user } = useUser();
  const { userPlaylist, setUserPlaylist } = usePlaylistState();
  const [loading, setLoading] = useState(false);

  const getPlaylists = async () => {
    try {
      const { data } = await api.get('/api/playlist/get');
      if (data?.data) setUserPlaylist(data.data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [selectedPlaylist, setSelectedPlaylist] = useState<any>(null);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!showUpdateModal && !showDeleteModal) {
      Keyboard.dismiss();
    }
  }, [showUpdateModal, showDeleteModal]);

  const handleSavePlaylist = async () => {
    setLoading(true);
    try {
      if (!formData.name?.trim()) {
        toast('Please enter a playlist name');
        setLoading(false);
        return;
      }

      if (selectedPlaylist) {
        await api.put(`/api/playlist/update`, {
          id: selectedPlaylist.id,
          name: formData.name.trim(),
          description: formData.description?.trim(),
        });
        toast('Playlist updated successfully!');
      } else {
        await api.post(`/api/playlist/create`, {
          name: formData.name.trim(),
          description: formData.description?.trim(),
        });
        toast('Playlist created successfully!');
      }

      setShowUpdateModal(false);
      getPlaylists();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'An error occurred.';
      toast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist) return;

    setLoading(true);
    try {
      await api.delete(`/api/playlist/delete`, {
        data: { playlistId: selectedPlaylist.id },
      });
      toast('Playlist deleted successfully!');
      setShowDeleteModal(false);
      setShowActionsModal(false);
      getPlaylists();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'An error occurred.';
      toast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLongPress = (playlist: { name: string; id: number; description: string }) => {
    setSelectedPlaylist(playlist);
    setFormData({
      name: playlist.name || '',
      description: playlist.description || '',
    });
    setShowActionsModal(true);
  };

  const handleUpdateAction = () => {
    setShowActionsModal(false);
    setTimeout(() => setShowUpdateModal(true), 250);
  };

  const handleDeleteAction = () => {
    setShowActionsModal(false);
    setTimeout(() => setShowDeleteModal(true), 250);
  };

  const openCreateModal = () => {
    setSelectedPlaylist(null);
    setFormData({ name: '', description: '' });
    setShowUpdateModal(true);
  };

  const { width: windowWidth } = useWindowDimensions();
  const [sort, setSort] = useState<SortMode>('recent');
  const toggleSort = useCallback(() => setSort((m) => (m === 'recent' ? 'name' : 'recent')), []);

  const sortedPlaylists = useMemo(() => {
    const list = [...(userPlaylist || [])].filter((p) => p?.name);
    if (sort === 'name') {
      list.sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
      );
    } else {
      list.sort((a, b) => lastAddedTime(b) - lastAddedTime(a));
    }
    return list;
  }, [userPlaylist, sort]);

  const isDark = theme === 'dark';

  if (loading && !selectedPlaylist) return <LoadingState />;

  if (!user) {
    return <LoginScreen />;
  }

  const count = sortedPlaylists.length;
  const tileWidth = Math.floor((windowWidth - GRID_PADDING * 2 - GRID_GAP) / 2);

  const renderPlaylistItem = ({ item }: { item: any }) => (
    <Animated.View key={`${sort}-${item.id}`} entering={TILE_ENTER} style={{ width: tileWidth }}>
      {item.isCreate ? (
        <CreateTile width={tileWidth} onPress={openCreateModal} />
      ) : (
        <PlaylistTile playlist={item} width={tileWidth} onMore={handleLongPress} />
      )}
    </Animated.View>
  );

  return (
    <TabSafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <TabHeader
        title='Library'
        actions={
          <HeaderIconButton
            icon='time-outline'
            label='Open listening history'
            onPress={() => router.push('/song-history')}
          />
        }
      />

      <Animated.FlatList
        data={[CREATE_TILE, ...sortedPlaylists]}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => `playlist-${sort}-${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ItemSeparatorComponent={RowGap}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: DECK_CLEARANCE }}
        ListHeaderComponent={
          <>
            <View style={styles.toolbar}>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>
                {count} {count === 1 ? 'playlist' : 'playlists'}
              </Text>
              {count > 1 && (
                <PressableScale
                  onPress={toggleSort}
                  scaleTo={BUTTON_PRESS_SCALE}
                  hitSlop={8}
                  accessibilityRole='button'
                  accessibilityLabel={`Sorted by ${sort === 'recent' ? 'recently updated' : 'name'}. Change sort`}
                  style={[styles.sortChip, { backgroundColor: colors.raised }]}
                >
                  <Ionicons name='swap-vertical' size={13} color={colors.foreground} />
                  <Text style={[styles.sortText, { color: colors.foreground }]}>
                    {sort === 'recent' ? 'Recent' : 'A–Z'}
                  </Text>
                </PressableScale>
              )}
            </View>
          </>
        }
        ListFooterComponent={
          count === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              Playlists you make show up here. Add songs from any track's menu.
            </Text>
          ) : null
        }
      />

      {/* Actions Modal */}
      <SwipeableModal
        isVisible={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        maxHeight='35%'
      >
        <View style={styles.modalBody}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Playlist Options</Text>
            <TouchableOpacity
              style={[
                styles.modalCloseBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              ]}
              onPress={() => setShowActionsModal(false)}
            >
              <X size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12 }}>
            <Button
              variant='secondary'
              title='Edit Playlist'
              icon={<Edit3 size={18} color={colors.primary} />}
              iconPosition='left'
              onPress={handleUpdateAction}
            />

            <Button
              variant='destructive'
              title='Delete Playlist'
              icon={<Trash2 size={18} color={colors.destructiveForeground} />}
              iconPosition='left'
              onPress={handleDeleteAction}
            />
          </View>
        </View>
      </SwipeableModal>

      {/* Create / Edit Modal (maxHeight="90%" so it opens fully!) */}
      <SwipeableModal
        isVisible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        maxHeight={520}
        scrollable={true}
        useScrollView={true}
      >
        <View style={styles.modalBody}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {selectedPlaylist ? 'Edit Playlist' : 'Create Playlist'}
            </Text>
            <TouchableOpacity
              style={[
                styles.modalCloseBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              ]}
              onPress={() => setShowUpdateModal(false)}
            >
              <X size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 18, paddingBottom: 20 }}>
            <View>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Playlist Name</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    color: colors.foreground,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder='My Awesome Playlist'
                placeholderTextColor={colors.mutedForeground}
                selectionColor={colors.primary}
              />
            </View>

            <View>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textAreaInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    color: colors.foreground,
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                placeholder='Give your playlist a nice description...'
                placeholderTextColor={colors.mutedForeground}
                multiline={true}
                numberOfLines={3}
                selectionColor={colors.primary}
              />
            </View>

            <Button
              variant='default'
              size='lg'
              title={selectedPlaylist ? 'Save Changes' : 'Create Playlist'}
              disabled={loading}
              isLoading={loading}
              onPress={handleSavePlaylist}
            />
          </View>
        </View>
      </SwipeableModal>

      {/* Delete Confirmation Modal */}
      <SwipeableModal
        isVisible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        maxHeight='38%'
      >
        <View style={styles.modalBody}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
                backgroundColor:
                  theme === 'dark' ? 'rgba(127, 29, 29, 0.3)' : 'rgba(254, 202, 202, 0.3)',
                padding: 14,
                borderRadius: 20,
                marginBottom: 14,
              }}
            >
              <AlertCircle size={28} color={colors.destructive} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 6 }]}>
              Delete Playlist
            </Text>
            <Text style={[styles.deleteSubText, { color: colors.mutedForeground }]}>
              Are you sure you want to delete "{selectedPlaylist?.name}"? This action cannot be
              undone.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              variant='secondary'
              title='Cancel'
              size='default'
              style={{ flex: 1 }}
              onPress={() => setShowDeleteModal(false)}
            />

            <Button
              variant='destructive'
              title='Delete'
              size='default'
              isLoading={loading}
              disabled={loading}
              icon={<Trash2 size={18} color={colors.destructiveForeground} />}
              iconPosition='left'
              style={{ flex: 1 }}
              onPress={handleDeletePlaylist}
            />
          </View>
        </View>
      </SwipeableModal>

      {!user && <LoginModal />}
    </TabSafeAreaView>
  );
};

const GRID_PADDING = 16;
const GRID_GAP = 12;
/** How far each card behind the cover peeks out above it. */
const PEEK = 6;

const RowGap = () => <View style={{ height: 20 }} />;

/**
 * A playlist cover as a small stack: the first song's art in front, the next two
 * peeking out above it, a little narrower each, so a playlist reads as a pile of songs.
 */
const CoverStack = memo(function CoverStack({
  images,
  fallback,
  width,
}: {
  images: string[];
  fallback: string;
  width: number;
}) {
  const { colors } = useTheme();
  const front = images[0] || fallback;
  const layers = [
    { inset: 16, top: 0, uri: images[2], opacity: 0.4 },
    { inset: 8, top: PEEK, uri: images[1], opacity: 0.7 },
  ];

  return (
    <View style={{ width, height: width + PEEK * 2 }}>
      {layers.map((l, i) => (
        <View
          key={i}
          style={[
            styles.stackLayer,
            {
              top: l.top,
              left: l.inset,
              right: l.inset,
              height: width - l.inset * 2,
              backgroundColor: colors.raised,
              opacity: l.opacity,
            },
          ]}
        >
          {l.uri ? (
            <Image
              source={{ uri: l.uri, cache: 'force-cache' }}
              style={styles.fill}
              fadeDuration={0}
            />
          ) : null}
        </View>
      ))}
      <View
        style={[
          styles.stackFront,
          { top: PEEK * 2, width, height: width, backgroundColor: colors.raised },
        ]}
      >
        {front ? (
          <Image
            source={{ uri: front, cache: 'force-cache' }}
            style={styles.fill}
            fadeDuration={0}
          />
        ) : (
          <Ionicons name='musical-notes' size={30} color={colors.mutedForeground} />
        )}
      </View>
    </View>
  );
});

const CreateTile = memo(function CreateTile({
  width,
  onPress,
}: {
  width: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel='Create playlist'
    >
      <View style={{ width, height: width + PEEK * 2 }}>
        <View
          style={[
            styles.stackFront,
            styles.createFront,
            { top: PEEK * 2, width, height: width, borderColor: colors.border },
          ]}
        >
          <View style={[styles.createIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name='add' size={24} color={colors.primaryForeground} />
          </View>
        </View>
      </View>
      <View style={styles.tileInfo}>
        <View style={styles.tileText}>
          <Text style={[styles.tileTitle, { color: colors.foreground }]}>New playlist</Text>
          <Text style={[styles.tileMeta, { color: colors.mutedForeground }]}>
            Start a collection
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});

/** One of your playlists: stacked cover, name, size and last update, plus a "more" button. */
export const PlaylistTile = memo(function PlaylistTile({
  playlist,
  width,
  onMore,
}: {
  playlist: any;
  width: number;
  onMore: (playlist: any) => void;
}) {
  const { colors } = useTheme();

  const securedPlaylist = useMemo(() => ensureHttpsForPlaylistUrls(playlist), [playlist]);
  const previewImages = useMemo(
    () =>
      (Array.isArray(playlist.previewSongs) ? (playlist.previewSongs as PlaylistPreviewSong[]) : [])
        .map((song) => getImageUrl(song.image))
        .filter(Boolean),
    [playlist.previewSongs]
  );

  const open = useCallback(() => {
    router.push({ pathname: '/user-playlist', params: { id: playlist.id } });
  }, [playlist.id]);
  const more = useCallback(() => onMore(playlist), [onMore, playlist]);

  const songCount = Number(playlist.songCount) || 0;
  const updated = formatRelativeDate(playlist.lastAddedAt)?.replace(/^Updated /, '');
  const meta = `${songCount} ${songCount === 1 ? 'song' : 'songs'}${updated ? ` · ${updated}` : ''}`;

  return (
    <PressableScale
      onPress={open}
      onLongPress={more}
      delayLongPress={350}
      accessibilityRole='button'
      accessibilityLabel={`${securedPlaylist.name}, ${meta}`}
    >
      <CoverStack
        images={previewImages}
        fallback={getImageUrl(securedPlaylist?.image)}
        width={width}
      />
      <View style={styles.tileInfo}>
        <View style={styles.tileText}>
          <Text style={[styles.tileTitle, { color: colors.foreground }]} numberOfLines={1}>
            {securedPlaylist.name}
          </Text>
          <Text style={[styles.tileMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <PressableScale
          onPress={more}
          scaleTo={BUTTON_PRESS_SCALE}
          hitSlop={10}
          accessibilityRole='button'
          accessibilityLabel={`More options for ${securedPlaylist.name}`}
          style={styles.moreBtn}
        >
          <Ionicons name='ellipsis-horizontal' size={17} color={colors.mutedForeground} />
        </PressableScale>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 32,
    marginBottom: 6,
  },
  count: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
  },
  sortText: { fontSize: 12.5, fontWeight: '700' },

  gridRow: { gap: GRID_GAP, paddingHorizontal: GRID_PADDING },
  stackLayer: { position: 'absolute', borderRadius: 12, overflow: 'hidden' },
  stackFront: {
    position: 'absolute',
    left: 0,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  createFront: { borderWidth: 1.5, borderStyle: 'dashed' },
  createIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  tileText: { flex: 1, minWidth: 0, gap: 2 },
  tileTitle: { fontFamily: fonts.displaySemibold, fontSize: 15, letterSpacing: -0.2 },
  tileMeta: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
  moreBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -6,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 32,
    paddingTop: 24,
    textAlign: 'center',
  },

  // Modal Styles
  modalBody: {
    padding: 22,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    borderRadius: 20,
    padding: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textAreaInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  deleteSubText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PlaylistScreen;
