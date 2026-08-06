import React, { useMemo } from "react"
import { FlatList, Image, StyleSheet, Text, View } from "react-native"
import { useTheme } from "@/context/ThemeContext"
import { getProfileCloudinaryUrl } from "@/utils/Cloudinary"

interface Member {
  userId: string | number
  userName: string
  profilePic?: string
}

interface GroupMembersCardProps {
  groupMembers: Member[]
  hostId?: string | number
}

export const GroupMembersCard: React.FC<GroupMembersCardProps> = ({ groupMembers, hostId }) => {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>
            {groupMembers.length}
          </Text>
        </View>
      </View>

      {groupMembers.map((item, index) => {
        const isHost = hostId && item.userId.toString() === hostId.toString()
        const isLast = index === groupMembers.length - 1

        return (
          <View
            key={item.userId.toString()}
            style={[
              styles.memberRow,
              !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border + "30" },
            ]}
          >
            <Image
              source={{
                uri: getProfileCloudinaryUrl(item.profilePic) || "https://via.placeholder.com/40",
              }}
              style={[styles.avatar, { backgroundColor: colors.secondary }]}
            />
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: colors.foreground }]}>{item.userName}</Text>
              {isHost && (
                <View style={[styles.hostBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.hostText, { color: colors.primary }]}>Host</Text>
                </View>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "500",
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hostText: {
    fontSize: 11,
    fontWeight: "600",
  },
})
