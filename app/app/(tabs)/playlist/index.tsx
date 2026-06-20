import LoginScreen from '@/components/LoginScreen';
import SwipeableModal from '@/components/common/SwipeableModal';
import LoginModal from '@/components/LoginModal';
import { CardContainer, CardImage } from '@/components/music/MusicCards';
import Button from '@/components/ui/button';
import { usePlaylistState } from '@/stores/playerStore';
import { toast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { ensureHttpsForPlaylistUrls } from '@/utils/getHttpsUrls';
import useApi from '@/utils/hooks/useApi';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AlertCircle, Edit3, Music4, Plus, Trash2, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const LoadingState = () => {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size='large' color={colors.primary} />
      <Text
        style={{
          color: colors.text,
          marginTop: 16,
          fontSize: 16,
          fontWeight: '500',
        }}
      >
        Loading playlists...
      </Text>
    </SafeAreaView>
  );
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

  // Hide keyboard when modals close
  useEffect(() => {
    if (!showUpdateModal && !showDeleteModal) {
      Keyboard.dismiss();
    }
  }, [showUpdateModal, showDeleteModal]);

  const handleSavePlaylist = async () => {
    setLoading(true);
    try {
      if (!formData.name) {
        toast('Please provide a playlist name');
        setLoading(false);
        return;
      }

      if (selectedPlaylist) {
        await api.put(`/api/playlist/update`, {
          id: selectedPlaylist.id,
          name: formData.name,
          description: formData.description,
        });
        toast('Playlist updated successfully!');
      } else {
        await api.post(`/api/playlist/create`, {
          name: formData.name,
          description: formData.description,
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlaylist(playlist);
    setFormData({
      name: playlist.name || '',
      description: playlist.description || '',
    });
    setShowActionsModal(true);
  };

  const handleUpdateAction = () => {
    setShowActionsModal(false);
    setTimeout(() => setShowUpdateModal(true), 300);
  };

  const handleDeleteAction = () => {
    setShowActionsModal(false);
    setTimeout(() => setShowDeleteModal(true), 300);
  };

  if (loading && !selectedPlaylist) return <LoadingState />;

  if (!user) {
    return <LoginScreen />;
  }

  const renderPlaylistItem = ({ item }: { item: any }) => (
    <View style={{ flex: 1, paddingHorizontal: 6 }}>
      <PlaylistCard playlist={item} isUser={true} onLongPress={() => handleLongPress(item)} />
    </View>
  );

  const EmptyState = () => (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 48,
      }}
    >
      <View
        style={{
          backgroundColor: colors.muted,
          borderRadius: 32,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <Music4 size={48} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          color: colors.text,
          fontSize: 20,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        No playlists yet
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 16,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 32,
        }}
      >
        Create your first playlist to start organizing your favorite music
      </Text>
      <Button
        variant='default'
        size='lg'
        icon={<Plus size={20} color={colors.primaryForeground} />}
        iconPosition='left'
        title='Create Playlist'
        onPress={() => {
          setSelectedPlaylist(null);
          setFormData({ name: '', description: '' });
          setShowUpdateModal(true);
        }}
      />
    </View>
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: 20,
          }}
        >
          My Playlists
        </Text>
        <Button
          variant='outline'
          size='sm'
          icon={<Plus size={18} color={colors.primary} />}
          iconPosition='left'
          title='Create'
          onPress={() => {
            setSelectedPlaylist(null);
            setFormData({ name: '', description: '' });
            setShowUpdateModal(true);
          }}
        />
      </View>

      {/* Playlist Grid */}
      <Animated.FlatList
        data={userPlaylist}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => `playlist-${item.id}`}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 24,
          flexGrow: userPlaylist.length === 0 ? 1 : undefined,
        }}
        columnWrapperStyle={userPlaylist.length > 0 ? { marginBottom: 12 } : undefined}
        ListEmptyComponent={EmptyState}
      />

      {/* Actions Modal */}
      <SwipeableModal
        isVisible={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        maxHeight='30%'
      >
        <View
          style={{
            padding: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 20,
                fontWeight: '700',
              }}
            >
              Playlist Options
            </Text>
            <TouchableOpacity
              style={{
                borderRadius: 8,
                padding: 8,
                backgroundColor: colors.muted,
              }}
              onPress={() => setShowActionsModal(false)}
            >
              <X size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12 }}>
            <Button
              variant='secondary'
              title='Edit Playlist'
              icon={<Edit3 size={20} color={colors.primary} />}
              iconPosition='left'
              onPress={handleUpdateAction}
            />

            <Button
              variant='destructive'
              title='Delete Playlist'
              icon={<Trash2 size={20} color={colors.destructiveForeground} />}
              iconPosition='left'
              onPress={handleDeleteAction}
            />
          </View>
        </View>
      </SwipeableModal>

      {/* Update Modal */}
      <SwipeableModal
        isVisible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        scrollable={true}
        useScrollView={true}
      >
        <View
          style={{
            padding: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 22,
                fontWeight: '700',
              }}
            >
              {selectedPlaylist ? 'Edit Playlist' : 'Create Playlist'}
            </Text>
            <TouchableOpacity
              style={{
                borderRadius: 8,
                padding: 8,
                backgroundColor: colors.muted,
              }}
              onPress={() => setShowUpdateModal(false)}
            >
              <X size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 20 }}>
            <View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  marginBottom: 8,
                  fontWeight: '600',
                }}
              >
                Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.muted,
                  color: colors.text,
                  padding: 16,
                  borderRadius: 12,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder='Enter playlist name'
                placeholderTextColor={colors.mutedForeground}
                selectionColor={colors.primary}
              />
            </View>

            <View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 16,
                  marginBottom: 8,
                  fontWeight: '600',
                }}
              >
                Description
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.muted,
                  color: colors.text,
                  padding: 16,
                  borderRadius: 12,
                  height: 100,
                  textAlignVertical: 'top',
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                placeholder='Enter description'
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
        maxHeight='35%'
      >
        <View
          style={{
            padding: 24,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
                backgroundColor:
                  theme === 'dark' ? 'rgba(127, 29, 29, 0.3)' : 'rgba(254, 202, 202, 0.3)',
                padding: 16,
                borderRadius: 20,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={32} color={colors.destructive} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontSize: 22,
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              Delete Playlist
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontSize: 16,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
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
    </SafeAreaView>
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

  const subtitle = securedPlaylist.description || 'Playlist';
  const imageUrl = securedPlaylist?.image
    ? securedPlaylist.image[2]?.link
    : 'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_500,w_500/f_auto/v1736541047/posts/sjzxfa31iet8ftznv2mo.webp';

  return (
    <CardContainer
      onPress={handlePress}
      onLongPress={isUser ? () => onLongPress(playlist) : undefined}
      key={securedPlaylist.id}
      width={'100%'}
    >
      <View style={{ padding: 12, gap: 8 }}>
        <CardImage uri={imageUrl} alt={`Playlist: ${securedPlaylist.name}`} />

        <View style={{ gap: 2, paddingHorizontal: 2 }}>
          <Text
            style={{
              color: colors.text,
              fontWeight: '600',
              fontSize: 15,
              lineHeight: 20,
            }}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {securedPlaylist.name}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 13,
              lineHeight: 18,
            }}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </CardContainer>
  );
});

export default PlaylistScreen;
