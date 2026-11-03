import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import type { Message } from '@/stores/groupMusic/types';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { previewText, QUICK_REACTIONS, sameUser } from './chatUtils';

/**
 * Long-press menu for a message: one-tap reactions on top, then actions. Pops in from the
 * centre with a short ease-out, dims the room behind it, and closes on any outside tap.
 */
export const MessageActions = memo(function MessageActions({
  message,
  myId,
  onClose,
  onReact,
  onReply,
}: {
  message: Message | null;
  myId?: number | string;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (m: Message) => void;
}) {
  const { colors } = useTheme();
  if (!message) return null;

  const mine = (emoji: string) =>
    (message.reactions?.[emoji] || []).some((p) => sameUser(p.userId, myId));

  return (
    <Modal transparent visible animationType='none' onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(120)}
        exiting={FadeOut.duration(100)}
        style={styles.backdrop}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel='Close menu'
        />

        <Animated.View
          entering={ZoomIn.duration(160).springify().damping(26).stiffness(420)}
          style={[styles.sheet, { backgroundColor: colors.popover, borderColor: colors.border }]}
        >
          <View style={styles.preview}>
            <Text style={[styles.previewName, { color: colors.mutedForeground }]} numberOfLines={1}>
              {message.userName || 'Message'}
            </Text>
            <Text style={[styles.previewText, { color: colors.foreground }]} numberOfLines={3}>
              {previewText(message) || 'Message'}
            </Text>
          </View>

          <View style={[styles.reactions, { backgroundColor: colors.raised }]}>
            {QUICK_REACTIONS.map((e) => (
              <PressableScale
                key={e}
                scaleTo={0.8}
                onPress={() => {
                  onReact(message.id, e);
                  onClose();
                }}
                accessibilityRole='button'
                accessibilityLabel={`React with ${e}`}
                style={[styles.reaction, mine(e) && { backgroundColor: `${colors.primary}26` }]}
              >
                <Text style={styles.reactionText}>{e}</Text>
              </PressableScale>
            ))}
          </View>

          <PressableScale
            scaleTo={0.98}
            onPress={() => {
              onReply(message);
              onClose();
            }}
            accessibilityRole='button'
            style={styles.action}
          >
            <Ionicons name='arrow-undo-outline' size={19} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>Reply</Text>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,5,12,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  preview: { paddingHorizontal: 6, paddingTop: 4 },
  previewName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  previewText: { fontSize: 15, lineHeight: 20 },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 999,
    padding: 4,
  },
  reaction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionText: { fontSize: 24 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
