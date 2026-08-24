import React, { useEffect, useRef } from "react"
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import SwipeableModal from "@/components/SwipeableModal"
import { useTheme } from "@/context/ThemeContext"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useGroupInviteStore } from "@/stores/groupMusic/groupInviteStore"
import { getProfileCloudinaryUrl } from "@/utils/Cloudinary"

export const InviteNotification: React.FC = () => {
  const { colors } = useTheme()
  const { acceptInvite, declineInvite } = useGroupMusic()
  const pendingInvite = useGroupInviteStore((s) => s.pendingInvite)
  const insets = useSafeAreaInsets()

  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pendingInvite) {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
      autoDismissRef.current = setTimeout(declineInvite, 30000)
    }

    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [pendingInvite, declineInvite])

  if (!pendingInvite) return null

  const bottomInset = Math.max(insets.bottom, 16)

  return (
    <SwipeableModal
      isVisible={Boolean(pendingInvite)}
      onClose={declineInvite}
      maxHeight="auto"
    >
      <View style={[styles.container, { paddingBottom: bottomInset }]}>
        {/* Profile Avatar with Music Badge */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri:
                  getProfileCloudinaryUrl(pendingInvite.inviterPic) ||
                  "https://via.placeholder.com/64",
              }}
              style={[styles.avatar, { backgroundColor: colors.secondary }]}
            />
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
              <Ionicons name="musical-notes" size={12} color={colors.primaryForeground} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {pendingInvite.inviterName}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            invited you to listen together in{"\n"}
            <Text style={[styles.groupHighlight, { color: colors.foreground }]}>
              {pendingInvite.groupName || "Music Room"}
            </Text>
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={declineInvite}
            style={[styles.declineBtn, { backgroundColor: colors.secondary }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Decline invite"
          >
            <Text style={[styles.declineBtnText, { color: colors.mutedForeground }]}>
              Decline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={acceptInvite}
            style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Join music group"
          >
            <Ionicons name="play" size={15} color={colors.primaryForeground} />
            <Text style={[styles.acceptBtnText, { color: colors.primaryForeground }]}>
              Join Session
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SwipeableModal>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 4,
    alignItems: "center",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
    width: "100%",
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  groupHighlight: {
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  declineBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  acceptBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
})
