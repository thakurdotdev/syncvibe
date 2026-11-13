import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { fileIcon, formatBytes, formatDuration } from '@/lib/attachments';
import { MAX_MESSAGE_LENGTH, type PickedFile } from '@/lib/chat';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatInputProps {
  /** Called with what was typed. The box clears itself. */
  onSend: (text: string) => void;
  /** Whether there is text in the box, for the "typing…" the other person sees. */
  onTyping: (hasText: boolean) => void;
  onAttach: () => void;
  /** Files picked to send with the next message. */
  files: PickedFile[];
  onRemoveFile: (key: string) => void;
  /** Who and what is being replied to, shown above the input until sent or cancelled. */
  replyingTo?: { name: string; text: string } | null;
  onCancelReply?: () => void;
  /** The message being edited. Its text fills the box until saved or cancelled. */
  editing?: { key: string; body: string; hasAttachment: boolean } | null;
  onSaveEdit?: (text: string) => void;
  onCancelEdit?: () => void;
}

/** A file waiting to be sent: a thumbnail for photos, a small card for anything else. */
const StagedFile = React.memo(
  ({ file, onRemove }: { file: PickedFile; onRemove: (key: string) => void }) => {
    const { colors } = useTheme();
    const remove = (
      <PressableScale
        onPress={() => onRemove(file.key)}
        scaleTo={BUTTON_PRESS_SCALE}
        hitSlop={10}
        accessibilityRole='button'
        accessibilityLabel={`Remove ${file.name}`}
        style={[
          styles.removeFile,
          { backgroundColor: colors.foreground, borderColor: colors.background },
        ]}
      >
        <Ionicons name='close' size={12} color={colors.background} />
      </PressableScale>
    );

    if (file.kind === 'image') {
      return (
        <View style={styles.stagedThumb}>
          <Image source={{ uri: file.uri }} style={styles.stagedImage} fadeDuration={0} />
          {remove}
        </View>
      );
    }

    const video = file.kind === 'video';
    return (
      <View style={[styles.stagedCard, { backgroundColor: colors.raised }]}>
        <MaterialCommunityIcons
          name={(video ? 'play-circle-outline' : fileIcon(file.name, file.kind)) as any}
          size={22}
          color={colors.foreground}
        />
        <View style={styles.stagedText}>
          <Text style={[styles.stagedName, { color: colors.foreground }]} numberOfLines={1}>
            {file.name}
          </Text>
          <Text style={[styles.stagedMeta, { color: colors.mutedForeground }]}>
            {video && file.durationSec
              ? `${formatDuration(file.durationSec)} · ${formatBytes(file.size)}`
              : formatBytes(file.size)}
          </Text>
        </View>
        {remove}
      </View>
    );
  }
);

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
  files,
  onRemoveFile,
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
    ? Boolean(editText.trim() || editing?.hasAttachment)
    : Boolean(draft.trim() || files.length);
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

      {files.length > 0 && !editMode ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={styles.staged}
        >
          {files.map((file) => (
            <StagedFile key={file.key} file={file} onRemove={onRemoveFile} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.row}>
        {editMode ? null : (
          <PressableScale
            onPress={onAttach}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Attach photos, videos or files'
            style={styles.sideButton}
          >
            <Ionicons name='add-circle-outline' size={26} color={colors.foreground} />
          </PressableScale>
        )}

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={handleChange}
          placeholder={files.length && !editMode ? 'Add a message' : 'Message'}
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
  staged: { gap: 10, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 10 },
  stagedThumb: { width: 68, height: 68 },
  stagedImage: { width: 68, height: 68, borderRadius: 12 },
  stagedCard: {
    width: 176,
    height: 68,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  stagedText: { flex: 1, minWidth: 0 },
  stagedName: { fontSize: 13, fontWeight: '600' },
  stagedMeta: { fontSize: 12, marginTop: 2, fontVariant: ['tabular-nums'] },
  removeFile: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(ChatInput);
