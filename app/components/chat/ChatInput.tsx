import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatInputProps {
  message: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach: () => void;
  filePreview: string | null;
  onRemoveAttachment: () => void;
  editMode?: boolean;
  editText?: string;
  onEditTextChange?: (text: string) => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}

/** Lets the options sheet finish closing: its window takes the keyboard's focus until it's gone. */
const FOCUS_AFTER_SHEET_MS = 240;

/**
 * One input for writing and editing, so the keyboard never drops when switching between them.
 */
const ChatInput: React.FC<ChatInputProps> = ({
  message,
  onChangeText,
  onSend,
  onAttach,
  filePreview,
  onRemoveAttachment,
  editMode,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editMode) return;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_AFTER_SHEET_MS);
    return () => clearTimeout(timer);
  }, [editMode]);

  const canSubmit = editMode ? Boolean(editText?.trim()) : Boolean(message.trim() || filePreview);
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
          value={editMode ? editText : message}
          onChangeText={editMode ? onEditTextChange : onChangeText}
          placeholder='Message'
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={500}
          textAlignVertical='center'
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.raised }]}
        />

        <PressableScale
          onPress={editMode ? onSaveEdit : onSend}
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
