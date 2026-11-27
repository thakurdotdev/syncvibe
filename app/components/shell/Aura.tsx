import { HEADER_HEIGHT } from '@/components/ui/AppHeader';
import { CachedImage } from '@/components/ui/CachedImage';
import { useTheme } from '@/context/ThemeContext';
import { blurredArt } from '@/lib/artwork';
import { alpha } from '@/lib/color';
import { useGroupPlaybackStore } from '@/stores/groupMusic/groupPlaybackStore';
import { useGroupSessionStore } from '@/stores/groupMusic/groupSessionStore';
import { usePlayerStore } from '@/stores/playerStore';
import { convertToHttps } from '@/utils/getHttpsUrls';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** How far it reaches below the header, fading into the page as it goes. */
const BELOW_HEADER = 72;
/** One cover dissolving into the next when the song changes: slow, so it reads as light shifting. */
const DISSOLVE = { duration: 900, effect: 'cross-dissolve' } as const;
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
 * The song playing, blurred and washed into the page, behind the header of a tab.
 * Mono has no colour of its own: this is where album art lends it some. It stays put behind the
 * header while the page scrolls, and nothing about it animates but the cover dissolving into the
 * next: Android drops a gradient over the cover while its opacity animates, which showed as a box
 * with a hard edge. Nothing when nothing has played. Place it first in the tab's root view.
 */
export const Aura = memo(function Aura() {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const cover = useHeardCover();
  const height = insets.top + HEADER_HEIGHT + BELOW_HEADER;

  const bg = colors.background;
  // The wash keeps text over it readable on any cover, then fades all the way into the page.
  const wash = theme === 'dark' ? 0.5 : 0.56;

  if (!cover) return null;
  return (
    <View
      pointerEvents='none'
      style={[styles.aura, { height }]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <CachedImage {...blurredArt(cover, 60)} transition={DISSOLVE} style={styles.art} />
      {/* One smooth gradient. It draws reliably as long as nothing animates the aura's opacity. */}
      <LinearGradient
        colors={[alpha(bg, wash), alpha(bg, wash + 0.1), alpha(bg, 1)]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  aura: { position: 'absolute', top: 0, left: 0, right: 0 },
  // Wider than the screen, so the blur's soft side edges fall outside it.
  art: { position: 'absolute', top: 0, left: -40, right: -40, bottom: 0 },
});
