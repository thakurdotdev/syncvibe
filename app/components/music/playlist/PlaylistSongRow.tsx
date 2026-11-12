import { SongCard } from '@/components/music/MusicCards';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { ROW_PRESS_SCALE } from '@/lib/motion';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

const ACTION_WIDTH = 88;

interface PlaylistSongRowProps {
  song: Song;
  selecting: boolean;
  selected: boolean;
  onToggle: (songId: string) => void;
  /** Asks before removing; `cancel` closes the row again if the answer is no. */
  onRemove: (song: Song, cancel?: () => void) => void;
}

/**
 * A song on your own playlist. Swipe left to remove it (the page asks first), long-press for
 * its options, or, while selecting, tap to pick it.
 */
export const PlaylistSongRow = memo(function PlaylistSongRow({
  song,
  selecting,
  selected,
  onToggle,
  onRemove,
}: PlaylistSongRowProps) {
  const { colors } = useTheme();
  const swipeable = useRef<SwipeableMethods>(null);

  if (selecting) {
    const cover = song.image?.[1]?.link || song.image?.[0]?.link;
    return (
      <PressableScale
        onPress={() => onToggle(song.id)}
        scaleTo={ROW_PRESS_SCALE}
        accessibilityRole='checkbox'
        accessibilityState={{ checked: selected }}
        accessibilityLabel={song.name}
        style={[styles.selectRow, selected && { backgroundColor: `${colors.primary}14` }]}
      >
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? colors.primary : colors.mutedForeground}
        />
        <Image
          source={{ uri: cover ? convertToHttps(cover) : undefined }}
          style={[styles.cover, { backgroundColor: colors.muted }]}
          fadeDuration={0}
        />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {song.name}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {song.subtitle || song.artist_map?.artists?.[0]?.name}
          </Text>
        </View>
      </PressableScale>
    );
  }

  const askToRemove = () => onRemove(song, () => swipeable.current?.close());

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      overshootRight={false}
      onSwipeableOpen={askToRemove}
      renderRightActions={() => (
        <PressableScale
          onPress={askToRemove}
          accessibilityRole='button'
          accessibilityLabel={`Remove ${song.name} from this playlist`}
          style={[styles.action, { backgroundColor: colors.destructive }]}
        >
          <Feather name='trash-2' size={19} color={colors.destructiveForeground} />
          <Text style={[styles.actionText, { color: colors.destructiveForeground }]}>Remove</Text>
        </PressableScale>
      )}
    >
      <View style={{ backgroundColor: colors.background }}>
        <SongCard song={song} onRemoveFromPlaylist={() => onRemove(song)} />
      </View>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginVertical: 2,
    borderRadius: 12,
  },
  cover: { width: 46, height: 46, borderRadius: 8 },
  text: { flex: 1 },
  title: { fontWeight: '600', fontSize: 14.5, letterSpacing: -0.2 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  action: {
    width: ACTION_WIDTH,
    marginVertical: 2,
    marginLeft: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
});
