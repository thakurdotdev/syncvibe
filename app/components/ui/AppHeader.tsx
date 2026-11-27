import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { BUTTON_PRESS_SCALE, EASE_OUT, PRESS_IN, rubberband, SPRING_SNAP } from '@/lib/motion';
import { alpha } from '@/lib/color';
import { useGroupInviteStore } from '@/stores/groupMusic/groupInviteStore';
import { fonts, typography } from '@/theme/typography';
import { getProfileCloudinaryUrl } from '@/utils/Cloudinary';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { CachedImage } from './CachedImage';
import PressableScale from './PressableScale';

/*
 * The top of every page, built from the same two shapes as the bottom bar: a round orb and a
 * glass pill. On a tab the orb is you (the way into Profile) and the pill is search, which turns
 * into the page's title once its big title has scrolled away. On a page you opened, the orb is
 * back and the pill holds the title.
 */

export const HEADER_HEIGHT = 56;
/** Orbs and the pill: one height, so every header lines up with every other. */
export const ORB = 44;
const GAP = 8;
const SIDE = 12;

type IconName = keyof typeof Ionicons.glyphMap;

const system = ReduceMotion.System;
/** Title and search hint trading places, once the big title has gone under the bar. */
const CONDENSE = { duration: 240, easing: EASE_OUT, reduceMotion: system } as const;
const REFLOW = LinearTransition.duration(260).reduceMotion(system);
const ORB_IN = FadeIn.duration(200).reduceMotion(system);
const ORB_OUT = FadeOut.duration(140).reduceMotion(system);
const ACTIVATE = [{ name: 'activate' as const }];
/** Pull the pill down this far and let go to search. */
const PULL_TO_SEARCH = 34;

/**
 * The header's surface: the raised fill chips and fields use, a little see-through so the aura
 * tints it. Flat, with no shadow: the header belongs to the page rather than floating over it.
 */
export function useGlass(): ViewStyle {
  const { colors } = useTheme();
  return useMemo(() => ({ backgroundColor: alpha(colors.raised, 0.88) }), [colors.raised]);
}

/** 38pt round icon button for screens' own toolbars (rooms, sign-in). Headers use HeaderOrb. */
export const HeaderIconButton = memo(function HeaderIconButton({
  icon,
  onPress,
  label,
  tone = 'default',
  children,
}: {
  icon?: IconName;
  onPress: () => void;
  label: string;
  tone?: 'default' | 'primary' | 'overlay' | 'plain';
  children?: ReactNode;
}) {
  const { colors, theme } = useTheme();
  const bg =
    tone === 'primary'
      ? colors.primary
      : tone === 'plain'
        ? 'transparent'
        : tone === 'overlay'
          ? theme === 'dark'
            ? 'rgba(0,0,0,0.35)'
            : 'rgba(255,255,255,0.7)'
          : colors.raised;
  const fg = tone === 'primary' ? colors.primaryForeground : colors.foreground;

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={8}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={[styles.iconButton, { backgroundColor: bg }]}
    >
      {children ?? (icon ? <Ionicons name={icon} size={19} color={fg} /> : null)}
    </PressableScale>
  );
});

/** A round header button: glass, or filled for the one main action. */
export const HeaderOrb = memo(function HeaderOrb({
  icon,
  label,
  onPress,
  tone = 'glass',
  children,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
  tone?: 'glass' | 'primary';
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  const primary = tone === 'primary';
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={6}
      accessibilityRole='button'
      accessibilityLabel={label}
      style={[styles.orb, primary ? { backgroundColor: colors.primary } : glass]}
    >
      {children ??
        (icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={primary ? colors.primaryForeground : colors.foreground}
          />
        ) : null)}
    </PressableScale>
  );
});

const openSearch = () => router.push('/search');
const openProfile = () => router.navigate('/(tabs)/profile');
const goBackOrHome = () => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/home'));

