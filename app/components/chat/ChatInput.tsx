import PressableScale from '@/components/ui/PressableScale';
import { useTheme } from '@/context/ThemeContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { fileIcon, formatBytes, formatDuration } from '@/lib/attachments';
import { MAX_MESSAGE_LENGTH, type PickedFile } from '@/lib/chat';
import { draftOf, useChatDraftStore } from '@/stores/chatDraftStore';
import { useVoiceNote } from './useVoiceNote';
import { BUTTON_PRESS_SCALE } from '@/lib/motion';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CachedImage } from '@/components/ui/CachedImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatInputProps {
  /** Whose unsent text the box shows and keeps. */
  conversationId: number | null;
  /** Called with what was typed. The box clears itself. */
  onSend: (text: string) => void;
  /** Whether there is text in the box, for the "typing…" the other person sees. */
  onTyping: (hasText: boolean) => void;
  onAttach: () => void;
  onOpenGifs: () => void;
  /** A voice message was recorded: sent like a picked file. */
  onSendVoice: (file: PickedFile) => void;
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
          <CachedImage source={{ uri: file.uri }} style={styles.stagedImage} />
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
  conversationId,
  onSend,
  onTyping,
  onAttach,
  onOpenGifs,
  onSendVoice,
  files,
  onRemoveFile,
  replyingTo,
  onCancelReply,
  editing,
  onSaveEdit,
  onCancelEdit,
}) => {
  // What was being written in this chat comes back, here or after the app was closed.
  const [draft, setDraft] = useState(() => draftOf(conversationId));
  const [draftFor, setDraftFor] = useState(conversationId);
  if (draftFor !== conversationId) {
    setDraftFor(conversationId);
    setDraft(draftOf(conversationId));
  }
  // Opened straight after launch, the saved drafts may still be loading from the phone.
  useEffect(() => {
    if (useChatDraftStore.persist.hasHydrated()) return undefined;
    return useChatDraftStore.persist.onFinishHydration(() =>
      setDraft((current) => current || draftOf(conversationId))
    );
  }, [conversationId]);
  const keepDraft = (value: string) => {
    setDraft(value);
    if (conversationId != null) useChatDraftStore.getState().setDraft(conversationId, value);
  };
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
    keepDraft(value);
    onTyping(value.trim().length > 0);
  };

  const handleSubmit = () => {
    if (editMode) {
      onSaveEdit?.(editText);
      return;
    }
    onSend(draft);
    keepDraft('');
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
  // A GIF goes on its own, so the button steps aside once there is something else to send.
  const showGif = !editMode && !draft.trim() && files.length === 0;
  // With nothing written, the send button records a voice message instead.
  const voice = useVoiceNote(onSendVoice);
  const showMic = showGif && !voice.recording;
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

      {voice.recording ? (
        <View style={styles.row}>
          <PressableScale
            onPress={voice.cancel}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Delete recording'
            style={styles.sideButton}
          >
            <Ionicons name='trash-outline' size={23} color={colors.destructive} />
          </PressableScale>
          <View
            style={[styles.field, styles.recordingField, { backgroundColor: colors.raised }]}
            accessibilityLabel='Recording a voice message'
          >
            <View style={[styles.recordingDot, { backgroundColor: colors.destructive }]} />
            <Text style={[styles.recordingTime, { color: colors.foreground }]}>
              {formatDuration(voice.durationMs / 1000)}
            </Text>
            <Text style={[styles.recordingHint, { color: colors.mutedForeground }]}>
              Recording…
            </Text>
          </View>
          <PressableScale
            onPress={voice.send}
            scaleTo={BUTTON_PRESS_SCALE}
            accessibilityRole='button'
            accessibilityLabel='Send voice message'
            style={[styles.sideButton, styles.send, { backgroundColor: colors.primary }]}
          >
            <Ionicons name='arrow-up' size={21} color={colors.primaryForeground} />
          </PressableScale>
        </View>
      ) : (
        <View style={styles.row}>
          {editMode ? null : (
            <PressableScale
              onPress={onAttach}
              scaleTo={BUTTON_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityLabel='Attach photos, files or a song'
              style={styles.sideButton}
            >
              <Ionicons name='add-circle-outline' size={26} color={colors.foreground} />
            </PressableScale>
          )}

          <View style={[styles.field, { backgroundColor: colors.raised }]}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={handleChange}
              placeholder={files.length && !editMode ? 'Add a message' : 'Message'}
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              textAlignVertical='center'
              style={[
                styles.input,
                { color: colors.foreground },
                showGif ? styles.inputBeforeGif : null,
              ]}
            />
            {showGif ? (
              <PressableScale
                onPress={onOpenGifs}
                scaleTo={BUTTON_PRESS_SCALE}
                hitSlop={4}
                accessibilityRole='button'
                accessibilityLabel='Send a GIF'
                style={styles.gifButton}
              >
                <View style={[styles.gifBadge, { borderColor: colors.mutedForeground }]}>
                  <Text style={[styles.gifLabel, { color: colors.mutedForeground }]}>GIF</Text>
                </View>
              </PressableScale>
            ) : null}
          </View>

          {showMic ? (
            <PressableScale
              onPress={() => void voice.start()}
              scaleTo={BUTTON_PRESS_SCALE}
              accessibilityRole='button'
              accessibilityLabel='Record a voice message'
              style={[styles.sideButton, styles.send, { backgroundColor: colors.primary }]}
            >
              <Ionicons name='mic' size={21} color={colors.primaryForeground} />
            </PressableScale>
          ) : (
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
          )}
        </View>
      )}
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
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: CONTROL / 2,
  },
  input: {
    flex: 1,
    minHeight: CONTROL,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
  },
  inputBeforeGif: { paddingRight: 4 },
  recordingField: {
    minHeight: CONTROL,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  recordingDot: { width: 9, height: 9, borderRadius: 5 },
  recordingTime: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  recordingHint: { fontSize: 14 },
  gifButton: { width: 40, height: CONTROL, alignItems: 'center', justifyContent: 'center' },
  gifBadge: { borderWidth: 1.5, borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1 },
  gifLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
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
