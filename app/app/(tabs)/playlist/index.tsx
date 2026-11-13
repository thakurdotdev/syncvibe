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
import { AlertCircle, Edit3, Trash2, X } from '@/components/ui/icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { TabLoading } from '@/components/ui/TabLoading';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';
import { TabHeader } from '@/components/ui/AppHeader';
import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import PressableScale from '@/components/ui/PressableScale';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';

const linkOf = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const link = (item as { link?: unknown }).link;
    if (typeof link === 'string') return link;
  }
  return '';
};

/** A small cover: the 150px size where there is one. A row shows it at 52px, so the 500px
 * version would only cost decoding time. */
const getCoverUrl = (image: unknown): string => {
  const item = Array.isArray(image)
    ? (image.find((entry) => (entry as { quality?: string })?.quality === '150x150') ??
      image[1] ??
      image[0])
    : image;
  const link = linkOf(item);
  return link ? convertToHttps(link) : '';
};

type SortMode = 'recent' | 'name';

const lastAddedTime = (p: any) => {
  const t = p?.lastAddedAt ? new Date(p.lastAddedAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
};

const PlaylistScreen = () => {
  const api = useApi();
  const { colors, theme } = useTheme();
  const { user, loading: userLoading } = useUser();
  const { userPlaylist, setUserPlaylist } = usePlaylistState();
  const [loading, setLoading] = useState(false);
  // Until the first answer, an empty list only means "not loaded yet", not "no playlists".
  const [fetched, setFetched] = useState(false);

  const getPlaylists = async () => {
    try {
      const { data } = await api.get('/api/playlist/get');
      if (data?.data) setUserPlaylist(data.data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setFetched(true);
    }
  };

  // Saved playlists show straight away; this brings in changes from your other devices.
  const userId = user?.userid;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    api
      .get('/api/playlist/get')
      .then(({ data }) => {
        if (active && data?.data) setUserPlaylist(data.data);
      })
      .catch((error) => console.error('Error fetching playlists:', error))
      .finally(() => {
        if (active) setFetched(true);
      });
    return () => {
      active = false;
    };
  }, [api, userId, setUserPlaylist]);

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

  if (!user) {
    return userLoading ? <TabLoading title='Library' /> : <LoginScreen />;
  }

  const count = sortedPlaylists.length;
  const countKnown = fetched || count > 0;

  const renderPlaylistItem = ({ item }: { item: any }) => (
    <PlaylistRow playlist={item} onMore={handleLongPress} />
  );

  return (
    <TabSafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <TabHeader title='Library' />

      <Animated.FlatList
        data={sortedPlaylists}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => `playlist-${item.id}`}
        initialNumToRender={12}
        windowSize={7}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: DECK_CLEARANCE }}
        ListHeaderComponent={
          <>
            <View style={styles.shortcuts}>
              <Shortcut icon='add' label='New playlist' onPress={openCreateModal} />
              <Shortcut icon='time-outline' label='History' onPress={openHistory} />
            </View>
            <View style={styles.toolbar}>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>
                {countKnown ? `${count} ${count === 1 ? 'playlist' : 'playlists'}` : ''}
              </Text>
              {count > 1 && (
                <PressableScale
                  onPress={toggleSort}
                  scaleTo={BUTTON_PRESS_SCALE}
                  hitSlop={10}
                  accessibilityRole='button'
                  accessibilityLabel={`Sorted by ${sort === 'recent' ? 'recently updated' : 'name'}. Change sort`}
                  style={styles.sort}
                >
                  <Text style={[styles.count, { color: colors.mutedForeground }]}>
                    {sort === 'recent' ? 'Recent' : 'A–Z'}
                  </Text>
                  <Ionicons name='swap-vertical' size={13} color={colors.mutedForeground} />
                </PressableScale>
              )}
            </View>
          </>
        }
        ListFooterComponent={
          countKnown && count === 0 ? (
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
            <PressableScale
              style={[
                styles.modalCloseBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              ]}
              onPress={() => setShowActionsModal(false)}
            >
              <X size={18} color={colors.mutedForeground} />
            </PressableScale>
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
            <PressableScale
              style={[
                styles.modalCloseBtn,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
              ]}
              onPress={() => setShowUpdateModal(false)}
            >
              <X size={18} color={colors.mutedForeground} />
            </PressableScale>
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

const COVER = 52;
/** How much of each cover behind the front one shows. */
const STACK_STEP = 9;
/** Every row keeps this width for its art, so all the names line up. */
const ART_WIDTH = COVER + STACK_STEP * 2;

const openHistory = () => router.push('/song-history');

/** Up to three different covers from the newest songs, front first. */
const coversOf = (playlist: any): string[] => {
  const preview: PlaylistPreviewSong[] = Array.isArray(playlist.previewSongs)
    ? playlist.previewSongs
    : [];
  const uris = [...new Set(preview.map((song) => getCoverUrl(song.image)).filter(Boolean))];
  if (!uris.length) {
    const own = getCoverUrl(ensureHttpsForPlaylistUrls(playlist)?.image);
    if (own) uris.push(own);
  }
  return uris.slice(0, 3);
};

/**
 * The newest covers fanned out, solid and dimmed toward the back. Fewer than three: one cover.
 * Images come from the cache with no fade, so rows never pop.
 */
const CoverStack = memo(function CoverStack({ uris }: { uris: string[] }) {
  const { colors } = useTheme();
  const tile = [styles.cover, { backgroundColor: colors.raised }];
  const fanned = uris.length >= 3;

  return (
    <View style={styles.art}>
      {fanned &&
        BEHIND.map(({ at, style, dim }) => (
          <View key={at} style={[tile, style]}>
            <Image
              source={{ uri: uris[at], cache: 'force-cache' }}
              style={styles.fill}
              fadeDuration={0}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background, opacity: dim },
              ]}
            />
          </View>
        ))}
      <View style={tile}>
        {uris[0] ? (
          <Image
            source={{ uri: uris[0], cache: 'force-cache' }}
            style={styles.fill}
            fadeDuration={0}
          />
        ) : (
          <Ionicons name='musical-notes' size={20} color={colors.mutedForeground} />
        )}
      </View>
    </View>
  );
});

