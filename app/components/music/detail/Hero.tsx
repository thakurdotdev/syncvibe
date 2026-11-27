import { CachedImage } from '@/components/ui/CachedImage';
import { Gloss } from '@/components/ui/Finish';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { alpha } from '@/lib/color';
import { EASE_OUT, IMAGE_FADE_MS, LIST_PRESS_DELAY } from '@/lib/motion';
import { usePrefetchDetails } from '@/queries/useMusic';
import { fonts, typography } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useIsFocused } from 'expo-router';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDetail } from './context';
import { coverOf } from './format';
import { STAGGER, useRise } from './motion';

const system = ReduceMotion.System;

// ─── Record sleeve ──────────────────────────────────────────────────────────────────────────────

/** A record is black in either theme: it's an object on the page, not part of the interface. */
const VINYL = '#121214';
const GROOVE = 'rgba(255,255,255,0.055)';
/** How far the record comes out of its sleeve, as a share of the sleeve. */
const PEEK = 0.4;
/** Out a little further once it's the one playing. */
const PLAYING_OUT = 1.12;
/** One turn at about 33⅓ rpm, and the spin-up that reaches that speed. */
const REV_MS = 2100;
const SPIN_UP = { deg: 120, ms: 1400 };
/** A record let go at full speed comes to rest over this much of a turn. */
const COAST = { deg: 75, ms: 900 };
/** Rolling out of the sleeve turns it about this much. */
const ROLL_DEG = 50;

const SLEEVE_IN = { duration: 420, easing: EASE_OUT, reduceMotion: system } as const;
const RECORD_OUT = { duration: 620, easing: EASE_OUT, reduceMotion: system } as const;
const RECORD_SHIFT = { duration: 380, easing: EASE_OUT, reduceMotion: system } as const;

const RINGS = [0.93, 0.84, 0.76, 0.66, 0.56];

/** Four covers in a square, for a playlist without a picture of its own. */
const Mosaic = memo(function Mosaic({ covers }: { covers: string[] }) {
  if (covers.length < 4) {
    return <CachedImage source={{ uri: covers[0] }} style={StyleSheet.absoluteFill} />;
  }
  return (
    <View style={styles.mosaic}>
      {covers.slice(0, 4).map((uri) => (
        <CachedImage key={uri} source={{ uri }} style={styles.mosaicTile} />
      ))}
    </View>
  );
});

type SleeveArt = {
  /** The 500px cover. */
  cover?: string;
  /** Covers for a mosaic, used when there's no cover. */
  mosaic?: string[];
  /** A drawn cover instead (Liked songs). */
  art?: ReactNode;
  /** A drawn record label instead of the cover. */
  label?: ReactNode;
};

/**
 * The cover as a record sleeve, with its record sliding out from behind. The record turns while
 * one of the list's songs plays, spinning up and coasting to a stop like a real one, and a
 * little as you scroll past it.
 */
