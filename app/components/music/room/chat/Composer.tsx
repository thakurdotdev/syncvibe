import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import type { ReplyRef } from '@/stores/groupMusic/types';
import { Feather, Ionicons } from '@expo/vector-icons';
import { forwardRef, memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { previewText } from './chatUtils';

const TYPING_IDLE_MS = 2000;

type Props = {
  replyTo: ReplyRef | null;
  onCancelReply: () => void;
  onSend: (text: string) => void;
  onOpenGifs: () => void;
  onOpenSounds: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
};

/**
 * Message composer. Shows what you're replying to, sends on the send button, and emits
 * typing start/stop at most once per burst instead of on every keystroke.
 */
export const Composer = memo(
  forwardRef<TextInput, Props>(function Composer(
    { replyTo, onCancelReply, onSend, onOpenGifs, onOpenSounds, onTypingStart, onTypingStop },
    ref
  ) {
    const { colors } = useTheme();
    const [text, setText] = useState('');
    const typing = useRef(false);
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopTyping = useCallback(() => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (typing.current) {
        typing.current = false;
        onTypingStop();
      }
    }, [onTypingStop]);

    useEffect(() => stopTyping, [stopTyping]);

    const handleChange = (value: string) => {
      setText(value);
      if (!value.trim()) return stopTyping();
      if (!typing.current) {
        typing.current = true;
        onTypingStart();
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    };

    const send = () => {
      const value = text.trim();
      if (!value) return;
      onSend(value);
      setText('');
      stopTyping();
    };

    const canSend = text.trim().length > 0;

    return (
      <View
        style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}
      >
        {replyTo && (
          <Animated.View
            entering={FadeInDown.duration(160)}
            exiting={FadeOutDown.duration(100)}
            style={[styles.replyBar, { backgroundColor: colors.raised }]}
          >
            <View style={[styles.replyAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.replyBody}>
              <Text style={[styles.replyName, { color: colors.primary }]} numberOfLines={1}>
                Replying to {replyTo.userName || 'message'}
              </Text>
              <Text style={[styles.replyText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {previewText(replyTo)}
              </Text>
            </View>
            <PressableScale
              onPress={onCancelReply}
              scaleTo={BUTTON_PRESS_SCALE}
              hitSlop={10}
              accessibilityRole='button'
              accessibilityLabel='Cancel reply'
              style={styles.replyClose}
            >
              <Feather name='x' size={16} color={colors.mutedForeground} />
            </PressableScale>
          </Animated.View>
        )}

        <View style={styles.row}>
          <PressableScale
            onPress={onOpenGifs}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Send a GIF'
            style={[styles.tool, { backgroundColor: colors.raised }]}
          >
            <Text style={[styles.gifLabel, { color: colors.foreground }]}>GIF</Text>
          </PressableScale>
          <PressableScale
            onPress={onOpenSounds}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Play a sound for the room'
            style={[styles.tool, { backgroundColor: colors.raised }]}
          >
            <Ionicons name='volume-high' size={17} color={colors.foreground} />
          </PressableScale>

          <TextInput
            ref={ref}
            value={text}
            onChangeText={handleChange}
            placeholder={replyTo ? 'Write a reply' : 'Message the room'}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.raised, color: colors.foreground }]}
            multiline
            maxLength={500}
            accessibilityLabel='Message'
          />

          <PressableScale
            onPress={send}
            disabled={!canSend}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Send message'
            style={[styles.send, { backgroundColor: canSend ? colors.primary : colors.raised }]}
          >
            <Ionicons
              name='arrow-up'
              size={20}
              color={canSend ? colors.primaryForeground : colors.mutedForeground}
            />
          </PressableScale>
        </View>
      </View>
    );
  })
);

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  replyBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  replyAccent: { width: 3, alignSelf: 'stretch' },
  replyBody: { flex: 1, paddingHorizontal: 10, paddingVertical: 6 },
  replyName: { fontSize: 12, fontWeight: '700' },
  replyText: { fontSize: 12.5 },
  replyClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  tool: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  gifLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
  },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