/** A compact action above the list (new playlist, history). Two share one line. */
const Shortcut = memo(function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={[styles.shortcut, { backgroundColor: colors.raised }]}
    >
      <Ionicons name={icon} size={18} color={colors.foreground} />
      <Text style={[styles.shortcutText, { color: colors.foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
});

/** One of your playlists: its newest covers, its name and how many songs. Long-press for options. */
const PlaylistRow = memo(function PlaylistRow({
  playlist,
  onMore,
}: {
  playlist: any;
  onMore: (playlist: any) => void;
}) {
  const { colors } = useTheme();
  const covers = useMemo(() => coversOf(playlist), [playlist]);

  const open = useCallback(() => {
    router.push({ pathname: '/user-playlist', params: { id: playlist.id } });
  }, [playlist.id]);
  const more = useCallback(() => onMore(playlist), [onMore, playlist]);

  const songCount = Number(playlist.songCount) || 0;
  const meta = `${songCount} ${songCount === 1 ? 'song' : 'songs'}`;

  return (
    <PressableScale
      onPress={open}
      onLongPress={more}
      delayLongPress={350}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`${playlist.name}, ${meta}`}
      accessibilityHint='Long press to edit or delete'
      accessibilityActions={MORE_ACTIONS}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') more();
      }}
      style={styles.row}
    >
      <CoverStack uris={covers} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </PressableScale>
  );
});

const MORE_ACTIONS = [{ name: 'longpress', label: 'Edit or delete' }];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  shortcuts: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  shortcut: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shortcutText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 36,
    marginTop: 6,
  },
  count: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  art: { width: ART_WIDTH, height: COVER },
  cover: {
    position: 'absolute',
    left: 0,
    width: COVER,
    height: COVER,
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  behindNear: { left: STACK_STEP, transform: [{ scale: 0.91 }] },
  behindFar: { left: STACK_STEP * 2, transform: [{ scale: 0.82 }] },
  fill: { width: '100%', height: '100%' },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
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

/** The covers behind the front one, back first, so the front is drawn last. */
const BEHIND = [
  { at: 2, style: styles.behindFar, dim: 0.55 },
  { at: 1, style: styles.behindNear, dim: 0.3 },
];

export default PlaylistScreen;
