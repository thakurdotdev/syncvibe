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
  SearchDialog,
  QRCodeDialog,
  WelcomeView,
  QueueSheet,
  InviteSheet,
} from "./GroupMusic/index"

import "./music.css"

const GroupMusic = () => {
  const { user } = useProfile()
  const { canChat, maxGroupMembers } = useFeatureAccess()
  const {
    currentGroup,
    isPlaying,
    currentTime,
    duration,
    groupMembers,
    searchResults,
    searchQuery,
    setSearchQuery,
    currentSong,
    isSearchOpen,
    setIsSearchOpen,
    volume,
    isLoading,
    messages,
    isGroupModalOpen,
    setIsGroupModalOpen,
    isSearchLoading,
    isRejoining,
    formatTime,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    debouncedSearch,
    createGroup,
    joinGroup,
    leaveGroup,
    sendMessage,
    playNow,
    addToQueue,
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
  } = useGroupMusic()

  const [isQrCodeOpen, setQrCodeOpen] = useState(false)
  const [modalDefaultTab, setModalDefaultTab] = useState("join")

  const activeQueueCount = useMemo(
    () => (currentQueueItem ? 1 : 0) + upcomingQueue.length,
    [currentQueueItem, upcomingQueue.length],
  )

  const handleSearchChange = useCallback(
    (query) => {
      setSearchQuery(query)
      debouncedSearch(query)
    },
    [setSearchQuery, debouncedSearch],
  )

  const handleOpenSearch = useCallback(() => setIsSearchOpen(true), [setIsSearchOpen])
  const handleCloseSearch = useCallback(() => setIsSearchOpen(false), [setIsSearchOpen])
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
  const groupMaxMembers = currentGroup?.maxMembers || maxGroupMembers

  return (
    <div className="mx-auto max-w-7xl px-2 md:px-4 py-2 md:py-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-2xl border border-border/30 bg-background overflow-hidden">
          <div className="px-3 md:px-5 pt-3 md:pt-4 pb-2">
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

          <div className="px-3 md:px-5 pb-4">
            <AnimatePresence mode="wait">
              {!currentGroup ? (
                <WelcomeView key="welcome" onOpenModal={handleOpenGroupModal} onClipboardJoin={handleClipboardJoin} />
              ) : (
                <motion.div
                  key="group-content"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 md:space-y-4"
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
                    queueCount={activeQueueCount}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                    <div className="lg:col-span-2">
                      <GroupChat
                        messages={messages}
                        currentUserId={userId}
                        onSendMessage={sendMessage}
                        locked={!canChat}
                      />
                    </div>
                    <div>
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

      {isSearchOpen && (
        <SearchDialog
          isOpen={isSearchOpen}
          onClose={handleCloseSearch}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          searchResults={searchResults}
          isSearchLoading={isSearchLoading}
          onPlayNow={playNow}
          onAddToQueue={addToQueue}
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
