import { DECK_CLEARANCE } from '@/components/music/UnifiedBottomDeck';
import { HEADER_HEIGHT, HeaderOrb, StackHeader } from '@/components/ui/AppHeader';
import Button from '@/components/ui/button';
import { CachedImage } from '@/components/ui/CachedImage';
import { useTheme } from '@/context/ThemeContext';
import { blurredArt } from '@/lib/artwork';
import { alpha } from '@/lib/color';
import { SONG_LIST_WINDOW } from '@/lib/lists';
import { EASE_OUT, STATE } from '@/lib/motion';
import { fonts } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
  type RefreshControlProps,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { DetailContext, type DetailContextValue } from './context';
import { ROWS_AFTER, STAGGERED_ROWS } from './motion';
import type { Collection } from './useCollection';

/** StackHeader's height under the status bar. */
const BAR_HEIGHT = HEADER_HEIGHT;
/** The wash under the header reaches a little past it, so content fades out rather than cuts. */
const WASH_EXTRA = 28;
const BACKDROP_HEIGHT = 560;
const ROW_STEP = 35;
/** How long after the page opens (or a list grows) new rows still animate in. */
const ENTRANCE_WINDOW = 900;
const REVEAL_WINDOW = 700;
const BACKDROP_IN = { duration: 600, easing: EASE_OUT, reduceMotion: ReduceMotion.System } as const;

export const useHeaderHeight = () => Math.max(useSafeAreaInsets().top, 10) + BAR_HEIGHT;

/** The artwork, blurred and washed into the page, drifting up slower than the page scrolls. */
function Backdrop({ uri, scrollY }: { uri?: string; scrollY: DetailContextValue['scrollY'] }) {
  const { colors } = useTheme();
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(withTiming(1, BACKDROP_IN));
  }, [shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: -Math.max(0, scrollY.get()) * 0.4 }],
  }));
  const bg = colors.background;
  return (
    <Animated.View pointerEvents='none' style={[styles.backdrop, style]}>
      {uri ? (
        <CachedImage {...blurredArt(uri, 60)} style={[StyleSheet.absoluteFill, styles.art]} />
      ) : (
        <LinearGradient
          colors={colors.gradients.header as [string, string, ...string[]]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={[alpha(bg, 0.1), alpha(bg, 0.85), alpha(bg, 1)]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** A small heading over a list of songs. */
export function ListHeading({ children, trailing }: { children: string; trailing?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingText, { color: colors.foreground }]} accessibilityRole='header'>
        {children}
      </Text>
      {trailing}
    </View>
  );
}

interface DetailScreenProps<T> {
  /** `sleeve`: the header sits over a backdrop. `portrait`: a photo runs under the header. */
  variant: 'sleeve' | 'portrait';
  /** Shown in the header once the top of the page has scrolled away. */
  title: string;
  /** Selecting songs and the like: shown in the header at once. */
  headerTitle?: string;
  backdrop?: string;
  /** Lets the header take over the play button once the page's own scrolls away. */
  collection?: Collection;
  headerRight?: ReactNode;
  /** Everything above the songs. */
  header: ReactNode;
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  extraData?: unknown;
  ListFooterComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Over the page: selection bars, sheets. */
  children?: ReactNode;
}

/**
 * The page under an album, playlist, artist or your own lists. It owns the scroll, the backdrop
 * and the header, which condenses as you scroll: a surface fades in under it, the title rises
 * into it and the play button moves up into its corner once the page's own has gone.
 */
export function DetailScreen<T>({
  variant,
  title,
  headerTitle,
  backdrop,
  collection,
  headerRight,
  header,
  data,
  renderItem,
  keyExtractor,
  extraData,
  ListFooterComponent,
  ListEmptyComponent,
  refreshControl,
  children,
}: DetailScreenProps<T>) {
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const scrollY = useSharedValue(0);
  const actionsBottom = useSharedValue(variant === 'portrait' ? screenHeight * 0.6 : 420);
  const contentRef = useRef<View>(null);

  // Rows that mount while the page is arriving, or just after a list grows, animate in.
  const [openedAt] = useState(() => Date.now());
  const reveal = useRef({ from: Infinity, until: 0 });
  const rowDelay = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now - openedAt < ENTRANCE_WINDOW && index < STAGGERED_ROWS) {
        return ROWS_AFTER + index * ROW_STEP;
      }
      const { from, until } = reveal.current;
      if (now < until && index >= from && index < from + 12) return (index - from) * ROW_STEP;
      return null;
    },
    [openedAt]
  );
  const revealFrom = useCallback((index: number) => {
    reveal.current = { from: index, until: Date.now() + REVEAL_WINDOW };
  }, []);

  const context = useMemo<DetailContextValue>(
    () => ({ scrollY, actionsBottom, contentRef, rowDelay, revealFrom }),
    [scrollY, actionsBottom, rowDelay, revealFrom]
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });

  // Flips once as the play buttons pass under the header, then animates on its own clock.
  const condensed = useSharedValue(0);
  const [isCondensed, setCondensed] = useState(false);
  useAnimatedReaction(
    () => scrollY.get() > actionsBottom.get() - headerHeight,
    (now, before) => {
      if (now === before) return;
      condensed.set(withTiming(now ? 1 : 0, STATE));
      scheduleOnRN(setCondensed, now);
    }
  );

  const surfaceStyle = useAnimatedStyle(() => ({ opacity: condensed.get() }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: condensed.get(),
    transform: [{ translateY: (1 - condensed.get()) * 8 }],
  }));
  const miniPlayStyle = useAnimatedStyle(() => ({
    opacity: condensed.get(),
    transform: [{ scale: 0.6 + 0.4 * condensed.get() }],
  }));

  const miniPlay = collection ? (
    <Animated.View
      style={miniPlayStyle}
      pointerEvents={isCondensed ? 'auto' : 'none'}
      accessibilityElementsHidden={!isCondensed}
      importantForAccessibility={isCondensed ? 'auto' : 'no-hide-descendants'}
    >
      <HeaderOrb
        icon={collection.playing ? 'pause' : 'play'}
        tone='primary'
        label={collection.playing ? 'Pause' : 'Play'}
        onPress={collection.toggle}
      />
    </Animated.View>
  ) : null;

  const right =
    headerRight || miniPlay ? (
      <View style={styles.headerRight}>
        {headerRight}
        {miniPlay}
      </View>
    ) : undefined;

  return (
    <DetailContext.Provider value={context}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {variant === 'sleeve' && <Backdrop uri={backdrop} scrollY={scrollY} />}

        <Animated.FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          extraData={extraData}
          {...SONG_LIST_WINDOW}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: DECK_CLEARANCE }}
          refreshControl={refreshControl}
          ListHeaderComponent={
            <View
              ref={contentRef}
              collapsable={false}
              style={{ paddingTop: variant === 'sleeve' ? headerHeight + 4 : 0 }}
            >
              {header}
            </View>
          }
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
        />

        <View style={styles.header} pointerEvents='box-none'>
          {/* Once the art has gone, the page washes out under the orbs instead of showing through. */}
          <Animated.View
            pointerEvents='none'
            style={[styles.headerWash, { height: headerHeight + WASH_EXTRA }, surfaceStyle]}
          >
            <LinearGradient
              colors={[
                alpha(colors.background, 1),
                alpha(colors.background, 1),
                alpha(colors.background, 0),
              ]}
              locations={[0, 0.62, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <StackHeader
            overlay
            title={headerTitle ?? title}
            titleStyle={headerTitle ? undefined : titleStyle}
            right={right}
          />
        </View>

        {children}
      </View>
    </DetailContext.Provider>
  );
}

