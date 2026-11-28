import { CachedImage } from '@/components/ui/CachedImage';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { songArtists, songCoverOf } from '@/lib/chatSongs';
import { BUTTON_PRESS_SCALE, ROW_PRESS_SCALE } from '@/lib/motion';
import { usePlayerControls, useSongPlaybackState } from '@/stores/playerStore';
import type { ChatMessage } from '@/stores/chatStore';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

const LONG_PRESS_MS = 300;
const SONG_CARD_WIDTH = 248;

interface SongCardProps {
  message: ChatMessage;
  isOwn: boolean;
  /** The bubble's corners, so the card lines up with the run of messages it is in. */
  corners: ViewStyle;
  onLongPress: (message: ChatMessage) => void;
}

/** A song someone shared: tap it, or its button, to play it in your own player. */
const SongCard: React.FC<SongCardProps> = ({ message, isOwn, corners, onLongPress }) => {
  const { colors } = useTheme();
  const song = message.song!;
  const { playSong, handlePlayPause } = usePlayerControls();
  const { isCurrentSong, isPlaying } = useSongPlaybackState(String(song.id));

  const play = () => {
    if (isCurrentSong) handlePlayPause();
    else playSong(song);
  };

  const fg = isOwn ? colors.primaryForeground : colors.foreground;
  const artists = songArtists(song);

  return (
    <PressableScale
      onPress={play}
      onLongPress={() => onLongPress(message)}
      delayLongPress={LONG_PRESS_MS}
      scaleTo={ROW_PRESS_SCALE}
      accessibilityRole='button'
      accessibilityLabel={`${song.name}${artists ? ` by ${artists}` : ''}. ${
        isPlaying ? 'Playing. Tap to pause' : 'Tap to play'
      }, hold for options`}
      style={[styles.card, corners, { backgroundColor: isOwn ? colors.primary : colors.raised }]}
    >
      <View style={[styles.cover, { backgroundColor: colors.border }]}>
        <CachedImage source={{ uri: songCoverOf(song) }} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: fg }]} numberOfLines={1}>
          {song.name}
        </Text>
        {artists ? (
          <Text style={[styles.artists, { color: fg }]} numberOfLines={1}>
            {artists}
          </Text>
        ) : null}
      </View>
      <PressableScale
        onPress={play}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={8}
        accessibilityRole='button'
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        style={[styles.play, { backgroundColor: fg }]}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={isOwn ? colors.primary : colors.raised}
          style={isPlaying ? null : styles.playIcon}
        />
      </PressableScale>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  card: {
    width: SONG_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 18,
  },
  cover: { width: 52, height: 52, borderRadius: 10, overflow: 'hidden' },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  artists: { fontSize: 13, marginTop: 2, opacity: 0.75 },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  playIcon: { marginLeft: 2 },
});

export default React.memo(SongCard);