/** You: the way into Profile. A dot when a room invite is waiting for an answer. */
const AvatarOrb = memo(function AvatarOrb() {
  const { colors } = useTheme();
  const { user } = useUser();
  const glass = useGlass();
  const waiting = useGroupInviteStore((s) => Boolean(s.pendingInvite));
  return (
    <PressableScale
      onPress={openProfile}
      scaleTo={BUTTON_PRESS_SCALE}
      hitSlop={6}
      accessibilityRole='button'
      accessibilityLabel={waiting ? 'Your profile. A room invite is waiting' : 'Your profile'}
      style={[styles.orb, glass]}
    >
      {user?.profilepic ? (
        <CachedImage
          source={{ uri: getProfileCloudinaryUrl(user.profilepic) }}
          style={[styles.avatar, { backgroundColor: colors.raised }]}
        />
      ) : (
        <Ionicons name='person' size={18} color={colors.mutedForeground} />
      )}
      {waiting && (
        <Animated.View
          entering={ORB_IN}
          style={[styles.dot, { backgroundColor: colors.foreground, borderColor: colors.card }]}
        />
      )}
    </PressableScale>
  );
});

// ─── Scroll ─────────────────────────────────────────────────────────────────────────────────────

type Scrollable = {
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
  scrollTo?: (options: { y: number; animated?: boolean }) => void;
};

/**
 * What a tab's header follows: how far the page has scrolled, the handler for its list, and a
 * way back to the top (tapping the title once it's in the pill).
 */
export function useTopBarScroll<T extends object = Animated.ScrollView>() {
  const scrollY = useSharedValue(0);
  const listRef = useAnimatedRef<T>();
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
    },
  });
  const scrollToTop = useCallback(() => {
    const list = listRef.current as unknown as Scrollable | null;
    if (list?.scrollToOffset) list.scrollToOffset({ offset: 0, animated: true });
    else list?.scrollTo?.({ y: 0, animated: true });
  }, [listRef]);
  return { scrollY, onScroll, listRef, scrollToTop };
}

/** 0 while the big title shows, 1 once it has gone under the bar. Flips, then animates. */
function useCondensed(scrollY: SharedValue<number> | undefined, at: number) {
  const t = useSharedValue(scrollY ? 0 : 1);
  useAnimatedReaction(
    () => (scrollY ? scrollY.get() > at : true),
    (now, before) => {
      if (now === before) return;
      t.set(withTiming(now ? 1 : 0, CONDENSE));
    }
  );
  return t;
}

// ─── Tab header ─────────────────────────────────────────────────────────────────────────────────

type InlineSearch = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  inputRef?: RefObject<TextInput | null>;
};

/**
 * A tab's header: you, then the pill. The pill is search: tap it, or pull it down. Once the big
 * title (LargeTitle) has scrolled under it, the pill shows the title instead, and tapping it goes
 * back to the top. Applies no safe-area inset itself; place it under one.
 */
