import { usePlaylistState } from '@/stores/playerStore';
import { Song } from '@/types/song';
import useApi from '@/utils/hooks/useApi';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeableModal from '../common/SwipeableModal';

export interface Playlist {
  id: string;
  name: string;
  image?: any[];
  songCount: number;
}

interface AddToPlaylistProps {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  song: Song | undefined;
}

const AddToPlaylist: React.FC<AddToPlaylistProps> = ({ dialogOpen, setDialogOpen, song }) => {
  const insets = useSafeAreaInsets();
  const { userPlaylist, setUserPlaylist } = usePlaylistState();
  const api = useApi();

  const getPlaylists = async () => {
    try {
      const { data } = await api.get('/api/playlist/get');
      if (data?.data) setUserPlaylist(data.data);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const [newPlaylistDialog, setNewPlaylistDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingSong, setAddingSong] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [addingSuccess, setAddingSuccess] = useState(false);

  // Animation value for success indicator
  const successOpacity = new Animated.Value(0);

  // Add state for tracking FlatList scroll position
  const [isListAtTop, setIsListAtTop] = useState(true);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      setSearchQuery('');
      setSelectedPlaylistId(null);
      setAddingSuccess(false);
    }
  }, [dialogOpen]);

  // Animated success appearance
  useEffect(() => {
    if (addingSuccess) {
      Animated.sequence([
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Close dialog after animation completes
        setDialogOpen(false);
        setAddingSuccess(false);
        setSelectedPlaylistId(null);
      });
    } else {
      successOpacity.setValue(0);
    }
  }, [addingSuccess]);

  // Filtered playlists based on search
  const filteredPlaylists = userPlaylist.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Create new playlist
  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    setLoading(true);
    try {
      const response = await api.post(
        `/api/playlist/create`,
        { name: newPlaylistName },
        { withCredentials: true }
      );

      if (response.status === 200) {
        await getPlaylists();
        setNewPlaylistDialog(false);
        setNewPlaylistName('');
      }
    } catch (error: any) {
      Alert.alert(error.response?.data.message || 'Failed to create playlist');
      console.error('Failed to create playlist', error);
    } finally {
      setLoading(false);
    }
  };

  // Add song to playlist
  const handleAddToPlaylist = async (playlistId: string) => {
    if (!playlistId || !song || addingSong) return;

    setSelectedPlaylistId(playlistId);
    setAddingSong(true);

    try {
      const response = await api.post(
        `/api/playlist/add-song`,
        {
          playlistId,
          songId: song.id,
          songData: JSON.stringify(song),
        },
        { withCredentials: true }
      );

      if (response.status === 201) {
        setAddingSuccess(true);
        await getPlaylists();
      }
    } catch (error: any) {
      Alert.alert(error.response?.data.message || 'Failed to add song to playlist');
      console.error('Failed to add song to playlist', error);
      setSelectedPlaylistId(null);
    } finally {
      setAddingSong(false);
    }
  };

  const getImageUrl = (images: any[]) => {
    if (images && images.length > 0) {
      return images[1]?.link || images[0]?.link;
    }
    return '';
  };

  // Handle FlatList scroll events
  const handleFlatListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setIsListAtTop(offsetY <= 0);
  };

  // Render playlist item
  const renderPlaylistItem = ({ item }: { item: Playlist }) => {
    const isSelected = selectedPlaylistId === item.id;
    const isDisabled = addingSong && !isSelected;

    return (
      <TouchableOpacity
        onPress={() => !addingSong && handleAddToPlaylist(item.id)}
        style={[
          styles.playlistItem,
          isSelected && styles.selectedPlaylistItem,
          isDisabled && styles.disabledPlaylistItem,
        ]}
        activeOpacity={isDisabled ? 1 : 0.7}
      >
        <Image
          source={
            item.image && getImageUrl(item.image)
              ? { uri: getImageUrl(item.image) }
              : require('../../assets/icon.jpg')
          }
          style={styles.playlistImage}
        />
        <View style={styles.playlistTextContainer}>
          <Text style={styles.playlistName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.playlistSongCount}>
            {item.songCount || 0} {item.songCount === 1 ? 'song' : 'songs'}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.addingIndicatorContainer}>
            {addingSuccess ? (
              <Animated.View style={[styles.addingSuccessIndicator, { opacity: successOpacity }]}>
                <MaterialIcons name='check' size={20} color='white' />
              </Animated.View>
            ) : (
              <ActivityIndicator size='small' color='white' />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <SwipeableModal
        isVisible={dialogOpen}
        onClose={() => setDialogOpen(false)}
        backgroundColor='#121214'
        backdropOpacity={0.7}
        scrollable={true}
        useScrollView={false}
        maxHeight='90%'
        onScroll={handleFlatListScroll}
      >
        <View className='p-4'>
          {/* Header */}
          <View style={styles.header}>
            <MaterialIcons name='playlist-add' size={24} color='#fff' />
            <Text style={styles.headerTitle}>Add to Playlist</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setDialogOpen(false)}>
              <MaterialIcons name='close' size={22} color='#9ca3af' />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <MaterialIcons name='search' size={20} color='#9ca3af' style={styles.searchIcon} />
            <TextInput
              placeholder='Search playlists...'
              placeholderTextColor='#9ca3af'
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <MaterialIcons name='close' size={18} color='#9ca3af' />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Create New Playlist Button */}
          <TouchableOpacity
            style={styles.createPlaylistButton}
            onPress={() => setNewPlaylistDialog(true)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <MaterialIcons name='add' size={22} color='white' />
            <Text style={styles.createPlaylistButtonText}>Create New Playlist</Text>
          </TouchableOpacity>

          {/* Playlists List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size='large' color='#8b5cf6' />
              <Text style={styles.loadingText}>Loading playlists...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPlaylists}
              renderItem={renderPlaylistItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name='queue-music' size={48} color='#9ca3af' />
                  <Text style={styles.emptyStateText}>
                    {searchQuery
                      ? 'No matching playlists found'
                      : 'No playlists yet. Create one to get started!'}
                  </Text>
                </View>
              }
              contentContainerStyle={styles.playlistList}
              showsVerticalScrollIndicator={false}
              onScroll={handleFlatListScroll}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
            />
          )}
        </View>

        {/* New Playlist Modal */}
      </SwipeableModal>
      <SwipeableModal
        isVisible={newPlaylistDialog}
        onClose={() => setNewPlaylistDialog(false)}
        backgroundColor='transparent'
        backdropOpacity={0.4}
        maxHeight='auto'
      >
        <View style={styles.newPlaylistContainer}>
          <Text style={styles.newPlaylistTitle}>Create New Playlist</Text>

          <TextInput
            placeholder='Enter playlist name'
            placeholderTextColor='#9ca3af'
            value={newPlaylistName}
            onChangeText={setNewPlaylistName}
            style={styles.newPlaylistInput}
            autoFocus
            selectionColor='#8b5cf6'
          />

          <View style={styles.newPlaylistButtonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setNewPlaylistDialog(false);
                setNewPlaylistName('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.createButton,
                (!newPlaylistName.trim() || loading) && styles.disabledButton,
              ]}
              onPress={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size='small' color='white' />
              ) : (
                <Text style={styles.createButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SwipeableModal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
    flex: 1,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    height: 50,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  createPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4c1d95',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  createPlaylistButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  songInfoContainer: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  songInfoLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 4,
  },
  songDetails: {
    flexDirection: 'column',
  },
  songTitle: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  songArtist: {
    color: '#d1d5db',
    fontSize: 14,
    marginTop: 2,
  },
  playlistList: {
    paddingBottom: 16,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  selectedPlaylistItem: {
    backgroundColor: '#3a3a45',
    borderWidth: 1,
    borderColor: '#8b5cf6',
  },
  disabledPlaylistItem: {
    opacity: 0.5,
  },
  playlistImage: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 14,
  },
  playlistTextContainer: {
    flex: 1,
  },
  playlistName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  playlistSongCount: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  addingIndicatorContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4c1d95',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addingSuccessIndicator: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#d1d5db',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 16,
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  newPlaylistContainer: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
  },
  newPlaylistTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  newPlaylistInput: {
    backgroundColor: '#27272a',
    color: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  newPlaylistButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#3f3f46',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  createButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default AddToPlaylist;
