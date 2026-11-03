import { UnifiedBottomDeck } from '@/components/music/UnifiedBottomDeck';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useSegments } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Pushed music pages that keep the bottom deck (mini player + tabs), so moving from a tab
 * into an album, artist or playlist never loses playback controls or navigation.
 * Pages with their own keyboard or full-screen UI (search, chat thread, login, scanner,
 * settings forms) stay deck-free.
 */
const DECK_PAGES = new Set(['albums', 'artist', 'playlists', 'user-playlist', 'song-history']);

/**
 * App-wide host for the bottom deck. It shows on every tab root and on music detail pages;
 * on a detail page it keeps highlighting the tab you came from.
 */
function GlobalBottomDeck() {
  const segments = useSegments() as string[];
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [lastTab, setLastTab] = useState('home');

  const inTabs = segments[0] === '(tabs)';
  const activeTab = inTabs ? (segments[1] ?? 'home') : lastTab;

  useEffect(() => {
    if (inTabs) setLastTab(activeTab);
  }, [inTabs, activeTab]);
  const keyboardVisible = useKeyboardVisible();
  // Step aside while typing so the deck never sits on top of a composer or search field.
  const visible = !keyboardVisible && (inTabs || DECK_PAGES.has(segments[0] ?? ''));

  if (!visible) return null;

  return (
    <View pointerEvents='box-none' style={styles.host}>
      <UnifiedBottomDeck colors={colors} theme={theme} insets={insets} activeSegment={activeTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Below the full-screen player (zIndex 999) so it always covers the deck.
  host: { ...StyleSheet.absoluteFill, zIndex: 50 },
});

export default memo(GlobalBottomDeck);
