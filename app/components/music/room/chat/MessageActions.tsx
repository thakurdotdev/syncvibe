import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { ENTER, EXIT, POP_FROM_SCALE } from '@/lib/motion';
import type { Message } from '@/stores/groupMusic/types';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUICK_REACTIONS, sameUser } from './chatUtils';

export type AnchorRect = { x: number; y: number; width: number; height: number };

const EDGE = 12;
const GAP = 8;
const BAR_HEIGHT = 52;
const BAR_WIDTH = QUICK_REACTIONS.length * 44 + 8;
const MENU_WIDTH = 200;
const MENU_HEIGHT = 50;

/**
 * Long-press menu anchored to the message: reactions appear just above the bubble and
 * actions just below, both growing from the bubble's side (transform-origin at the
 * bubble) from 0.95 with a 200ms ease-out; closing reverses it in 140ms before unmounting.
 * No spring: nothing here was flung, so overshoot would read as wrong. Reduce Motion is
 * honoured by the shared ENTER/EXIT presets (opacity only).
 */
export const MessageActions = memo(function MessageActions({
  target,
  myId,
  onClose,
  onReact,
  onReply,
}: {
  target: { message: Message; anchor: AnchorRect; own: boolean } | null;
  myId?: number | string;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (m: Message) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!target) return;
    progress.set(0);
    progress.set(withTiming(1, ENTER));
  }, [target, progress]);

  const dismiss = useCallback(
    (after?: () => void) => {
      progress.set(
        withTiming(0, EXIT, (finished) => {
          if (!finished) return;
          scheduleOnRN(onClose);
          if (after) scheduleOnRN(after);
        })
      );
    },
    [progress, onClose]
  );

  const own = target?.own ?? false;
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const popStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: POP_FROM_SCALE + (1 - POP_FROM_SCALE) * progress.get() }],
  }));

  if (!target) return null;
  const { message, anchor } = target;

  // Horizontal: align with the bubble's side, kept inside the screen.
  const sideX = (w: number) =>
    own
      ? Math.max(EDGE, Math.min(anchor.x + anchor.width - w, screenW - w - EDGE))
      : Math.max(EDGE, Math.min(anchor.x, screenW - w - EDGE));

  // Vertical: reactions above, actions below; flip when there isn't room.
  const top = insets.top + EDGE;
  const bottom = screenH - insets.bottom - EDGE;
  let barY = anchor.y - BAR_HEIGHT - GAP;
  let menuY = anchor.y + anchor.height + GAP;
  if (barY < top) barY = Math.min(menuY, bottom - BAR_HEIGHT - MENU_HEIGHT - GAP);
  if (menuY + MENU_HEIGHT > bottom) menuY = Math.max(top, barY - MENU_HEIGHT - GAP);
  if (barY === menuY || Math.abs(barY - menuY) < BAR_HEIGHT) menuY = barY + BAR_HEIGHT + GAP;

  const origin = own ? 'right' : 'left';
  const mine = (emoji: string) =>
    (message.reactions?.[emoji] || []).some((p) => sameUser(p.userId, myId));

  return (
    <Modal
      transparent
      visible
      animationType='none'
      onRequestClose={() => dismiss()}
      statusBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismiss()}
          accessibilityLabel='Close menu'
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.bar,
          {
            top: barY,
            left: sideX(BAR_WIDTH),
            backgroundColor: colors.popover,
            borderColor: colors.border,
          },
          { transformOrigin: `${origin} bottom` },
          popStyle,
        ]}
      >
        {QUICK_REACTIONS.map((e) => (
          <PressableScale
            key={e}
            scaleTo={0.78}
            onPress={() => dismiss(() => onReact(message.id, e))}
            accessibilityRole='button'
            accessibilityLabel={`React with ${e}`}
            style={[styles.reaction, mine(e) && { backgroundColor: `${colors.primary}26` }]}
          >
            <Text style={styles.reactionText}>{e}</Text>
          </PressableScale>
        ))}
      </Animated.View>

      <Animated.View
        style={[
          styles.menu,
          {
            top: menuY,
            left: sideX(MENU_WIDTH),
            backgroundColor: colors.popover,
            borderColor: colors.border,
          },
          { transformOrigin: `${origin} top` },
          popStyle,
        ]}
      >
        <PressableScale
          scaleTo={0.97}
          onPress={() => dismiss(() => onReply(message))}
          accessibilityRole='button'
          style={styles.action}
        >
          <Ionicons name='arrow-undo-outline' size={18} color={colors.foreground} />
          <Text style={[styles.actionText, { color: colors.foreground }]}>Reply</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(8,5,12,0.45)' },
  bar: {
    position: 'absolute',
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  reaction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: { fontSize: 24 },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
