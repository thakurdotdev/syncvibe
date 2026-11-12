import { usePlayerControls, usePlaybackState, usePlaylistState } from '@/stores/playerStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useDislikeSong } from '@/queries/useMusic';
import { useTheme } from '@/context/ThemeContext';
import { toast } from '@/context/ToastContext';
import { Song } from '@/types/song';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import PressableScale from '@/components/ui/PressableScale';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import SwipeableModal from '../SwipeableModal';
import AddToPlaylist from './AddToPlaylist';

interface PlayerDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  song: Song;
}

const OptionRow = ({
  icon,
  label,
  color,
  emphasized,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  emphasized?: boolean;
  onPress: () => void;
}) => (
  <PressableScale scaleTo={ROW_PRESS_SCALE} style={styles.optionRow} onPress={onPress}>
    <View style={styles.iconContainer}>{icon}</View>
    <Text style={[styles.optionText, { color }, emphasized && styles.optionTextEmphasized]}>
      {label}
    </Text>
  </PressableScale>
);

const NewPlayerDrawer: React.FC<PlayerDrawerProps> = ({ isVisible, onClose, song }) => {
  const { colors } = useTheme();
  // Callers unmount this drawer from onClose, so options close it here and let it slide away.
  const [open, setOpen] = useState(isVisible);
  useEffect(() => setOpen(isVisible), [isVisible]);
  const close = () => setOpen(false);
  const [playlistModal, setPlaylistModal] = useState(false);
  const { addToQueue, removeFromQueue } = usePlayerControls();
  const { currentSong } = usePlaybackState();
  const { playlist } = usePlaylistState();
  const currentGroup = useGroupSessionStore((s) => s.currentGroup);
  const { addToQueue: addToGroupQueue, playNext: playNextInGroup } = useGroupMusic();
  const { mutate: dislike } = useDislikeSong();

  const artistName = song.artist_map?.artists || [{ name: 'Unknown Artist', id: null }];
  const albumArt = song.image?.[2]?.link || song.image?.[1]?.link;

  const handlePress = (id: string, path: string) => {
    close();
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
    close();
  };

  return (
    <>
      <SwipeableModal isVisible={open} onClose={onClose} dragAnywhere>
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.albumArtContainer}>
              <Image
                source={{ uri: albumArt }}
                style={styles.albumArt}
                resizeMode='cover'
                fadeDuration={0}
              />
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
              <OptionRow
                icon={<MaterialIcons name='queue-music' size={22} color={colors.foreground} />}
                label={isSongInQueue ? 'Remove from Queue' : 'Add to Queue'}
                color={colors.foreground}
                onPress={handleAddToQueue}
              />
            )}

            {currentGroup && (
              <>
                <OptionRow
                  icon={<Ionicons name='people-outline' size={22} color={colors.foreground} />}
                  label='Add to Group Queue'
                  color={colors.foreground}
                  emphasized
                  onPress={() => {
                    addToGroupQueue(song);
                    toast('Added to Group Queue', { type: 'success' });
                    close();
                  }}
                />
                <OptionRow
                  icon={
                    <Ionicons name='play-forward-outline' size={22} color={colors.foreground} />
                  }
                  label='Play Next in Group'
                  color={colors.foreground}
                  emphasized
                  onPress={() => {
                    playNextInGroup(song);
                    toast('Playing next in group', { type: 'success' });
                    close();
                  }}
                />
              </>
            )}

            <OptionRow
              icon={<MaterialIcons name='playlist-add' size={22} color={colors.foreground} />}
              label='Add to Playlist'
              color={colors.foreground}
              onPress={() => setPlaylistModal(true)}
            />

            {artistName?.[0].id && (
              <OptionRow
                icon={<Ionicons name='person-outline' size={20} color={colors.foreground} />}
                label='View Artist'
                color={colors.foreground}
                onPress={() => handlePress(artistName?.[0].id, paths.artist)}
              />
            )}

            {song?.album_id && (
              <OptionRow
                icon={<Ionicons name='disc-outline' size={20} color={colors.foreground} />}
                label='View Album'
                color={colors.foreground}
                onPress={() => handlePress(song.album_id, paths.albums)}
              />
            )}

            <OptionRow
              icon={<Feather name='thumbs-down' size={20} color={colors.foreground} />}
              label="Don't Recommend"
              color={colors.foreground}
              onPress={() => {
                dislike(song);
                close();
              }}
            />
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
  optionTextEmphasized: {
    fontWeight: '600',
  },
});

export default NewPlayerDrawer;
