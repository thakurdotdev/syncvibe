import Avatar from '@/components/chat/Avatar';
import { HEADER_HEIGHT, ORB } from '@/components/ui/AppHeader';
import { CachedImage } from '@/components/ui/CachedImage';
import PressableScale from '@/components/ui/PressableScale';
import { useGroupMusic } from '@/context/GroupMusicContext';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE, EASE_MAGNET, EXIT, ROW_PRESS_SCALE } from '@/lib/motion';
import { useGroupInviteStore } from '@/stores/groupMusic/groupInviteStore';
import { dropMoment, showMoment, useIslandStore, type MomentLeading } from '@/stores/islandStore';
import { typography } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

/*
 * A moment grows out of the header's pill: from the pill's own place and size to the full width
 * of the bar, a little taller, with what happened inside. A line along its bottom runs down while
 * it stays; a finger on it holds it. It goes back into the pill when its time is up, or flies off
 * when swiped up. On a screen without a pill it simply appears in the same place.
 */

const SIDE = 12;
/** Where the pill starts on a tab: after your avatar orb and the gap. */
const PILL_OFFSET = ORB + 8;
const HEIGHT = 62;
/** With more waiting, the one showing gives way after this long. */
const HURRY_MS = 1600;
const DISMISS_DRAG = -22;

const system = ReduceMotion.System;
const GROW = { duration: 460, dampingRatio: 0.86, reduceMotion: system } as const;
const SHRINK = { duration: 260, easing: EASE_MAGNET, reduceMotion: system } as const;
const SETTLE = { duration: 260, dampingRatio: 1, reduceMotion: system } as const;

const onRooms = (path: string) => path === '/group-music';

const ICONS = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
} as const;

const Leading = memo(function Leading({ leading }: { leading: MomentLeading }) {
  const { colors } = useTheme();
  if (leading.kind === 'avatar') {
    return <Avatar name={leading.name} profilepic={leading.pic ?? undefined} size='sm' />;
  }
  if (leading.kind === 'image') {
    return (
      <CachedImage
        source={{ uri: leading.uri }}
        style={[styles.image, { backgroundColor: colors.raised }]}
      />
    );
  }
  return (
    <View style={[styles.icon, { backgroundColor: colors.raised }]}>
      <Ionicons
        name={ICONS[leading.icon]}
        size={21}
        color={leading.icon === 'error' ? colors.destructive : colors.foreground}
      />
    </View>
  );
});

/** Room invites become moments wherever you are, except on Rooms, which asks in its own sheet. */
function useInviteMoments(pathname: string) {
  const invite = useGroupInviteStore((s) => s.pendingInvite);
  const { acceptInvite } = useGroupMusic();
  const shownFor = useRef<string | null>(null);

  useEffect(() => {
    if (!invite) {
      if (shownFor.current) dropMoment(`invite-${shownFor.current}`);
      shownFor.current = null;
      return;
    }
    if (shownFor.current === invite.groupId || onRooms(pathname)) return;
    shownFor.current = invite.groupId;
    showMoment({
      key: `invite-${invite.groupId}`,
      title: `${invite.inviterName} invited you`,
      subtitle: invite.groupName,
      leading: { kind: 'avatar', name: invite.inviterName, pic: invite.inviterPic },
      action: { label: 'Join', onPress: acceptInvite },
      onPress: () => router.navigate('/(tabs)/group-music'),
      duration: 8000,
      hideOn: onRooms,
    });
  }, [invite, pathname, acceptInvite]);
}

