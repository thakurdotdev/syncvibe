import React, { useEffect, useRef } from "react"
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated"
import { Feather } from "@expo/vector-icons"
import { useTheme } from "@/context/ThemeContext"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useGroupInviteStore } from "@/stores/groupMusic/groupInviteStore"
import { getProfileCloudinaryUrl } from "@/utils/Cloudinary"

export const InviteNotification: React.FC = () => {
  const { colors } = useTheme()
  const { acceptInvite, declineInvite } = useGroupMusic()
  const pendingInvite = useGroupInviteStore((s) => s.pendingInvite)

  const translateY = useSharedValue(-120)
  const opacity = useSharedValue(0)
  const autoDismissRef = useRef<any>(null)

  useEffect(() => {
    if (pendingInvite) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 })
      opacity.value = withTiming(1, { duration: 200 })

      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      autoDismissRef.current = setTimeout(() => {
        dismiss()
      }, 15000)
    } else {
      dismiss()
    }

    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [pendingInvite])

  const dismiss = () => {
    translateY.value = withTiming(-120, { duration: 250 })
    opacity.value = withTiming(0, { duration: 200 })
  }

  const handleAccept = () => {
    dismiss()
    setTimeout(acceptInvite, 300)
  }

  const handleDecline = () => {
    dismiss()
    setTimeout(declineInvite, 300)
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (!pendingInvite) return null

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.content}>
          <Image
            source={{
              uri:
                getProfileCloudinaryUrl(pendingInvite.inviterPic) ||
                "https://via.placeholder.com/40",
            }}
            style={[styles.avatar, { backgroundColor: colors.secondary }]}
          />
          <View style={styles.textContent}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {pendingInvite.inviterName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              Invited you to {pendingInvite.groupName || "a group"}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleDecline}
            style={[styles.declineButton, { borderColor: colors.border }]}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleAccept}
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.acceptText, { color: colors.primaryForeground }]}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  textContent: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  declineButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  acceptText: {
    fontSize: 13,
    fontWeight: "700",
  },
})