export const TabHeader = memo(function TabHeader({
  title,
  scrollY,
  collapseAt = 44,
  onTitlePress,
  action,
  search = 'link',
  searchPlaceholder = 'Search songs, artists, people',
  avatar = 'trailing',
}: {
  title?: string;
  /** The page's scroll. Without it the pill shows the title from the start. */
  scrollY?: SharedValue<number>;
  /** How far the page scrolls before the title moves into the pill. */
  collapseAt?: number;
  onTitlePress?: () => void;
  /** One page action, at the end of the pill. */
  action?: { icon: IconName; label: string; onPress: () => void };
  /** `link` opens Search; an object makes the pill a field for this page (Messages). */
  search?: 'link' | InlineSearch | false;
  searchPlaceholder?: string;
  /** `none` hides your avatar (kept for callers of the old header). */
  avatar?: 'trailing' | 'none';
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  const t = useCondensed(scrollY, collapseAt);
  const inline = typeof search === 'object' ? search : null;
  const inputRef = inline?.inputRef;
  const [focused, setFocused] = useState(false);
  const searching = Boolean(inline && (focused || inline.value));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: 1 - t.get(),
    transform: [{ translateY: -6 * t.get() }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: t.get(),
    transform: [{ translateY: 6 * (1 - t.get()) }],
  }));

  // Pulling the pill down stretches it a little and, past a point, says it will search.
  const pull = useSharedValue(0);
  const pressed = useSharedValue(0);
  const pillStyle = useAnimatedStyle(() => {
    const y = pull.get();
    return {
      transform: [
        { translateY: y },
        { scaleY: 1 + Math.min(y, 60) / 520 },
        { scale: 1 - pressed.get() * 0.03 },
      ],
    };
  });
  const pullHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.get(), [PULL_TO_SEARCH * 0.6, PULL_TO_SEARCH], [0, 1], 'clamp'),
  }));
  const restStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.get(), [0, PULL_TO_SEARCH * 0.6], [1, 0], 'clamp'),
  }));

  const pressPill = useCallback(
    (x: number) => {
      // Once the title is showing, the title takes you up and the magnifier still searches.
      if (onTitlePress && t.get() > 0.5 && x > 44) onTitlePress();
      else if (search !== false) openSearch();
    },
    [onTitlePress, search, t]
  );

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .onBegin(() => {
        pressed.set(withTiming(1, PRESS_IN));
      })
      .onFinalize(() => {
        pressed.set(withTiming(0, PRESS_IN));
      })
      .onEnd((e, success) => {
        if (success) scheduleOnRN(pressPill, e.x);
      });
    const drag = Gesture.Pan()
      .enabled(search === 'link')
      .activeOffsetY(8)
      .failOffsetY(-8)
      .failOffsetX([-16, 16])
      .onUpdate((e) => {
        pull.set(Math.max(0, rubberband(e.translationY, 160, 0.5)));
      })
      .onEnd(() => {
        if (pull.get() >= PULL_TO_SEARCH) scheduleOnRN(openSearch);
      })
      .onFinalize(() => {
        pull.set(withSpring(0, SPRING_SNAP));
      });
    return Gesture.Race(drag, tap);
  }, [pressPill, pressed, pull, search]);

  const clearInline = () => {
    inline?.onChangeText('');
    inputRef?.current?.blur();
    setFocused(false);
  };

  const edgeStyle = useAnimatedStyle(() => ({ opacity: t.get() }));

  return (
    <View style={styles.bar}>
      {/* Once the page has scrolled, it fades out under the bar instead of being cut off. */}
      {scrollY ? (
        <Animated.View pointerEvents='none' style={[styles.edge, edgeStyle]}>
          <LinearGradient
            colors={[alpha(colors.background, 1), alpha(colors.background, 0)]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      {avatar === 'trailing' && !searching && (
        <Animated.View entering={ORB_IN} exiting={ORB_OUT}>
          <AvatarOrb />
        </Animated.View>
      )}

      <Animated.View layout={REFLOW} style={[styles.pill, glass, pillStyle]}>
        {inline ? (
          <View style={styles.inlineRow}>
            <Ionicons name='search' size={18} color={colors.mutedForeground} />
            <View style={styles.slot}>
              <TextInput
                ref={inputRef}
                value={inline.value}
                onChangeText={inline.onChangeText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={searching ? inline.placeholder : ''}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType='search'
                autoCapitalize='none'
                autoCorrect={false}
                accessibilityLabel={inline.placeholder}
                style={[styles.input, { color: colors.foreground }]}
              />
              {!searching && (
                <>
                  <Animated.Text
                    pointerEvents='none'
                    numberOfLines={1}
                    style={[styles.hint, { color: colors.mutedForeground }, hintStyle]}
                  >
                    {inline.placeholder}
                  </Animated.Text>
                  <Animated.Text
                    pointerEvents='none'
                    numberOfLines={1}
                    style={[styles.pillTitle, { color: colors.foreground }, titleStyle]}
                  >
                    {title}
                  </Animated.Text>
                </>
              )}
            </View>
          </View>
        ) : (
          <GestureDetector gesture={gesture}>
            <View
              style={styles.pillRow}
              accessible
              accessibilityRole='button'
              accessibilityLabel={search === false ? title : `${title ?? ''}. Search`.trim()}
              accessibilityHint={search === false ? undefined : 'Opens search'}
              // The tap is a gesture, not a press: screen readers activate it through this.
              accessibilityActions={ACTIVATE}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'activate') pressPill(0);
              }}
            >
              <Animated.View style={[styles.pillRest, restStyle]}>
                {search !== false && (
                  <Ionicons name='search' size={18} color={colors.mutedForeground} />
                )}
                <View style={styles.slot}>
                  {search !== false && (
                    <Animated.Text
                      numberOfLines={1}
                      style={[styles.hint, { color: colors.mutedForeground }, hintStyle]}
                    >
                      {searchPlaceholder}
                    </Animated.Text>
                  )}
                  <Animated.Text
                    numberOfLines={1}
                    style={[
                      styles.pillTitle,
                      { color: colors.foreground },
                      search === false ? undefined : titleStyle,
                    ]}
                  >
                    {title}
                  </Animated.Text>
                </View>
              </Animated.View>
              <Animated.View pointerEvents='none' style={[styles.pullHint, pullHintStyle]}>
                <Ionicons name='arrow-down' size={15} color={colors.foreground} />
                <Text style={[styles.pullText, { color: colors.foreground }]}>
                  Release to search
                </Text>
              </Animated.View>
            </View>
          </GestureDetector>
        )}

        {action && !searching ? (
          <PressableScale
            onPress={action.onPress}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={6}
            accessibilityRole='button'
            accessibilityLabel={action.label}
            style={[styles.action, { backgroundColor: colors.raised }]}
          >
            <Ionicons name={action.icon} size={19} color={colors.foreground} />
          </PressableScale>
        ) : null}
      </Animated.View>

      {searching && (
        <Animated.View entering={ORB_IN} exiting={ORB_OUT}>
          <PressableScale
            onPress={clearInline}
            hitSlop={8}
            accessibilityRole='button'
            style={styles.cancel}
          >
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
});

/**
 * A tab's big title, the first thing in its scroll. The line under it says something true about
 * the page right now (what's playing, who's live, how many unread).
 */
export const LargeTitle = memo(function LargeTitle({
  title,
  line,
}: {
  title: string;
  line?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.large}>
      <Text
        style={[styles.largeTitle, { color: colors.foreground }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        accessibilityRole='header'
      >
        {title}
      </Text>
      {line ? (
        typeof line === 'string' ? (
          <Text style={[styles.line, { color: colors.mutedForeground }]} numberOfLines={1}>
            {line}
          </Text>
        ) : (
          <View style={styles.lineRow}>{line}</View>
        )
      ) : null}
    </View>
  );
});

// ─── Stack header ───────────────────────────────────────────────────────────────────────────────

/**
 * Header for pages you open (album, artist, settings…): back as an orb, the title in a pill,
 * then the page's own orb. Pass an animated `titleStyle` to bring the pill in on scroll, as pages
 * with artwork under the header do. Applies the top safe-area inset itself.
 */
export const StackHeader = memo(function StackHeader({
  title,
  titleStyle,
  right,
  onBack,
}: {
  title?: string;
  titleStyle?: StyleProp<AnimatedStyle<TextStyle>>;
  right?: ReactNode;
  /** Kept for callers from before; every header is the same glass now. */
  overlay?: boolean;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const glass = useGlass();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, styles.stackBar, { marginTop: Math.max(insets.top, 10) }]}>
      <HeaderOrb icon='chevron-back' label='Go back' onPress={onBack ?? goBackOrHome} />
      {title ? (
        <Animated.View
          style={[styles.pill, styles.stackPill, glass, titleStyle as StyleProp<ViewStyle>]}
        >
          <Text
            style={[styles.stackTitle, { color: colors.foreground }]}
            numberOfLines={1}
            accessibilityRole='header'
          >
            {title}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.flex} />
      )}
      {right ? <View style={styles.stackRight}>{right}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: ORB - 4, height: ORB - 4, borderRadius: (ORB - 4) / 2 },
  dot: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },

  edge: { position: 'absolute', top: HEADER_HEIGHT, left: 0, right: 0, height: 18 },
  bar: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: SIDE,
    zIndex: 10,
  },
  pill: {
    flex: 1,
    height: ORB,
    borderRadius: ORB / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 5,
  },
  pillRow: { flex: 1, height: '100%', justifyContent: 'center' },
  inlineRow: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
  },
  pillRest: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
  },
  slot: { flex: 1, height: 24, justifyContent: 'center' },
  hint: { ...StyleSheet.absoluteFill, ...typography.bodyMd, fontSize: 14.5, lineHeight: 24 },
  pillTitle: {
    ...StyleSheet.absoluteFill,
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  input: { ...StyleSheet.absoluteFill, fontSize: 15, paddingVertical: 0 },
  pullHint: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pullText: { ...typography.labelMd },
  action: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { height: ORB, justifyContent: 'center', paddingHorizontal: 4 },
  cancelText: { ...typography.labelLg },

  large: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  largeTitle: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  line: { ...typography.bodySm, fontSize: 13.5, marginTop: 3 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },

  stackBar: { paddingBottom: 0 },
  stackPill: { justifyContent: 'center', paddingHorizontal: 16, paddingRight: 16 },
  stackTitle: { fontFamily: fonts.displaySemibold, fontSize: 16, letterSpacing: -0.3 },
  stackRight: {
    minWidth: ORB,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
