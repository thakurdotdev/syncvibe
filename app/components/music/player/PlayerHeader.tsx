import Button from "@/components/ui/button"
import { useTheme } from "@/context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { memo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"

export type TabType = "player" | "queue"

interface PlayerHeaderProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  onClose: () => void
  onOptionsPress: () => void
  queueCount: number
}

export const PlayerHeader = memo(function PlayerHeader({
  activeTab,
  onTabChange,
  onClose,
  onOptionsPress,
  queueCount,
}: PlayerHeaderProps) {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.dragHandleRow}>
        <View style={[styles.dragHandle, { backgroundColor: colors.mutedForeground + "40" }]} />
      </View>

      <View style={styles.header}>
        <Button onPress={onClose} variant="ghost" size="icon">
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </Button>

        <View style={styles.headerTabs}>
          <Pressable
            onPress={() => onTabChange("player")}
            style={[
              styles.headerTab,
              activeTab === "player" && {
                backgroundColor: colors.card + "80",
                borderColor: colors.border + "40",
              },
            ]}
          >
            <Text
              style={[
                styles.headerTabText,
                {
                  color: activeTab === "player" ? colors.text : colors.mutedForeground,
                  fontWeight: activeTab === "player" ? "700" : "500",
                },
              ]}
            >
              Playing
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onTabChange("queue")}
            style={[
              styles.headerTab,
              activeTab === "queue" && {
                backgroundColor: colors.card + "80",
                borderColor: colors.border + "40",
              },
            ]}
          >
            <Text
              style={[
                styles.headerTabText,
                {
                  color: activeTab === "queue" ? colors.text : colors.mutedForeground,
                  fontWeight: activeTab === "queue" ? "700" : "500",
                },
              ]}
            >
              Queue
            </Text>
            {queueCount > 0 && (
              <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.headerBadgeText, { color: colors.primaryForeground }]}>
                  {queueCount > 99 ? "99+" : queueCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <Button variant="ghost" size="icon" onPress={onOptionsPress}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Button>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  dragHandleRow: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerTabs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  headerTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  headerTabText: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  headerBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
})
