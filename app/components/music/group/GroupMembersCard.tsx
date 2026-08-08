import React from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import Card from "@/components/ui/card"
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
    <Card variant="default" style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={[styles.headerIcon, { backgroundColor: colors.accent }]}>
          <Feather name="users" size={16} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Listeners</Text>
        </View>
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
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
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
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
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
    paddingVertical: 11,
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
    fontWeight: "600",
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
  },
  hostText: {
    fontSize: 11,
    fontWeight: "600",
  },
})
