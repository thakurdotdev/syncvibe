import React from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { useTheme } from "@/context/ThemeContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { getProfileCloudinaryUrl } from "@/utils/Cloudinary"

const MAX_VISIBLE = 4

export const MemberAvatarStack: React.FC = () => {
  const { colors } = useTheme()
  const members = useGroupSessionStore((s) => s.groupMembers)

  if (!members.length) return null

  const visible = members.slice(0, MAX_VISIBLE)
  const overflow = members.length - MAX_VISIBLE

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        {visible.map((m, i) => (
          <Image
            key={m.userId}
            source={{
              uri: getProfileCloudinaryUrl(m.profilePic) || "https://via.placeholder.com/28",
            }}
            style={[
              styles.avatar,
              { marginLeft: i > 0 ? -8 : 0, borderColor: colors.card, backgroundColor: colors.secondary },
              { zIndex: MAX_VISIBLE - i },
            ]}
          />
        ))}
        {overflow > 0 && (
          <View style={[styles.overflowBadge, { backgroundColor: colors.secondary, borderColor: colors.card }]}>
            <Text style={[styles.overflowText, { color: colors.mutedForeground }]}>
              +{overflow}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.count, { color: colors.mutedForeground }]}>
        {members.length} {members.length === 1 ? "listener" : "listeners"}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  overflowBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  overflowText: {
    fontSize: 9,
    fontWeight: "700",
  },
  count: {
    fontSize: 11,
    fontWeight: "500",
  },
})
