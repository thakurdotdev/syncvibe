import React from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/context/ThemeContext"

interface GroupInfoCardProps {
  groupName: string
  groupId: string
  onCopyId: () => void
  onShowQRCode: () => void
}

export const GroupInfoCard: React.FC<GroupInfoCardProps> = ({
  groupName,
  groupId,
  onCopyId,
  onShowQRCode,
}) => {
  const { colors } = useTheme()

  return (
    <View style={[styles.container, { borderBottomColor: colors.border + "30" }]}>
      <Text style={[styles.groupName, { color: colors.foreground }]} numberOfLines={1}>
        {groupName}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={onCopyId}
          style={[styles.chip, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, { color: colors.mutedForeground }]} numberOfLines={1}>
            ID: {groupId.substring(0, 8)}...
          </Text>
          <Feather name="copy" size={12} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShowQRCode}
          style={[styles.chip, { backgroundColor: colors.secondary }]}
          activeOpacity={0.7}
        >
          <Feather name="grid" size={12} color={colors.mutedForeground} />
          <Text style={[styles.chipText, { color: colors.mutedForeground }]}>QR</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
  },
})
