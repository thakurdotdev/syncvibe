import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { useIsLiked, useToggleLike } from '@/queries/usePersonal';
import type { Song } from '@/types/song';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet } from 'react-native';

/** A heart that likes the song: it lands in Liked songs and shapes what's recommended. */
export const LikeButton = memo(function LikeButton({
  song,
  size = 24,
}: {
  song: Song | null | undefined;
  size?: number;
}) {
  const { colors } = useTheme();
  const liked = useIsLiked(song?.id);
  const toggle = useToggleLike();
  if (!song?.id) return null;

  return (
    <PressableScale
      onPress={() => toggle(song, !liked)}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={8}
      accessibilityRole='button'
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? `Remove ${song.name} from Liked songs` : `Like ${song.name}`}
      style={styles.button}
    >
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={size}
        color={liked ? colors.foreground : colors.mutedForeground}
      />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
