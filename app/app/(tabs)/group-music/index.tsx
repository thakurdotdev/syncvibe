import React, { useCallback, useMemo, useState } from "react"
import { Text, TouchableOpacity, View, StyleSheet, Alert, Share, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Feather, Ionicons } from "@expo/vector-icons"
import LoginScreen from "@/components/LoginScreen"
import QRScannerScreen from "@/app/qr-scanner"
import { useGroupMusic } from "@/context/GroupMusicContext"
import { useUser } from "@/context/UserContext"
import { useTheme } from "@/context/ThemeContext"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"
import { useGroupInviteStore } from "@/stores/groupMusic/groupInviteStore"
import { GroupInfoCard } from "@/components/music/group/GroupInfoCard"
import { CurrentSongCard } from "@/components/music/group/CurrentSongCard"
import { GroupMembersCard } from "@/components/music/group/GroupMembersCard"
import { CreateOrJoinModal } from "@/components/music/group/CreateOrJoinModal"
import { SearchModal } from "@/components/music/group/SearchModal"
import { QRCodeModal } from "@/components/music/group/QRCodeModal"
import { QueueSheet } from "@/components/music/group/QueueSheet"
import { InviteSheet } from "@/components/music/group/InviteSheet"
import { InviteNotification } from "@/components/music/group/InviteNotification"
import { ChatScreen } from "@/components/music/group/ChatScreen"
import { ChatPeek } from "@/components/music/group/ChatPeek"
import { FloatingReactions } from "@/components/music/group/FloatingReactions"
import { ConnectionBadge } from "@/components/music/group/ConnectionBadge"

const HeaderActions = React.memo(
  ({
    onOpenQueue,
    onOpenSearch,
    onOpenInvite,
    onLeave,
  }: {
    onOpenQueue: () => void
    onOpenSearch: () => void
    onOpenInvite: () => void
    onLeave: () => void
  }) => {
    const { colors } = useTheme()
    const queue = useGroupSessionStore((s) => s.queue)
    const currentQueueIndex = useGroupSessionStore((s) => s.currentQueueIndex)

    const activeQueueCount = useMemo(() => {
      const currentItem = currentQueueIndex >= 0 && queue[currentQueueIndex] ? 1 : 0
      const upcoming = queue.filter((_, idx) => idx > currentQueueIndex).length
      return currentItem + upcoming
    }, [queue, currentQueueIndex])

    return (
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={onOpenQueue} style={styles.headerIconBtn} activeOpacity={0.6}>
          <Feather name="list" size={20} color={colors.foreground} />
          {activeQueueCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.headerBadgeText, { color: colors.primaryForeground }]}>
                {activeQueueCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenSearch} style={styles.headerIconBtn} activeOpacity={0.6}>
          <Feather name="search" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenInvite} style={styles.headerIconBtn} activeOpacity={0.6}>
          <Feather name="user-plus" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onLeave} style={styles.headerIconBtn} activeOpacity={0.6}>
          <Feather name="log-out" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    )
  },
)

