import React, { useMemo } from "react"
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/context/ThemeContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { getProfileCloudinaryUrl } from "@/utils/Cloudinary"

interface ChatPeekProps {
  onOpenChat: () => void
}

export const ChatPeek: React.FC<ChatPeekProps> = ({ onOpenChat }) => {
  const { colors } = useTheme()
  const messages = useGroupSessionStore((s) => s.messages)

  const recentMessages = useMemo(() => {
    const textMessages = messages.filter((m) => m.type !== "activity")
    return textMessages.slice(-2)
  }, [messages])

  return (
    <TouchableOpacity
      onPress={onOpenChat}
      activeOpacity={0.7}
      style={[styles.container, { backgroundColor: colors.secondary }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="message-circle" size={14} color={colors.mutedForeground} />
          <Text style={[styles.title, { color: colors.foreground }]}>Chat</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground + "60"} />
      </View>

      {recentMessages.length > 0 ? (
        <View style={styles.messagesPreview}>
          {recentMessages.map((msg, i) => (
            <View key={msg.id || i} style={styles.messageRow}>
              <Image
                source={{
                  uri:
                    getProfileCloudinaryUrl(msg.profilePic) || "https://via.placeholder.com/20",
                }}
                style={[styles.miniAvatar, { backgroundColor: colors.card }]}
              />
              <Text
                style={[styles.messageAuthor, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {msg.userName}
              </Text>
              <Text
                style={[styles.messageText, { color: colors.foreground + "cc" }]}
                numberOfLines={1}
              >
                {msg.message}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: colors.mutedForeground + "60" }]}>
          No messages yet — tap to start chatting
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  messagesPreview: {
    gap: 4,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  messageAuthor: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 0,
  },
  messageText: {
    fontSize: 12,
    flex: 1,
  },
  emptyText: {
    fontSize: 12,
  },
})
