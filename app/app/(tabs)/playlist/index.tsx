import LoginModal from '@/components/LoginModal';
import LoginScreen from '@/components/LoginScreen';
import { CardContainer, CardImage } from '@/components/music/MusicCards';
import SwipeableModal from '@/components/SwipeableModal';
import Button from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { useUser } from '@/context/UserContext';
import { usePlaylistState } from '@/stores/playerStore';
import { convertToHttps, ensureHttpsForPlaylistUrls } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import type { PlaylistPreviewSong } from '@/types/music';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AlertCircle, Edit3, History as HistoryIcon, Plus, Trash2, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { TabSafeAreaView } from '@/components/ui/TabSafeAreaView';

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
  if (minutes < 1) return 'Added just now';
  if (minutes < 60) return `Added ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Added ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Added ${days}d ago`;

  return `Added ${new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
};

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

  // Prepend "+ Create New" item to grid
  const gridData = useMemo(() => {
    return [{ isCreateTile: true, id: 'create-tile' }, ...(userPlaylist || [])];
  }, [userPlaylist]);

  const isDark = theme === 'dark';

  if (loading && !selectedPlaylist) return <LoadingState />;

  if (!user) {
    return <LoginScreen />;
  }

  const renderPlaylistItem = ({ item }: { item: any }) => {
    if (item.isCreateTile) {
      return (
        <View style={styles.gridItemWrapper}>
          <CardContainer onPress={openCreateModal} width={'100%'}>
            <View style={{ padding: 10, gap: 8 }}>
              <LinearGradient
                colors={[colors.primary, colors.primary + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createCoverGradient}
              >
                <View style={styles.createIconBadge}>
                  <Plus size={24} color={colors.primaryForeground} />
                </View>
              </LinearGradient>

              <View style={{ gap: 2, paddingHorizontal: 2 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: '700',
                    fontSize: 14.5,
                    lineHeight: 19,
                  }}
                  numberOfLines={1}
                >
                  New Playlist
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12.5,
                    lineHeight: 16,
                  }}
                  numberOfLines={1}
                >
                  Create & curate
                </Text>
              </View>
            </View>
          </CardContainer>
        </View>
      );
    }

    return (
      <View style={styles.gridItemWrapper}>
        <PlaylistCard playlist={item} isUser={true} onLongPress={() => handleLongPress(item)} />
      </View>
    );
  };

  return (
    <TabSafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Library</Text>
          <Text style={[styles.headerSubTitle, { color: colors.mutedForeground }]}>
            {userPlaylist?.length || 0} custom playlists
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/song-history')}
            activeOpacity={0.8}
            accessibilityLabel='Open listening history'
            accessibilityRole='button'
            style={[
              styles.headerActionBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            ]}
          >
            <HistoryIcon size={17} color={colors.primary} />
            <Text style={[styles.headerActionText, { color: colors.primary }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openCreateModal}
            activeOpacity={0.8}
            accessibilityLabel='Create playlist'
            accessibilityRole='button'
            style={[
              styles.headerActionBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            ]}
          >
            <Plus size={18} color={colors.primary} />
            <Text style={[styles.headerActionText, { color: colors.primary }]}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Playlist Grid */}
      <Animated.FlatList
        data={gridData}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => `playlist-${item.id}`}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
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

export const PlaylistCard = memo(({ playlist, isUser, onLongPress }: any) => {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/user-playlist',
      params: { id: playlist.id },
    });
  }, [playlist?.id]);

  if (!playlist?.name) return null;

  const securedPlaylist = useMemo(() => ensureHttpsForPlaylistUrls(playlist), [playlist]);
  const previewSongs = useMemo<PlaylistPreviewSong[]>(
    () => (Array.isArray(playlist.previewSongs) ? playlist.previewSongs : []),
    [playlist.previewSongs]
  );
  const previewImages = useMemo(
    () =>
      previewSongs
        .map((song) => getImageUrl(song.image))
        .filter(Boolean)
        .slice(0, 4),
    [previewSongs]
  );
  const imageUrl = getImageUrl(securedPlaylist?.image);
  const songCount = Number(playlist.songCount) || 0;
  const addedLabel = formatRelativeDate(playlist.lastAddedAt);
  const metaLabel = `${songCount} ${songCount === 1 ? 'song' : 'songs'}${
    addedLabel ? ` · ${addedLabel}` : ''
  }`;

  const renderCover = () => {
    if (previewImages.length === 1) {
      return (
        <Image
          source={{ uri: previewImages[0], cache: 'force-cache' }}
          style={styles.previewSingle}
          resizeMode='cover'
          alt={`Playlist: ${securedPlaylist.name}`}
        />
      );
    }

    if (previewImages.length === 2) {
      return (
        <View style={styles.previewRow}>
          <Image
            source={{ uri: previewImages[0], cache: 'force-cache' }}
            style={styles.previewHalf}
            resizeMode='cover'
            alt={`Playlist: ${securedPlaylist.name}`}
          />
          <Image
            source={{ uri: previewImages[1], cache: 'force-cache' }}
            style={styles.previewHalf}
            resizeMode='cover'
            alt={`Playlist song preview 2`}
          />
        </View>
      );
    }

    if (previewImages.length === 3) {
      return (
        <View style={styles.previewRow}>
          <Image
            source={{ uri: previewImages[0], cache: 'force-cache' }}
            style={styles.previewHero}
            resizeMode='cover'
            alt={`Playlist: ${securedPlaylist.name}`}
          />
          <View style={styles.previewSideColumn}>
            <Image
              source={{ uri: previewImages[1], cache: 'force-cache' }}
              style={styles.previewSideItem}
              resizeMode='cover'
              alt={`Playlist song preview 2`}
            />
            <Image
              source={{ uri: previewImages[2], cache: 'force-cache' }}
              style={styles.previewSideItem}
              resizeMode='cover'
              alt={`Playlist song preview 3`}
            />
          </View>
        </View>
      );
    }

    if (previewImages.length >= 4) {
      return (
        <View style={styles.previewGrid}>
          <View style={styles.previewGridRow}>
            <Image
              source={{ uri: previewImages[0], cache: 'force-cache' }}
              style={styles.previewGridItem}
              resizeMode='cover'
              alt={`Playlist: ${securedPlaylist.name}`}
            />
            <Image
              source={{ uri: previewImages[1], cache: 'force-cache' }}
              style={styles.previewGridItem}
              resizeMode='cover'
              alt={`Playlist song preview 2`}
            />
          </View>
          <View style={styles.previewGridRow}>
            <Image
              source={{ uri: previewImages[2], cache: 'force-cache' }}
              style={styles.previewGridItem}
              resizeMode='cover'
              alt={`Playlist song preview 3`}
            />
            <Image
              source={{ uri: previewImages[3], cache: 'force-cache' }}
              style={styles.previewGridItem}
              resizeMode='cover'
              alt={`Playlist song preview 4`}
            />
          </View>
        </View>
      );
    }

    return <CardImage uri={imageUrl} alt={`Playlist: ${securedPlaylist.name}`} />;
  };

  return (
    <CardContainer
      onPress={handlePress}
      onLongPress={isUser ? () => onLongPress(playlist) : undefined}
      key={securedPlaylist.id}
      width={'100%'}
    >
      <View style={{ padding: 10, gap: 8 }}>
        <View style={styles.previewCover}>{renderCover()}</View>

        <View style={{ gap: 2, paddingHorizontal: 2 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: '700',
              fontSize: 14.5,
              lineHeight: 19,
            }}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {securedPlaylist.name}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 12.5,
              lineHeight: 17,
              fontWeight: '500',
            }}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {metaLabel}
          </Text>
          {securedPlaylist.description ? (
            <Text
              style={[styles.playlistDescription, { color: colors.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {securedPlaylist.description}
            </Text>
          ) : null}
        </View>
      </View>
    </CardContainer>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  previewSingle: {
    width: '100%',
    height: '100%',
  },
  previewRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  previewHalf: {
    flex: 1,
    height: '100%',
  },
  previewHero: {
    flex: 1,
    height: '100%',
  },
  previewSideColumn: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    height: '100%',
  },
  previewSideItem: {
    flex: 1,
    width: '100%',
  },
  previewGrid: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  previewGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  previewGridItem: {
    flex: 1,
    height: '100%',
  },
  playlistDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingBottom: 130,
  },
  columnWrapper: {
    marginBottom: 12,
  },
  gridItemWrapper: {
    flex: 1,
    maxWidth: '50%',
    paddingHorizontal: 6,
  },

  createCoverGradient: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  createIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
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
