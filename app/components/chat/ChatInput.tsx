import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { MAX_MESSAGE_LENGTH } from '@/lib/chat';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatInputProps {
  /** Called with what was typed. The box clears itself. */
  onSend: (text: string) => void;
  /** Whether there is text in the box, for the "typing…" the other person sees. */
  onTyping: (hasText: boolean) => void;
  onAttach: () => void;
  filePreview: string | null;
  onRemoveAttachment: () => void;
  /** Who and what is being replied to, shown above the input until sent or cancelled. */
  replyingTo?: { name: string; text: string } | null;
  onCancelReply?: () => void;
  /** The message being edited. Its text fills the box until saved or cancelled. */
  editing?: { key: string; body: string; hasPhoto: boolean } | null;
  onSaveEdit?: (text: string) => void;
  onCancelEdit?: () => void;
}

/** Lets the options sheet finish closing: its window takes the keyboard's focus until it's gone. */
const FOCUS_AFTER_SHEET_MS = 240;

/**
 * One input for writing and editing, so the keyboard never drops when switching between them.
 * It keeps its own text: a key press redraws this bar and nothing else on the screen.
 */
const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onTyping,
  onAttach,
  filePreview,
  onRemoveAttachment,
  replyingTo,
  onCancelReply,
  editing,
  onSaveEdit,
  onCancelEdit,
}) => {
  const [draft, setDraft] = useState('');
  const [editText, setEditText] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Editing borrows the box; what was being written is still there afterwards.
  if ((editing?.key ?? null) !== editingKey) {
    setEditingKey(editing?.key ?? null);
    setEditText(editing?.body ?? '');
  }
  const editMode = Boolean(editing);
  const text = editMode ? editText : draft;

  const handleChange = (value: string) => {
    if (editMode) {
      setEditText(value);
      return;
    }
    setDraft(value);
    onTyping(value.trim().length > 0);
  };

  const handleSubmit = () => {
    if (editMode) {
      onSaveEdit?.(editText);
      return;
    }
    onSend(draft);
    setDraft('');
  };

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editMode) return;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_AFTER_SHEET_MS);
    return () => clearTimeout(timer);
  }, [editMode]);

  const canSubmit = editMode
    ? Boolean(editText.trim() || editing?.hasPhoto)
    : Boolean(draft.trim() || filePreview);
  // The keyboard covers the navigation bar, so only clear the bar when it's showing.
  const bottom = keyboardVisible ? 8 : Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: bottom }]}>
      {editMode ? (
        <View style={styles.banner}>
          <Ionicons name='pencil' size={14} color={colors.mutedForeground} />
          <Text style={[styles.bannerText, { color: colors.mutedForeground }]}>
            Editing message
          </Text>
          <PressableScale
            onPress={onCancelEdit}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel='Cancel editing'
          >
            <Ionicons name='close' size={18} color={colors.foreground} />
          </PressableScale>
        </View>
      ) : null}

      {replyingTo && !editMode ? (
        <View style={styles.banner}>
          <Ionicons name='arrow-undo' size={14} color={colors.mutedForeground} />
          <View style={styles.bannerBody}>
            <Text style={[styles.replyTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              Replying to {replyingTo.name}
            </Text>
            <Text style={[styles.bannerQuote, { color: colors.foreground }]} numberOfLines={1}>
              {replyingTo.text}
            </Text>
          </View>
          <PressableScale
            onPress={onCancelReply}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel='Cancel reply'
          >
            <Ionicons name='close' size={18} color={colors.foreground} />
          </PressableScale>
        </View>
      ) : null}

      {filePreview && !editMode ? (
        <View style={styles.preview}>
          <Image source={{ uri: filePreview }} style={styles.previewImage} fadeDuration={0} />
          <PressableScale
            onPress={onRemoveAttachment}
            scaleTo={BUTTON_PRESS_SCALE}
            hitSlop={12}
            accessibilityRole='button'
            accessibilityLabel='Remove photo'
            style={styles.removePhoto}
          >
            <Ionicons name='close' size={14} color='#fff' />
          </PressableScale>
        </View>
      ) : null}

      <View style={styles.row}>
        {editMode ? null : (
          <PressableScale
            onPress={onAttach}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Add a photo'
            style={styles.sideButton}
          >
            <Ionicons name='image-outline' size={24} color={colors.foreground} />
          </PressableScale>
        )}

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleChange}
          placeholder='Message'
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          textAlignVertical='center'
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.raised }]}
        />

        <PressableScale
          onPress={handleSubmit}
          disabled={!canSubmit}
          scaleTo={BUTTON_PRESS_SCALE}
          accessibilityRole='button'
          accessibilityLabel={editMode ? 'Save changes' : 'Send message'}
          accessibilityState={{ disabled: !canSubmit }}
          style={[
            styles.sideButton,
            styles.send,
            { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.35 },
          ]}
        >
          <Ionicons
            name={editMode ? 'checkmark' : 'arrow-up'}
            size={21}
            color={colors.primaryForeground}
          />
        </PressableScale>
      </View>
    </View>
  );
};

const CONTROL = 42;

const styles = StyleSheet.create({
  container: { paddingHorizontal: 10, paddingTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  sideButton: {
    width: CONTROL,
    height: CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: { borderRadius: CONTROL / 2 },
  input: {
    flex: 1,
    minHeight: CONTROL,
    maxHeight: 120,
    borderRadius: CONTROL / 2,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  bannerBody: { flex: 1 },
  replyTitle: { fontSize: 13, fontWeight: '600' },
  bannerQuote: { fontSize: 13, marginTop: 1 },
  preview: { alignSelf: 'flex-start', marginLeft: 48, marginBottom: 8 },
  previewImage: { width: 72, height: 72, borderRadius: 12 },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});

export default React.memo(ChatInput);
