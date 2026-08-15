import React from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useTheme } from "@/context/ThemeContext"
import { TimeAgo } from "@/utils/TimeAgo"
import Avatar from "./Avatar"

interface ChatListItemProps {
  user: {
    userid: string | number
    name: string
    profilepic?: string
  }
  lastMessage?: string
  updatedAt?: string
  isOnline?: boolean
  isTyping?: boolean
  isSearchResult?: boolean
  onPress: () => void
}

const ChatListItem: React.FC<ChatListItemProps> = ({
  user,
  lastMessage,
  updatedAt,
  isOnline,
  isTyping,
  isSearchResult,
  onPress,
}) => {
  const { colors } = useTheme()

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.65}
      style={styles.container}
    >
      <Avatar
        name={user.name}
        profilepic={user.profilepic}
        size="md"
        isOnline={isOnline}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {user.name}
          </Text>

          {!isSearchResult && updatedAt ? (
            <Text style={[styles.time, { color: colors.mutedForeground }]}>
              {TimeAgo(updatedAt)}
            </Text>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          {!isSearchResult && isTyping ? (
            <Text
              style={[styles.subtitle, { color: colors.primary, fontWeight: "500" }]}
              numberOfLines={1}
            >
              typing...
            </Text>
          ) : (
            <Text
              style={[styles.subtitle, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {lastMessage || (isSearchResult ? "Tap to start conversation" : "No messages yet")}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
    fontWeight: "400",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
})

export default React.memo(ChatListItem)
