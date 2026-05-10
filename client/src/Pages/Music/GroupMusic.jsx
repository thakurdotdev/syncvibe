import { useState, useCallback, useMemo, memo } from "react"
import { useProfile } from "@/Context/Context"
import { useGroupMusic } from "@/Context/GroupMusicContext"
import { useFeatureAccess } from "@/hooks/useFeatureAccess"
import { AnimatePresence, motion } from "framer-motion"

import {
  GroupModal,
  NowPlayingCard,
  GroupChat,
  MembersList,
  GroupHeader,
  QRCodeDialog,
  WelcomeView,
  QueueSheet,
  InviteSheet,
} from "./GroupMusic/index"

import "./music.css"

const AmbientGlow = memo(({ imageUrl }) => {
  if (!imageUrl) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <img
        src={imageUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-150 blur-[80px] opacity-[0.12]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
    </div>
  )
})

const GroupMusic = () => {
  const { user } = useProfile()
  const { isPro, canChat, maxGroupMembers } = useFeatureAccess()
  const {
    currentGroup,
    isPlaying,
    currentTime,
    duration,
    groupMembers,
    currentSong,
    volume,
    isLoading,
    messages,
    isGroupModalOpen,
    setIsGroupModalOpen,
    isRejoining,
    formatTime,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    createGroup,
    joinGroup,
    leaveGroup,
    sendMessage,
    skipSong,
    queue,
    currentQueueItem,
    upcomingQueue,
    isQueueOpen,
    setIsQueueOpen,
    isSyncing,
    syncCountdown,
    isInviteSheetOpen,
    setIsInviteSheetOpen,
    sendInvite,
    sendReaction,
  } = useGroupMusic()

  const [isQrCodeOpen, setQrCodeOpen] = useState(false)
  const [modalDefaultTab, setModalDefaultTab] = useState("join")

  const activeQueueCount = useMemo(
    () => (currentQueueItem ? 1 : 0) + upcomingQueue.length,
    [currentQueueItem, upcomingQueue.length],
  )

  const albumArt = useMemo(
    () => currentSong?.image?.[2]?.link,
    [currentSong?.image],
  )

  const handleOpenSearch = useCallback(() => setIsQueueOpen(true), [setIsQueueOpen])
  const handleOpenQrCode = useCallback(() => setQrCodeOpen(true), [])
  const handleCloseQrCode = useCallback(() => setQrCodeOpen(false), [])
  const handleOpenGroupModal = useCallback((tab = "join") => {
    setModalDefaultTab(tab)
    setIsGroupModalOpen(true)
  }, [setIsGroupModalOpen])
  const handleCloseGroupModal = useCallback(() => setIsGroupModalOpen(false), [setIsGroupModalOpen])
  const handleClipboardJoin = useCallback((code) => {
    joinGroup(code)
  }, [joinGroup])
  const handleOpenQueue = useCallback(() => setIsQueueOpen(true), [setIsQueueOpen])
  const handleOpenInvite = useCallback(() => setIsInviteSheetOpen(true), [setIsInviteSheetOpen])

  const userId = useMemo(() => user?.userid, [user?.userid])
  const groupMaxMembers = Math.max(currentGroup?.maxMembers || 0, maxGroupMembers)

  return (
    <div className="mx-auto max-w-7xl px-2 md:px-4 py-2 md:py-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="relative rounded-2xl border border-border/30 bg-background overflow-hidden">
          <AmbientGlow imageUrl={albumArt} />

          <div className="relative z-10">
            <div className="px-3 md:px-6 pt-3 md:pt-4 pb-2">
              <GroupHeader
                currentGroup={currentGroup}
                isRejoining={isRejoining}
                onSearchOpen={handleOpenSearch}
                onQRCodeOpen={handleOpenQrCode}
                onLeaveGroup={leaveGroup}
                onQueueOpen={handleOpenQueue}
                onInviteOpen={handleOpenInvite}
                queueCount={activeQueueCount}
              />
            </div>

            <div className="px-3 md:px-6 pb-5 md:pb-6">
              <AnimatePresence mode="wait">
                {isRejoining && !currentGroup ? (
                  <motion.div
                    key="rejoining"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center py-24 gap-5"
                  >
                    <div className="relative">
                      <div className="h-14 w-14 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-primary/10 animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Reconnecting to your session</p>
                      <p className="text-xs text-muted-foreground">Syncing playback state...</p>
                    </div>
                  </motion.div>
                ) : !currentGroup ? (
                  <WelcomeView key="welcome" onOpenModal={handleOpenGroupModal} onClipboardJoin={handleClipboardJoin} />
                ) : (
                  <motion.div
                    key="group-content"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 md:space-y-5"
                  >
                    <NowPlayingCard
                      currentSong={currentSong}
                      isPlaying={isPlaying}
                      isLoading={isLoading}
                      isSyncing={isSyncing}
                      syncCountdown={syncCountdown}
                      currentTime={currentTime}
                      duration={duration}
                      volume={volume}
                      formatTime={formatTime}
                      onPlayPause={handlePlayPause}
                      onSeek={handleSeek}
                      onVolumeChange={handleVolumeChange}
                      onSearchOpen={handleOpenSearch}
                      onQueueOpen={handleOpenQueue}
                      onSkip={skipSong}
                      currentQueueItem={currentQueueItem}
                      upcomingQueue={upcomingQueue}
                      queueCount={activeQueueCount}
                      groupMembers={groupMembers}
                      sendReaction={sendReaction}
                    />

                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1 min-w-0">
                        <GroupChat
                          messages={messages}
                          currentUserId={userId}
                          onSendMessage={sendMessage}
                          locked={!canChat}
                        />
                      </div>
                      <div className="w-full md:w-[260px] md:shrink-0 md:max-h-[340px]">
                        <MembersList
                          members={groupMembers}
                          currentUserId={userId}
                          createdBy={currentGroup?.createdBy}
                          maxMembers={groupMaxMembers}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {isGroupModalOpen && (
        <GroupModal
          isOpen={isGroupModalOpen}
          onClose={handleCloseGroupModal}
          onCreateGroup={createGroup}
          onJoinGroup={joinGroup}
          defaultTab={modalDefaultTab}
        />
      )}

      {isQrCodeOpen && (
        <QRCodeDialog isOpen={isQrCodeOpen} onClose={handleCloseQrCode} group={currentGroup} />
      )}

      <QueueSheet />

      <InviteSheet
        isOpen={isInviteSheetOpen}
        onClose={setIsInviteSheetOpen}
        groupMembers={groupMembers}
        sendInvite={sendInvite}
      />
    </div>
  )
}

export default memo(GroupMusic)
