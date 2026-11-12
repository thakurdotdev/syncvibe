import { SongCard } from '@/components/music/MusicCards';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { ROW_PRESS_SCALE, SPRING_PRESS } from '@/lib/motion';
import { EDGE_GUARD, SWIPE_ACTIVATE } from '@/lib/swipe';
import { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { Feather, Ionicons } from '@expo/vector-icons';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const ACTION_WIDTH = 88;
/** Drag this share of the width to ask about removing, or flick: this far and this fast. */
const ASK_DISTANCE = 0.3;
const ASK_FLICK_DISTANCE = 0.15;
const ASK_FLICK_VELOCITY = 900;
/** Moving back this fast at release means you changed your mind. */
const REVERSE_VELOCITY = 300;

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
  const { width } = useWindowDimensions();
  const offsetX = useSharedValue(0);

  // The same rules as the queue: a row only moves after a clearly sideways, leftward drag, and
  // any vertical movement first hands the touch to the list, so scrolling never catches a row.
  const swipe = useMemo(() => {
    const close = () => {
      'worklet';
      offsetX.set(withSpring(0, SPRING_PRESS));
    };
    const ask = () => onRemove(song, () => offsetX.set(withSpring(0, SPRING_PRESS)));
    return Gesture.Pan()
      .hitSlop({ left: -EDGE_GUARD, right: -EDGE_GUARD })
      .activeOffsetX(-SWIPE_ACTIVATE)
      .failOffsetX(12)
      .failOffsetY([-14, 14])
      .onUpdate((e) => {
        offsetX.set(Math.max(-width, Math.min(0, e.translationX)));
      })
      .onEnd((e, success) => {
        const distance = -e.translationX;
        const speed = -e.velocityX;
        const commit =
          success &&
          speed > -REVERSE_VELOCITY &&
          (distance >= width * ASK_DISTANCE ||
            (distance >= width * ASK_FLICK_DISTANCE && speed >= ASK_FLICK_VELOCITY));
        if (!commit) {
          close();
          return;
        }
        // Rests open on the red action while the page asks; "Keep it" slides it back.
        offsetX.set(withSpring(-ACTION_WIDTH, SPRING_PRESS));
        scheduleOnRN(ask);
      });
  }, [offsetX, onRemove, song, width]);

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offsetX.get() }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offsetX.get(), [-ACTION_WIDTH * 0.5, 0], [1, 0], 'clamp'),
  }));

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

  return (
    <View>
      <Animated.View style={[styles.actionWrap, actionStyle]} pointerEvents='box-none'>
        <PressableScale
          onPress={() => onRemove(song, () => offsetX.set(withSpring(0, SPRING_PRESS)))}
          accessibilityRole='button'
          accessibilityLabel={`Remove ${song.name} from this playlist`}
          style={[styles.action, { backgroundColor: colors.destructive }]}
        >
          <Feather name='trash-2' size={19} color={colors.destructiveForeground} />
          <Text style={[styles.actionText, { color: colors.destructiveForeground }]}>Remove</Text>
        </PressableScale>
      </Animated.View>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ backgroundColor: colors.background }, rowStyle]}>
          <SongCard song={song} onRemoveFromPlaylist={() => onRemove(song)} />
        </Animated.View>
      </GestureDetector>
    </View>
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
  actionWrap: { position: 'absolute', top: 0, bottom: 0, right: 0, width: ACTION_WIDTH },
  action: {
    flex: 1,
    marginVertical: 2,
    marginLeft: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
});