function TopIsland() {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const current = useIslandStore((s) => s.current);
  const waiting = useIslandStore((s) => s.queue.length);
  const next = useIslandStore((s) => s.next);
  useInviteMoments(pathname);

  const grow = useSharedValue(0);
  const drag = useSharedValue(0);
  const away = useSharedValue(1);
  const time = useSharedValue(1);
  const duration = useSharedValue(1);
  /** On its way back into the pill; a second leave does nothing. */
  const leaving = useSharedValue(false);

  const finish = useCallback(() => {
    leaving.set(false);
    drag.set(0);
    away.set(1);
    next();
  }, [away, drag, leaving, next]);

  const leave = useCallback(() => {
    if (leaving.get()) return;
    leaving.set(true);
    cancelAnimation(time);
    grow.set(
      withTiming(0, SHRINK, (done) => {
        if (done) scheduleOnRN(finish);
      })
    );
  }, [finish, grow, leaving, time]);

  const run = useCallback(
    (ms: number) => {
      duration.set(ms);
      time.set(
        withTiming(0, { duration: ms, easing: Easing.linear }, (done) => {
          if (done) scheduleOnRN(leave);
        })
      );
    },
    [duration, leave, time]
  );

  // Each new moment (or the same one again) grows in and starts its time.
  const hidden = current?.hideOn?.(pathname) ?? false;
  useEffect(() => {
    if (!current) return;
    if (hidden || current.duration <= 0) {
      if (grow.get() > 0) leave();
      else finish();
      return;
    }
    leaving.set(false);
    grow.set(withSpring(1, GROW));
    time.set(1);
    run(current.duration);
    AccessibilityInfo.announceForAccessibility(
      [current.title, current.subtitle].filter(Boolean).join('. ')
    );
    // `current` is a new object only for a new moment or a repeat, which is when this restarts.
  }, [current, hidden, finish, grow, leave, leaving, run, time]);

  // Something else is waiting: this one stays only a moment longer.
  useEffect(() => {
    if (!current || !waiting || leaving.get()) return;
    if (time.get() * duration.get() > HURRY_MS) {
      cancelAnimation(time);
      time.set(1);
      run(HURRY_MS);
    }
  }, [waiting, current, run, time, duration, leaving]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-6, 6])
        .onBegin(() => {
          cancelAnimation(time);
        })
        .onUpdate((e) => {
          // Up follows the finger; down only gives a little.
          drag.set(e.translationY < 0 ? e.translationY : e.translationY * 0.15);
        })
        .onEnd((e) => {
          if (e.translationY < DISMISS_DRAG || e.velocityY < -500) {
            // No time left: the touch ending won't start it running again.
            time.set(0);
            drag.set(withTiming(-HEIGHT - 30, EXIT));
            away.set(
              withTiming(0, EXIT, (done) => {
                if (done) scheduleOnRN(finish);
              })
            );
          } else {
            drag.set(withSpring(0, SETTLE));
          }
        })
        .onFinalize(() => {
          // A touch that didn't dismiss it lets its time run on from where it was.
          if (time.get() > 0) {
            time.set(
              withTiming(
                0,
                { duration: duration.get() * time.get(), easing: Easing.linear },
                (done) => {
                  if (done) scheduleOnRN(leave);
                }
              )
            );
          }
        }),
    [away, drag, duration, finish, leave, time]
  );

  const frameStyle = useAnimatedStyle(() => {
    const k = grow.get();
    return {
      left: interpolate(k, [0, 1], [PILL_OFFSET, 0]),
      height: interpolate(k, [0, 1], [ORB, HEIGHT]),
      borderRadius: interpolate(k, [0, 1], [ORB / 2, 24]),
      opacity: interpolate(k, [0, 0.2], [0, 1], 'clamp') * away.get(),
      transform: [{ translateY: drag.get() }],
    };
  });
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(grow.get(), [0.5, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(grow.get(), [0, 1], [8, 0]) }],
  }));
  const timeStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: time.get() }] }));

  if (!current || hidden) return null;

  const press = () => {
    current.onPress?.();
    leave();
  };
  const subtitle =
    current.count > 1 && current.leading?.kind === 'avatar' && current.subtitle
      ? `${current.count} new · ${current.subtitle}`
      : current.subtitle;
  const shadow =
    theme === 'dark' ? '0 14px 32px -10px rgba(0,0,0,0.7)' : '0 14px 30px -12px rgba(0,0,0,0.28)';

  return (
    <View
      pointerEvents='box-none'
      style={[styles.layer, { top: insets.top + (HEADER_HEIGHT - ORB) / 2 }]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityLiveRegion='polite'
          style={[
            styles.frame,
            { backgroundColor: colors.card, borderColor: colors.hairline, boxShadow: shadow },
            frameStyle,
          ]}
        >
          <Animated.View style={[styles.content, contentStyle]}>
            <PressableScale
              onPress={press}
              scaleTo={ROW_PRESS_SCALE}
              accessibilityRole={current.onPress ? 'button' : 'text'}
              accessibilityLabel={[current.title, subtitle].filter(Boolean).join('. ')}
              style={styles.body}
            >
              {current.leading ? <Leading leading={current.leading} /> : null}
              <View style={styles.text}>
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={subtitle ? 1 : 2}
                >
                  {current.title}
                </Text>
                {subtitle ? (
                  <Text
                    style={[styles.subtitle, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
            {current.action ? (
              <PressableScale
                onPress={() => {
                  current.action?.onPress();
                  leave();
                }}
                scaleTo={BUTTON_PRESS_SCALE}
                hitSlop={8}
                accessibilityRole='button'
                accessibilityLabel={`${current.action.label}: ${current.title}`}
                style={[styles.action, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                  {current.action.label}
                </Text>
              </PressableScale>
            ) : null}
          </Animated.View>
          <View style={styles.timeTrack} pointerEvents='none'>
            <Animated.View
              style={[styles.timeFill, { backgroundColor: colors.foreground }, timeStyle]}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    height: HEIGHT,
    zIndex: 9998,
    // Android layers by elevation: above the player and the bottom bar.
    elevation: 50,
  },
  frame: {
    position: 'absolute',
    top: 0,
    right: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    gap: 8,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 },
  image: { width: 40, height: 40, borderRadius: 11 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { ...typography.labelLg, fontSize: 14.5, letterSpacing: -0.15 },
  subtitle: { ...typography.bodySm, fontSize: 12.5, marginTop: 1 },
  action: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center' },
  actionText: { ...typography.labelMd, fontSize: 13.5 },
  timeTrack: { position: 'absolute', left: 22, right: 22, bottom: 0, height: 2 },
  timeFill: { flex: 1, borderRadius: 1, opacity: 0.28, transformOrigin: 'left' },
});

export default memo(TopIsland);
