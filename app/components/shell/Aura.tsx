import { HEADER_HEIGHT } from '@/components/ui/AppHeader';
import { CachedImage } from '@/components/ui/CachedImage';
import { useTheme } from '@/context/ThemeContext';
import { blurredArt } from '@/lib/artwork';
import { alpha } from '@/lib/color';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Below the header: about the big title and the line under it. */
const BELOW_HEADER = 120;
/** One cover dissolving into the next when the song changes: slow, so it reads as light shifting. */
const DISSOLVE = { duration: 900, effect: 'cross-dissolve' } as const;
/**
 * The fade into the page is plain stacked layers, not a gradient view: Android dropped the
 * gradient over the cover and left a hard edge. This many steps over the lower part of the aura,
 * eased, read as one smooth fade on a blurred picture.
 */
const STEPS = 24;
const FADE_SHARE = 0.7;
/** Where the page is all page colour, from this far down the fade. */
const STEP_ALPHAS = Array.from({ length: STEPS }, (_, i) => {
  const t = (i + 1) / STEPS;
  return t * t * (3 - 2 * t);
});

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
 * The song playing, blurred and washed into the page, behind the header and big title of a tab.
 * Mono has no colour of its own: this is where album art lends it some. It belongs to the top of
 * the page and scrolls away with it, so a short scroll looks like the page moving, not a panel
 * fading. Nothing when nothing has played. Place it first in the tab's root view.
 */
export const Aura = memo(function Aura({ scrollY }: { scrollY?: SharedValue<number> }) {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const cover = useHeardCover();
  const height = insets.top + HEADER_HEIGHT + BELOW_HEADER;

  // Only ever moved, never faded: Android draws a half-transparent view through an offscreen
  // layer, and the blurred cover and its fade came out of that as a box with a hard edge. The
  // cover's own image transition eases it in.
  const style = useAnimatedStyle(() => ({
    // Exactly with the page: never down past the top, never faster than the content.
    transform: [{ translateY: -Math.max(0, scrollY?.get() ?? 0) }],
  }));

  const bg = colors.background;
  // Secondary text sits over the top of this: the wash keeps it readable on any cover.
  const wash = alpha(bg, theme === 'dark' ? 0.5 : 0.56);
  const steps = useMemo(() => STEP_ALPHAS.map((a) => alpha(bg, a)), [bg]);

  if (!cover) return null;
  return (
    <Animated.View
      pointerEvents='none'
      style={[styles.aura, { height }, style]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <CachedImage {...blurredArt(cover, 60)} transition={DISSOLVE} style={styles.art} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: wash }]} />
      <View style={styles.fade}>
        {steps.map((color, i) => (
          <View key={i} style={[styles.step, { backgroundColor: color }]} />
        ))}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  aura: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Wider than the screen, so the blur's soft side edges fall outside it.
  art: { position: 'absolute', top: 0, left: -40, right: -40, bottom: 0 },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${FADE_SHARE * 100}%`,
  },
  step: { flex: 1 },
});
