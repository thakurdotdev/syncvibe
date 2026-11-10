import { router, usePathname } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { ENTER, EXIT, ROW_PRESS_SCALE } from '@/lib/motion';
import { useChatStore } from '@/stores/chatStore';
import Avatar from './Avatar';

/**
 * A message that arrives while the app is open, for a conversation that isn't on screen, shows
 * here instead of as a phone notification. Tap to open it; swipe it up to put it away.
 */

const SHOW_MS = 4000;
const HIDDEN_Y = -140;
/** Pushed this far up, it goes. */
const DISMISS_DRAG = -24;

export interface Banner {
  conversationId: number;
  name: string;
  profilepic: string | null;
  text: string;
  /** Messages from this person since the banner appeared. */
  count: number;
  /** Changes for every message, so a newer one restarts the timer. */
  key: number;
}

const useBannerStore = create<{ banner: Banner | null; hide: () => void }>((set) => ({
  banner: null,
  hide: () => set({ banner: null }),
}));

export const showMessageBanner = (banner: Omit<Banner, 'count' | 'key'>): void => {
  const current = useBannerStore.getState().banner;
  const sameConversation = current?.conversationId === banner.conversationId;
  useBannerStore.setState({
    banner: {
      ...banner,
      count: sameConversation ? current.count + 1 : 1,
      key: Date.now(),
    },
  });
};

const MessageBanner = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const banner = useBannerStore((s) => s.banner);
  const hide = useBannerStore((s) => s.hide);
  const y = useSharedValue(HIDDEN_Y);

  // The conversation list already shows it; the conversation itself even more so.
  const onMessages = pathname === '/chat' || pathname === '/message';

  const leave = useCallback(() => {
    y.set(
      withTiming(HIDDEN_Y, EXIT, (finished) => {
        if (finished) scheduleOnRN(hide);
      })
    );
  }, [hide, y]);

  useEffect(() => {
    if (!banner) return;
    if (onMessages) {
      hide();
      return;
    }
    y.set(withTiming(0, ENTER));
    const timer = setTimeout(leave, SHOW_MS);
    return () => clearTimeout(timer);
  }, [banner, onMessages, hide, leave, y]);

  const open = useCallback(() => {
    if (!banner) return;
    hide();
    y.set(HIDDEN_Y);
    useChatStore.getState().setActive(banner.conversationId);
    router.push('/message');
  }, [banner, hide, y]);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onUpdate((e) => {
          // Up follows the finger; down barely moves: there is nowhere to go.
          y.set(e.translationY < 0 ? e.translationY : e.translationY * 0.15);
        })
        .onEnd((e) => {
          if (e.translationY < DISMISS_DRAG || e.velocityY < -500) scheduleOnRN(leave);
          else y.set(withTiming(0, ENTER));
        }),
    [leave, y]
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  if (!banner || onMessages) return null;

  return (
    <View pointerEvents='box-none' style={[styles.layer, { top: insets.top + 8 }]}>
      <GestureDetector gesture={swipe}>
        <Animated.View style={[styles.card, style]}>
          <PressableScale
            onPress={open}
            scaleTo={ROW_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel={`Message from ${banner.name}: ${banner.text}. Open conversation`}
            style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.hairline }]}
          >
            <Avatar name={banner.name} profilepic={banner.profilepic ?? undefined} size='sm' />
            <View style={styles.body}>
              <View style={styles.top}>
                <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                  {banner.name}
                </Text>
                {banner.count > 1 ? (
                  <Text style={[styles.count, { color: colors.mutedForeground }]}>
                    {banner.count} new
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.text, { color: colors.mutedForeground }]} numberOfLines={2}>
                {banner.text}
              </Text>
            </View>
          </PressableScale>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9998,
    // Android layers by elevation: above the player and the bottom deck.
    elevation: 49,
  },
  card: { width: '100%' },
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  count: { fontSize: 12, fontVariant: ['tabular-nums'] },
  text: { fontSize: 14, lineHeight: 19, marginTop: 1 },
});

export default React.memo(MessageBanner);