export const SleeveHero = memo(function SleeveHero({
  cover,
  mosaic,
  art,
  label,
  active,
  playing,
}: SleeveArt & { active: boolean; playing: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { scrollY } = useDetail();
  const focused = useIsFocused();
  const reduced = useReducedMotion();

  const size = Math.round(Math.min((width - 40) / (1 + PEEK + 0.02), 280));
  const disc = Math.round(size * 0.94);
  const peek = size * PEEK;

  const arrive = useSharedValue(0);
  const out = useSharedValue(0);
  const spin = useSharedValue(0);
  const firstOut = useRef(true);
  const wasSpinning = useRef(false);

  useEffect(() => {
    arrive.set(withTiming(1, SLEEVE_IN));
  }, [arrive]);

  useEffect(() => {
    const to = withTiming(active ? PLAYING_OUT : 1, firstOut.current ? RECORD_OUT : RECORD_SHIFT);
    out.set(firstOut.current ? withDelay(180, to, system) : to);
    firstOut.current = false;
  }, [active, out]);

  useEffect(() => {
    const spinning = playing && focused && !reduced;
    if (spinning) {
      const from = spin.get() % 360;
      spin.set(from);
      spin.set(
        withSequence(
          withTiming(from + SPIN_UP.deg, {
            duration: SPIN_UP.ms,
            easing: Easing.in(Easing.quad),
          }),
          withRepeat(
            withTiming(from + SPIN_UP.deg + 360, { duration: REV_MS, easing: Easing.linear }),
            -1,
            false
          )
        )
      );
    } else {
      cancelAnimation(spin);
      if (wasSpinning.current && !reduced) {
        spin.set(
          withTiming(spin.get() + COAST.deg, {
            duration: COAST.ms,
            easing: Easing.out(Easing.quad),
          })
        );
      }
    }
    wasSpinning.current = spinning;
  }, [playing, focused, reduced, spin]);

  // The whole sleeve drifts up slower than the page and recedes as it goes.
  const heroStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.get());
    return {
      opacity: interpolate(y, [0, size * 0.75], [1, 0], 'clamp'),
      transform: [
        { translateY: y * 0.25 },
        { scale: interpolate(y, [0, size], [1, 0.94], 'clamp') },
      ],
    };
  });

  const sleeveStyle = useAnimatedStyle(() => ({
    opacity: arrive.get(),
    transform: [{ translateY: (1 - arrive.get()) * 14 }, { scale: 0.94 + 0.06 * arrive.get() }],
  }));

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: out.get() * peek }],
  }));

  const turnStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spin.get() + out.get() * ROLL_DEG + Math.max(0, scrollY.get()) * 0.3}deg` },
    ],
  }));

  const labelSize = Math.round(disc * 0.38);
  const inset = (size - disc) / 2;

  return (
    <Animated.View
      style={[styles.sleeveRow, { height: size, width: size * (1 + PEEK) + inset }, heroStyle]}
      accessibilityElementsHidden
      importantForAccessibility='no-hide-descendants'
    >
      <Animated.View
        style={[
          styles.record,
          { width: disc, height: disc, borderRadius: disc / 2, top: inset, left: inset },
          slideStyle,
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, turnStyle]}>
          {RINGS.map((r) => (
            <View
              key={r}
              style={[
                styles.ring,
                { width: disc * r, height: disc * r, borderRadius: (disc * r) / 2 },
              ]}
            />
          ))}
          <View
            style={[
              styles.label,
              { width: labelSize, height: labelSize, borderRadius: labelSize / 2 },
            ]}
          >
            {label ??
              (cover || mosaic?.[0] ? (
                <CachedImage
                  source={{ uri: cover || mosaic?.[0] }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />
              ))}
          </View>
          <View style={[styles.spindle, { backgroundColor: colors.background }]} />
        </Animated.View>
        {/* Light falls on the record from one place, so the shine stays put while it turns. */}
        <LinearGradient
          pointerEvents='none'
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.11)',
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.05)',
            'rgba(255,255,255,0)',
          ]}
          locations={[0.18, 0.36, 0.5, 0.66, 0.82]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sleeve,
          { width: size, height: size, backgroundColor: colors.raised },
          sleeveStyle,
        ]}
        // A shadow on the sleeve, not its clipped content.
      >
        <View style={[styles.sleeveClip, { backgroundColor: colors.raised }]}>
          {art ??
            (cover ? (
              <CachedImage
                source={{ uri: cover }}
                transition={IMAGE_FADE_MS}
                style={StyleSheet.absoluteFill}
              />
            ) : mosaic?.length ? (
              <Mosaic covers={mosaic} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.center]}>
                <Ionicons name='musical-notes' size={size * 0.3} color={colors.mutedForeground} />
              </View>
            ))}
          {/* The fold of the sleeve along its left edge, and light along its top. */}
          <LinearGradient
            pointerEvents='none'
            colors={['rgba(0,0,0,0.22)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.spine}
          />
          <View pointerEvents='none' style={styles.sleeveSheen} />
          <View
            pointerEvents='none'
            style={[StyleSheet.absoluteFill, styles.sleeveEdge, { borderColor: colors.hairline }]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
});

// ─── Artist portrait ────────────────────────────────────────────────────────────────────────────

/**
 * An artist's photo across the whole top of the page, with their name set over its lower edge.
 * The photo settles in as the page opens and lags behind as you scroll, like a window onto it.
 */
export const PortraitHero = memo(function PortraitHero({
  image,
  children,
}: {
  image?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { scrollY } = useDetail();
  const height = Math.round(Math.min(width * 1.08, 500));

  const settle = useSharedValue(1.08);
  useEffect(() => {
    settle.set(withTiming(1, { duration: 1400, easing: EASE_OUT, reduceMotion: system }));
  }, [settle]);

  const photoStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [
        { translateY: Math.max(0, y) * 0.5 },
        // Pulling past the top (where the platform allows it) grows the photo instead.
        { scale: settle.get() * (y < 0 ? 1 - y / height : 1) },
      ],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.get());
    return {
      opacity: interpolate(y, [0, height * 0.55], [1, 0], 'clamp'),
      transform: [{ translateY: y * 0.18 }],
    };
  });

  const bg = colors.background;
  return (
    <View style={[styles.portrait, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
        <CachedImage
          source={{ uri: image }}
          transition={IMAGE_FADE_MS}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.raised }]}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <LinearGradient
        pointerEvents='none'
        colors={[alpha(bg, 0), alpha(bg, 0), alpha(bg, 0.72), alpha(bg, 1)]}
        locations={[0, 0.4, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Keeps the status bar and back button readable over a bright photo. */}
      <LinearGradient
        pointerEvents='none'
        colors={[alpha(bg, 0.6), alpha(bg, 0)]}
        style={[styles.topScrim, { height: insets.top + 72 }]}
      />
      <Animated.View style={[styles.portraitText, textStyle]}>{children}</Animated.View>
    </View>
  );
});

// ─── Words ──────────────────────────────────────────────────────────────────────────────────────

/** One piece of the page's text arriving in its turn (0 first). */
export function Rise({
  order,
  children,
  style,
}: {
  order: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rise = useRise(80 + order * STAGGER);
  return <Animated.View style={[style, rise]}>{children}</Animated.View>;
}

/** Small capitals above the title: what this is. */
export const Kicker = memo(function Kicker({
  children,
  icon,
}: {
  children: string;
  icon?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.kickerRow}>
      {icon}
      <Text style={[styles.kicker, { color: colors.mutedForeground }]} numberOfLines={1}>
        {children.toUpperCase()}
      </Text>
    </View>
  );
});

/** The page's name, set large; long names step down a size so they still fit in three lines. */
export const DisplayTitle = memo(function DisplayTitle({
  children,
  huge = false,
}: {
  children: string;
  huge?: boolean;
}) {
  const { colors } = useTheme();
  const n = children.length;
  // Steps, not a formula: each one fits the name in its lines on a 360pt-wide phone.
  const steps = huge
    ? [
        [10, 50],
        [16, 42],
        [24, 36],
      ]
    : [
        [22, 34],
        [44, 28],
      ];
  const fontSize = steps.find(([max]) => n <= max)?.[1] ?? (huge ? 30 : 24);
  return (
    <Text
      style={[
        styles.title,
        { color: colors.foreground, fontSize, lineHeight: Math.round(fontSize * 1.08) },
      ]}
      numberOfLines={3}
      accessibilityRole='header'
    >
      {children}
    </Text>
  );
});

/** "10 songs · 46 min · 912M plays", skipping whatever is empty. */
export const MetaLine = memo(function MetaLine({
  parts,
}: {
  parts: (string | false | undefined)[];
}) {
  const { colors } = useTheme();
  const text = parts.filter(Boolean).join('  ·  ');
  if (!text) return null;
  return (
    <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={2}>
      {text}
    </Text>
  );
});

const EXPAND = LinearTransition.duration(240).reduceMotion(system);
/** About this many characters fill a line of body text on a phone. */
const CHARS_PER_LINE = 46;

/** A description cut to a few lines, opening in place when tapped. */
export const ExpandableText = memo(function ExpandableText({
  text,
  lines = 2,
}: {
  text: string;
  lines?: number;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const canOpen = text.length > lines * CHARS_PER_LINE;
  return (
    <Animated.View layout={EXPAND}>
      <Pressable
        onPress={canOpen ? () => setOpen((v) => !v) : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? 'button' : 'text'}
        accessibilityState={canOpen ? { expanded: open } : undefined}
        accessibilityHint={canOpen ? (open ? 'Shows less' : 'Shows all of it') : undefined}
      >
        <Text
          style={[styles.body, { color: colors.mutedForeground }]}
          numberOfLines={open ? undefined : lines}
        >
          {text}
        </Text>
        {canOpen && (
          <Text style={[styles.more, { color: colors.foreground }]}>
            {open ? 'Show less' : 'Read more'}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
});

// ─── Artist chips ───────────────────────────────────────────────────────────────────────────────

export type ChipArtist = { id?: string; name?: string; image?: unknown };

const ArtistChip = memo(function ArtistChip({ artist }: { artist: ChipArtist }) {
  const { colors } = useTheme();
  const prefetch = usePrefetchDetails('artist', artist.id);
  const name = artist.name?.trim() ?? '';
  const avatar = coverOf(artist.image, 0);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/artist', params: { id: artist.id } })}
      onPressIn={prefetch}
      unstable_pressDelay={LIST_PRESS_DELAY}
      accessibilityRole='link'
      accessibilityLabel={`Open ${name}`}
      style={[styles.chip, { borderColor: colors.hairline }]}
    >
      <Gloss tone='surface' />
      {avatar ? (
        <CachedImage
          source={{ uri: avatar }}
          style={[styles.chipAvatar, { backgroundColor: colors.raised }]}
        />
      ) : (
        <View style={[styles.chipAvatar, styles.center, { backgroundColor: colors.raised }]}>
          <Ionicons name='person' size={12} color={colors.mutedForeground} />
        </View>
      )}
      <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>
        {name}
      </Text>
    </PressableScale>
  );
});

/** The people behind an album or playlist, each a way to their page. */
export const ArtistChips = memo(function ArtistChips({ artists }: { artists?: ChipArtist[] }) {
  const seen = new Set<string>();
  const list = (artists ?? []).filter((a) => {
    if (!a?.id || !a.name?.trim() || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  if (!list.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipScroller}
    >
      {list.slice(0, 8).map((artist) => (
        <ArtistChip key={artist.id} artist={artist} />
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  sleeveRow: { marginLeft: 20, marginTop: 8, marginBottom: 22 },
  record: { position: 'absolute', backgroundColor: VINYL, overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: GROOVE },
  label: { overflow: 'hidden', backgroundColor: '#2a2a2e' },
  spindle: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5 },
  sleeve: {
    borderRadius: 6,
    // A system shadow, not a blurred one: this scrolls, and a blurred shadow is redrawn each frame.
    elevation: 10,
  },
  sleeveClip: { flex: 1, borderRadius: 6, overflow: 'hidden' },
  sleeveEdge: { borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '7%' },
  sleeveSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  mosaic: { ...StyleSheet.absoluteFill, flexDirection: 'row', flexWrap: 'wrap' },
  mosaicTile: { width: '50%', height: '50%' },

  portrait: { overflow: 'hidden', justifyContent: 'flex-end' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  portraitText: { paddingHorizontal: 20, paddingBottom: 4 },

  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kicker: { ...typography.labelSm, letterSpacing: 1.4 },
  title: { fontFamily: fonts.displayHeavy, letterSpacing: -0.9 },
  meta: { ...typography.bodySm, marginTop: 8, fontVariant: ['tabular-nums'] },
  body: { ...typography.bodyMd },
  more: { ...typography.labelMd, marginTop: 4 },

  chipScroller: { marginHorizontal: -20, marginTop: 14 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 32,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  chipAvatar: { width: 24, height: 24, borderRadius: 12 },
  chipText: { ...typography.labelMd, maxWidth: 160 },
});