export default function GroupMusicMobile() {
  const { handlePlayPause, handleSeek, createGroup, joinGroup, leaveGroup, skipSong } =
    useGroupMusic()

  const { user } = useUser()
  const { colors } = useTheme()

  const currentGroup = useGroupSessionStore((s) => s.currentGroup)
  const groupMembers = useGroupSessionStore((s) => s.groupMembers)
  const isGroupModalOpen = useGroupSessionStore((s) => s.isGroupModalOpen)
  const isRejoining = useGroupSessionStore((s) => s.isRejoining)
  const isInviteSheetOpen = useGroupInviteStore((s) => s.isInviteSheetOpen)

  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showQRCodeModal, setShowQRCodeModal] = useState(false)
  const [showChatSheet, setShowChatSheet] = useState(false)
  const [scanQrCode, setScanQrCode] = useState(false)

  const handleOpenQueue = useCallback(() => {
    useGroupSessionStore.setState({ isQueueOpen: true })
  }, [])

  const handleOpenSearch = useCallback(() => {
    setShowSearchModal(true)
  }, [])

  const handleCloseSearch = useCallback(() => {
    setShowSearchModal(false)
  }, [])

  const handleCopyGroupId = useCallback(async () => {
    if (currentGroup?.id) {
      await Share.share({
        message: `Join my SyncVibe group! Group ID: ${currentGroup.id}`,
      })
    }
  }, [currentGroup?.id])

  const handleLeaveGroup = useCallback(() => {
    Alert.alert(
      "Leave Group",
      `Are you sure you want to leave ${currentGroup?.name || "this group"}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: leaveGroup },
      ],
    )
  }, [currentGroup?.name, leaveGroup])

  if (!user) return <LoginScreen />

  return (
    <>
      {scanQrCode ? (
        <QRScannerScreen
          onScanComplete={(qrCode) => {
            joinGroup(qrCode)
            setScanQrCode(false)
          }}
          onClose={() => {
            setScanQrCode(false)
            useGroupSessionStore.setState({ isGroupModalOpen: false })
          }}
        />
      ) : (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <SafeAreaView style={styles.header} edges={["top"]}>
            <View style={styles.headerLeft}>
              <Ionicons name="musical-notes-outline" size={22} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Group Music</Text>
              {currentGroup && <ConnectionBadge />}
            </View>
            {currentGroup && (
              <HeaderActions
                onOpenQueue={handleOpenQueue}
                onOpenSearch={handleOpenSearch}
                onOpenInvite={() => useGroupInviteStore.setState({ isInviteSheetOpen: true })}
                onLeave={handleLeaveGroup}
              />
            )}
          </SafeAreaView>

          <InviteNotification />

          {!currentGroup ? (
            <View style={styles.welcomeContainer}>
              <View style={[styles.welcomeIconWrap, { backgroundColor: colors.primary + "12" }]}>
                <Ionicons name="people-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                Sync Your Vibe with Friends
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.mutedForeground }]}>
                Create a group to listen to music together. Invite your friends to join and start
                playing music for everyone in the group.
              </Text>
              <TouchableOpacity
                onPress={() => useGroupSessionStore.setState({ isGroupModalOpen: true })}
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.8}
              >
                <Feather name="plus-circle" size={18} color={colors.primaryForeground} />
                <Text style={[styles.createButtonText, { color: colors.primaryForeground }]}>
                  Create or Join Group
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <GroupInfoCard
                groupName={currentGroup.name}
                groupId={currentGroup.id}
                onCopyId={handleCopyGroupId}
                onShowQRCode={() => setShowQRCodeModal(true)}
              />

              <CurrentSongCard
                onChooseSong={handleOpenSearch}
                onOpenQueue={handleOpenQueue}
                onPlayPause={handlePlayPause}
                onSeek={handleSeek}
                onSkip={skipSong}
              />

              <ChatPeek onOpenChat={() => setShowChatSheet(true)} />

              <GroupMembersCard groupMembers={groupMembers} hostId={currentGroup.createdBy} />

              <FloatingReactions />
            </ScrollView>
          )}

          <CreateOrJoinModal
            isOpen={isGroupModalOpen}
            onClose={() => useGroupSessionStore.setState({ isGroupModalOpen: false })}
            onCreateGroup={createGroup}
            onJoinGroup={joinGroup}
            onScanQRCode={() => setScanQrCode(true)}
          />

          <SearchModal isOpen={showSearchModal} onClose={handleCloseSearch} />

          <QueueSheet onOpenSearch={handleOpenSearch} />

          {currentGroup?.qrCode && (
            <QRCodeModal
              isOpen={showQRCodeModal}
              onClose={() => setShowQRCodeModal(false)}
              qrCode={currentGroup.qrCode}
            />
          )}

          <InviteSheet
            isOpen={isInviteSheetOpen}
            onClose={() => useGroupInviteStore.setState({ isInviteSheetOpen: false })}
          />

          <ChatScreen isOpen={showChatSheet} onClose={() => setShowChatSheet(false)} />
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  welcomeIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 24,
    textAlign: "center",
  },
  welcomeSubtitle: {
    textAlign: "center",
    marginTop: 12,
    marginBottom: 36,
    fontSize: 15,
    lineHeight: 22,
  },
  createButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  createButtonText: {
    fontWeight: "700",
    marginLeft: 8,
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
})
