import PressableScale from '@/components/ui/PressableScale';
import {
  HistoryPanel,
  PeoplePanel,
  PlaylistsPanel,
  SongsPanel,
} from '@/components/search/SearchPanels';
import { HeaderIconButton } from '@/components/ui/AppHeader';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { useTheme } from '@/context/ThemeContext';
import { SPRING } from '@/lib/motion';
import { EDGE_GUARD, isSkipSwipe, SWIPE_ACTIVATE } from '@/lib/swipe';
import { Feather } from '@expo/vector-icons';
import { useIsFetching } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

type SearchTab = 'songs' | 'history' | 'playlists' | 'people';

const DEBOUNCE_MS = 350;
/** Resistance when dragging past the first or last tab. */
const RUBBER_BAND = 0.2;

const TABS: SegmentOption<SearchTab>[] = [
  { value: 'songs', label: 'Songs' },
  { value: 'history', label: 'History' },
  { value: 'playlists', label: 'Playlists' },
  { value: 'people', label: 'People' },
];

const PLACEHOLDERS: Record<SearchTab, string> = {
  songs: 'Songs, artists, albums',
  history: "Songs you've played",
  playlists: 'Your playlists and public ones',
  people: 'Search people by name',
};

type Search = { text: string; query: string };

/**
 * One tab's page on the strip. A page out of view keeps the search it last showed, so typing
 * only ever fetches for the tab you're on (or are swiping to).
 */
function TabPage({
  live,
  width,
  search,
  children,
}: {
  live: boolean;
  width: number;
  search: Search;
  children: (search: Search) => ReactNode;
}) {
  const shown = useRef(search);
  if (live) shown.current = search;
  return (
    <View
      style={{ width }}
      accessibilityElementsHidden={!live}
      importantForAccessibility={live ? 'auto' : 'no-hide-descendants'}
    >
      {children(shown.current)}
    </View>
  );
}

const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/home'));

/**
 * One search field over four places to look: tap a tab or swipe between them. The words you
 * typed carry across tabs, and a tab only fetches once you go to it.
 */
export default function SearchScreen() {
  const { colors, theme } = useTheme();
  const [tab, setTab] = useState<SearchTab>('songs');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  const searching = useIsFetching({ queryKey: ['search'] }) > 0;
  const { width } = useWindowDimensions();

  // The neighbour a swipe is revealing, and every tab reached so far (the rest aren't mounted).
  const [peek, setPeek] = useState<SearchTab | null>(null);
  const [reached, setReached] = useState<Partial<Record<SearchTab, boolean>>>({ songs: true });
  const page = useSharedValue(0);
  const startPage = useSharedValue(0);

  const reach = useCallback((next: SearchTab) => {
    setReached((seen) => (seen[next] ? seen : { ...seen, [next]: true }));
  }, []);

  const selectTab = useCallback(
    (next: SearchTab) => {
      reach(next);
      setTab(next);
      page.set(
        withSpring(
          TABS.findIndex((t) => t.value === next),
          SPRING
        )
      );
    },
    [page, reach]
  );

  const beginPeek = useCallback(
    (index: number) => {
      const next = TABS[index].value;
      reach(next);
      setPeek(next);
    },
    [reach]
  );

  const endSwipe = useCallback((index: number) => {
    setTab(TABS[index].value);
    setPeek(null);
  }, []);

  const lastPage = TABS.length - 1;
  const swipe = Gesture.Pan()
    .hitSlop({ left: -EDGE_GUARD, right: -EDGE_GUARD })
    .activeOffsetX([-SWIPE_ACTIVATE, SWIPE_ACTIVATE])
    .failOffsetY([-14, 14])
    .onStart((e) => {
      const from = Math.round(page.get());
      startPage.set(from);
      // Translation is still 0 here on Android; velocity already says which way it's going.
      const neighbour = from + (e.velocityX < 0 ? 1 : -1);
      if (neighbour >= 0 && neighbour <= lastPage) scheduleOnRN(beginPeek, neighbour);
    })
    .onUpdate((e) => {
      const target = startPage.get() - e.translationX / width;
      page.set(
        target < 0 || target > lastPage
          ? startPage.get() - (e.translationX / width) * RUBBER_BAND
          : target
      );
    })
    .onEnd((e, success) => {
      const from = startPage.get();
      const neighbour = from + (e.translationX < 0 ? 1 : -1);
      const commit =
        success &&
        neighbour >= 0 &&
        neighbour <= lastPage &&
        isSkipSwipe(e.translationX, e.velocityX, width);
      const landed = commit ? neighbour : from;
      page.set(withSpring(landed, { ...SPRING, velocity: success ? -e.velocityX / width : 0 }));
      scheduleOnRN(endSwipe, landed);
    });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -page.get() * width }],
  }));

  useEffect(() => {
    const next = text.trim();
    if (!next) {
      setQuery('');
      return;
    }
    const timer = setTimeout(() => setQuery(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const pickQuery = useCallback((picked: string) => {
    setText(picked);
    setQuery(picked);
    inputRef.current?.blur();
  }, []);

  const clear = useCallback(() => {
    setText('');
    setQuery('');
    inputRef.current?.focus();
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor='transparent'
        translucent
      />

      <View style={styles.top}>
        <HeaderIconButton icon='chevron-back' label='Go back' onPress={goBack} />
        <View style={[styles.field, { backgroundColor: colors.raised }]}>
          <Feather name='search' size={19} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.foreground }]}
            placeholder={PLACEHOLDERS[tab]}
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            returnKeyType='search'
            autoCapitalize='none'
            autoCorrect={false}
            autoFocus
            accessibilityLabel='Search'
          />
          {text && searching ? <ActivityIndicator size='small' color={colors.primary} /> : null}
          {text && !searching ? (
            <PressableScale
              onPress={clear}
              hitSlop={10}
              accessibilityRole='button'
              accessibilityLabel='Clear search'
            >
              <Feather name='x' size={18} color={colors.mutedForeground} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      <View style={styles.tabs}>
        <Segmented
          options={TABS}
          value={tab}
          onChange={selectTab}
          accessibilityLabel='What to search'
        />
      </View>

      <GestureDetector gesture={swipe}>
        <View style={styles.pager}>
          <Animated.View style={[styles.strip, { width: width * TABS.length }, stripStyle]}>
            {TABS.map(({ value }) => (
              <TabPage
                key={value}
                live={tab === value || peek === value}
                width={width}
                search={{ text, query }}
              >
                {(shown) =>
                  !reached[value] ? null : value === 'songs' ? (
                    <SongsPanel text={shown.text} query={shown.query} onPickQuery={pickQuery} />
                  ) : value === 'history' ? (
                    <HistoryPanel query={shown.query} />
                  ) : value === 'playlists' ? (
                    <PlaylistsPanel query={shown.query} />
                  ) : (
                    <PeoplePanel query={shown.query} />
                  )
                }
              </TabPage>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1, overflow: 'hidden' },
  strip: { flex: 1, flexDirection: 'row' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 0 },
  tabs: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});
