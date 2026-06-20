import { usePlayerControls, usePlaybackState, usePlaylistState } from '@/stores/playerStore';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { Song } from '@/types/song';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SwipeableModal from '../common/SwipeableModal';
import AddToPlaylist from './AddToPlaylist';

interface PlayerDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  song: Song;
}

const NewPlayerDrawer: React.FC<PlayerDrawerProps> = ({ isVisible, onClose, song }) => {
  const { colors } = useTheme();
  const [playlistModal, setPlaylistModal] = useState(false);
  const { addToQueue, removeFromQueue } = usePlayerControls();
  const { currentSong } = usePlaybackState();
  const { playlist } = usePlaylistState();

  const artistName = song.artist_map?.artists || [{ name: 'Unknown Artist', id: null }];
  const albumArt = song.image?.[2]?.link || song.image?.[1]?.link;

  const handlePress = (id: string, path: string) => {
    onClose();
    router.push({
      pathname: path as any,
      params: { id },
    });
  };

  const paths = {
    artist: '/artist',
    albums: '/albums',
  };

  const isSongInQueue = playlist.some((item) => item.id === song.id);

  const handleAddToQueue = () => {
    if (isSongInQueue) {
      removeFromQueue(song.id);
      toast('Removed from Queue');
    } else {
      addToQueue(song);
      toast('Added to Queue');
    }
    onClose();
  };

  return (
    <>
      <SwipeableModal isVisible={isVisible} onClose={onClose}>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.albumArtContainer}>
              <Image source={{ uri: albumArt }} style={styles.albumArt} resizeMode='cover' />
            </View>
            <View style={styles.songInfoContainer}>
              <Text style={[styles.songTitle, { color: colors.foreground }]} numberOfLines={1}>
                {song.name}
              </Text>
              <Text
                style={[styles.artistName, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {artistName?.[0].name}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.optionsContainer}>
            {currentSong?.id !== song.id && (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={handleAddToQueue}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <MaterialIcons name='queue-music' size={22} color={colors.foreground} />
                </View>
                <Text style={[styles.optionText, { color: colors.foreground }]}>
                  {isSongInQueue ? 'Remove from Queue' : 'Add to Queue'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setPlaylistModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <MaterialIcons name='playlist-add' size={22} color={colors.foreground} />
              </View>
              <Text style={[styles.optionText, { color: colors.foreground }]}>Add to Playlist</Text>
            </TouchableOpacity>

            {artistName?.[0].id && (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => handlePress(artistName?.[0].id, paths.artist)}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name='person-outline' size={20} color={colors.foreground} />
                </View>
                <Text style={[styles.optionText, { color: colors.foreground }]}>View Artist</Text>
              </TouchableOpacity>
            )}

            {song?.album_id && (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => handlePress(song.album_id, paths.albums)}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name='disc-outline' size={20} color={colors.foreground} />
                </View>
                <Text style={[styles.optionText, { color: colors.foreground }]}>View Album</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SwipeableModal>
      {playlistModal && (
        <AddToPlaylist
          dialogOpen={playlistModal}
          setDialogOpen={() => setPlaylistModal(false)}
          song={song}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  albumArtContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
  },
  albumArt: {
    width: '100%',
    height: '100%',
  },
  songInfoContainer: {
    flex: 1,
    marginLeft: 16,
  },
  songTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  artistName: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginHorizontal: 24,
    marginVertical: 4,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NewPlayerDrawer;
