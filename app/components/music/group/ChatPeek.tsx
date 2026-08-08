import React, { useMemo } from "react"
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import Card from "@/components/ui/card"
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
    <Card variant="default" style={styles.container}>
      <TouchableOpacity
        onPress={onOpenChat}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open group chat"
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
              <Feather name="message-circle" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>Chat</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
                  style={[styles.miniAvatar, { backgroundColor: colors.secondary }]}
                />
                <Text
                  style={[styles.messageAuthor, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {msg.userName}
                </Text>
                <Text style={[styles.messageText, { color: colors.foreground }]} numberOfLines={1}>
                  {msg.message}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyMessage, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Start the conversation
            </Text>
            <Feather name="arrow-up-right" size={14} color={colors.mutedForeground} />
          </View>
        )}
      </TouchableOpacity>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  messagesPreview: {
    gap: 4,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
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
    fontSize: 13,
    fontWeight: "500",
  },
  emptyMessage: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
})
