import React from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import Card from "@/components/ui/card"
import { useTheme } from "@/context/ThemeContext"

interface GroupInfoCardProps {
  groupName: string
  groupId: string
  onCopyId: () => void
  onOpenInvite: () => void
  onShowQRCode: () => void
}

export const GroupInfoCard: React.FC<GroupInfoCardProps> = ({
  groupName,
  groupId,
  onCopyId,
  onOpenInvite,
  onShowQRCode,
}) => {
  const { colors } = useTheme()

  return (
    <Card variant="default" style={styles.container}>
      <View style={styles.roomRow}>
        <View style={[styles.roomIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="headphones" size={18} color={colors.foreground} />
        </View>
        <View style={styles.roomInfo}>
          <Text style={[styles.groupName, { color: colors.foreground }]} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={[styles.roomId, { color: colors.mutedForeground }]} numberOfLines={1}>
            Room · {groupId.substring(0, 8)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onOpenInvite}
          style={[styles.iconAction, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Invite listeners"
        >
          <Feather name="user-plus" size={15} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCopyId}
          style={[styles.iconAction, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share room invite"
        >
          <Feather name="send" size={15} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShowQRCode}
          style={[styles.iconAction, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Show room QR code"
        >
          <Feather name="maximize" size={15} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roomIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roomInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  groupName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  roomId: {
    fontSize: 10,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
})
