import { CachedImage } from '@/components/ui/CachedImage';
import { useTheme } from '@/context/ThemeContext';
import { blurredArt } from '@/lib/artwork';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

const HEIGHT = 420;
/** One cover dissolving into the next when the song changes: slow, so it reads as light shifting. */
const DISSOLVE = { duration: 900, effect: 'cross-dissolve' } as const;
const APPEAR = FadeIn.duration(600).reduceMotion(ReduceMotion.System);

type Images = { link?: string }[] | undefined;
const smallCover = (image: unknown) => {
  const link = (image as Images)?.[1]?.link || (image as Images)?.[0]?.link;
  return link ? convertToHttps(link) : undefined;
};

/** The cover of what you're hearing: the room's song in a room, otherwise your own. */
const useHeardCover = () => {
  const inRoom = useGroupSessionStore((s) => Boolean(s.currentGroup));
  const room = useGroupPlaybackStore((s) => smallCover(s.currentSong?.image));
  const own = usePlayerStore((s) => smallCover(s.currentSong?.image));
  return inRoom ? room : own;
};

/**
 * The song playing, blurred and washed into the page, behind the top of a tab. Mono has no colour
 * of its own: this is where album art lends it some. Fades back as the page scrolls. Nothing when
 * nothing has played. Place it first in the tab's root view.
 */
export const Aura = memo(function Aura({ scrollY }: { scrollY?: SharedValue<number> }) {
  const { colors, theme } = useTheme();
  const cover = useHeardCover();
  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY?.get() ?? 0, [0, 260], [1, 0.3], 'clamp'),
  }));
  if (!cover) return null;

  const bg = colors.background;
  // Secondary text sits over the top of this: the wash keeps it readable on any cover.
  const wash = theme === 'dark' ? ['80', 'C4'] : ['8C', 'CC'];
  return (
    <Animated.View
      entering={APPEAR}
      pointerEvents='none'
      style={[styles.aura, fade]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <CachedImage {...blurredArt(cover, 60)} transition={DISSOLVE} style={styles.art} />
      <LinearGradient
        colors={[`${bg}${wash[0]}`, `${bg}${wash[1]}`, bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  aura: { position: 'absolute', top: 0, left: 0, right: 0, height: HEIGHT },
  // Wider than the screen, so the blur's soft edge falls outside it.
  art: { position: 'absolute', top: -40, left: -40, right: -40, bottom: 0, opacity: 0.9 },
});