// ─── Loading and failure ────────────────────────────────────────────────────────────────────────

const PULSE = {
  animationName: { from: { opacity: 1 }, to: { opacity: 0.5 } },
  animationDuration: '900ms',
  animationDirection: 'alternate',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
} as const;

/** The page's shape, breathing, while it loads for the first time. */
export function DetailSkeleton({ variant }: { variant: 'sleeve' | 'portrait' }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const fill = { backgroundColor: colors.raised };
  const sleeve = Math.round(Math.min((width - 40) / 1.42, 280));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[PULSE, { paddingTop: variant === 'sleeve' ? headerHeight + 12 : 0 }]}
        accessibilityLabel='Loading'
        accessible
      >
        {variant === 'sleeve' ? (
          <View style={[styles.skelSleeve, fill, { width: sleeve, height: sleeve }]} />
        ) : (
          <View style={[fill, { height: Math.min(width * 1.08, 500) * 0.82 }]} />
        )}
        <View style={styles.skelText}>
          <View style={[styles.skelBar, fill, { width: 70, height: 10 }]} />
          <View style={[styles.skelBar, fill, { width: '72%', height: 28 }]} />
          <View style={[styles.skelBar, fill, { width: '46%', height: 12 }]} />
        </View>
        <View style={styles.skelActions}>
          <View style={[styles.skelPill, fill, { flex: 1 }]} />
          <View style={[styles.skelPill, fill, { width: 52 }]} />
        </View>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.skelRow}>
            <View style={[styles.skelCover, fill]} />
            <View style={styles.skelRowText}>
              <View style={[styles.skelBar, fill, { width: `${70 - i * 6}%`, height: 12 }]} />
              <View style={[styles.skelBar, fill, { width: `${40 - i * 3}%`, height: 10 }]} />
            </View>
          </View>
        ))}
      </Animated.View>
      <View style={styles.header} pointerEvents='box-none'>
        <StackHeader overlay />
      </View>
    </View>
  );
}

/** Nothing came back: say so plainly and offer to try again. */
export function DetailError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StackHeader />
      <View style={styles.error}>
        <View style={[styles.errorIcon, { backgroundColor: colors.raised }]}>
          <Ionicons name='cloud-offline-outline' size={26} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.errorText, { color: colors.foreground }]}>{message}</Text>
        {onRetry && <Button variant='outline' size='sm' title='Try again' onPress={onRetry} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: BACKDROP_HEIGHT },
  art: { opacity: 0.6 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerWash: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
  },
  headingText: { fontFamily: fonts.displaySemibold, fontSize: 18, letterSpacing: -0.3 },

  skelSleeve: { marginLeft: 20, borderRadius: 6 },
  skelText: { paddingHorizontal: 20, marginTop: 24, gap: 10 },
  skelBar: { borderRadius: 6 },
  skelActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 18,
  },
  skelPill: { height: 52, borderRadius: 26 },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    height: 60,
  },
  skelCover: { width: 44, height: 44, borderRadius: 7 },
  skelRowText: { flex: 1, gap: 7 },

  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
