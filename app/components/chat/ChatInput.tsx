import React from "react"
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/context/ThemeContext"

interface ChatInputProps {
  message: string
  onChangeText: (text: string) => void
  onSend: () => void
  onAttach: () => void
  filePreview: string | null
  onRemoveAttachment: () => void
  editMode?: boolean
  editText?: string
  onEditTextChange?: (text: string) => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
}

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
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const bottomPadding = Platform.OS === "ios" ? Math.max(insets.bottom, 6) : 6

  if (editMode) {
    const canSave = Boolean(editText?.trim())

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingBottom: bottomPadding,
          },
        ]}
      >
        <View style={[styles.editBanner, { backgroundColor: colors.card }]}>
          <View style={styles.editLabelRow}>
            <Ionicons name="pencil" size={14} color={colors.primary} />
            <Text style={[styles.editLabel, { color: colors.primary }]}>
              Editing message
            </Text>
          </View>
          <Pressable onPress={onCancelEdit} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputPill, { backgroundColor: colors.card }]}>
            <TextInput
              value={editText}
              onChangeText={onEditTextChange}
              placeholder="Edit message..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={500}
              style={[styles.textInput, { color: colors.foreground }]}
            />
          </View>

          <Pressable
            style={[
              styles.sendCircle,
              {
                backgroundColor: colors.primary,
                opacity: canSave ? 1 : 0.45,
              },
            ]}
            onPress={onSaveEdit}
            disabled={!canSave}
          >
            <Ionicons
              name="checkmark"
              size={22}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
      </View>
    )
  }

  const canSend = Boolean(message.trim() || filePreview)

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {filePreview && (
        <View style={styles.previewWrapper}>
          <Image source={{ uri: filePreview }} style={styles.previewImage} />
          <Pressable
            style={[styles.removeButton, { backgroundColor: "rgba(0,0,0,0.6)" }]}
            onPress={onRemoveAttachment}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      <View style={styles.inputRow}>
        <View style={[styles.inputPill, { backgroundColor: colors.card }]}>
          <Pressable style={styles.pillIconBtn} onPress={onAttach} hitSlop={6}>
            <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
          </Pressable>

          <TextInput
            value={message}
            onChangeText={onChangeText}
            placeholder="Message"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            style={[styles.textInput, { color: colors.foreground }]}
          />
        </View>

        <Pressable
          style={[
            styles.sendCircle,
            {
              backgroundColor: colors.primary,
              opacity: canSend ? 1 : 0.45,
            },
          ]}
          onPress={onSend}
          disabled={!canSend}
        >
          <Ionicons
            name="send"
            size={18}
            color={colors.primaryForeground}
            style={{ marginLeft: 2 }}
          />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    paddingHorizontal: 8,
    minHeight: 48,
  },
  pillIconBtn: {
    height: 48,
    width: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 120,
    minHeight: 48,
  },
  sendCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  previewWrapper: {
    marginBottom: 8,
    position: "relative",
    width: 72,
    marginLeft: 8,
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  editBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
})

export default React.memo(ChatInput)
