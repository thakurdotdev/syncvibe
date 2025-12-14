import { useState, useCallback, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useProfile } from '@/Context/Context';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Import modular components
import {
  GroupModal,
  NowPlayingCard,
  GroupChat,
  MembersList,
  GroupHeader,
  SearchDialog,
  QRCodeDialog,
  WelcomeView,
} from './GroupMusic/index';

import './music.css';

const GroupMusic = () => {
  const { user } = useProfile();
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
    selectSong,
    debouncedSearch,
    createGroup,
    joinGroup,
    leaveGroup,
    sendMessage,
  } = useGroupMusic();

  const [isQrCodeOpen, setQrCodeOpen] = useState(false);

  // Memoize callbacks to prevent unnecessary rerenders
  const handleSearchChange = useCallback(
    (query) => {
      setSearchQuery(query);
      debouncedSearch(query);
    },
    [setSearchQuery, debouncedSearch]
  );

  const handleOpenSearch = useCallback(() => setIsSearchOpen(true), [setIsSearchOpen]);
  const handleCloseSearch = useCallback(() => setIsSearchOpen(false), [setIsSearchOpen]);
  const handleOpenQrCode = useCallback(() => setQrCodeOpen(true), []);
  const handleCloseQrCode = useCallback(() => setQrCodeOpen(false), []);
  const handleOpenGroupModal = useCallback(() => setIsGroupModalOpen(true), [setIsGroupModalOpen]);
  const handleCloseGroupModal = useCallback(
    () => setIsGroupModalOpen(false),
    [setIsGroupModalOpen]
  );

  // Memoize user id
  const userId = useMemo(() => user?.userid, [user?.userid]);

  return (
    <div className='mx-auto max-w-7xl px-2 md:px-4 py-2 md:py-6'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card
          className={cn(
            'overflow-hidden border-border/50',
            'bg-gradient-to-br from-background via-background to-accent/10',
            'shadow-xl'
          )}
        >
          <CardHeader className='px-3 md:px-6 py-2 md:pb-2'>
            <GroupHeader
              currentGroup={currentGroup}
              isRejoining={isRejoining}
              onSearchOpen={handleOpenSearch}
              onQRCodeOpen={handleOpenQrCode}
              onLeaveGroup={leaveGroup}
            />
          </CardHeader>

          <CardContent className='px-2 md:px-6 pb-4'>
            <AnimatePresence mode='wait'>
              {!currentGroup ? (
                <WelcomeView key='welcome' onOpenModal={handleOpenGroupModal} />
              ) : (
                <motion.div
                  key='group-content'
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className='space-y-3 md:space-y-6'
                >
                  {/* Now Playing */}
                  <NowPlayingCard
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isLoading={isLoading}
                    currentTime={currentTime}
                    duration={duration}
                    volume={volume}
                    formatTime={formatTime}
                    onPlayPause={handlePlayPause}
                    onSeek={handleSeek}
                    onVolumeChange={handleVolumeChange}
                    onSearchOpen={handleOpenSearch}
                  />

                  {/* Chat & Members Grid */}
                  <div className='grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6'>
                    <div className='lg:col-span-2'>
                      <GroupChat
                        messages={messages}
                        currentUserId={userId}
                        onSendMessage={sendMessage}
                      />
                    </div>
                    <div>
                      <MembersList
                        members={groupMembers}
                        currentUserId={userId}
                        createdBy={currentGroup?.createdBy}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Modals - Only render when needed */}
      {isGroupModalOpen && (
        <GroupModal
          isOpen={isGroupModalOpen}
          onClose={handleCloseGroupModal}
          onCreateGroup={createGroup}
          onJoinGroup={joinGroup}
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
          onSelectSong={selectSong}
        />
      )}

      {isQrCodeOpen && (
        <QRCodeDialog isOpen={isQrCodeOpen} onClose={handleCloseQrCode} group={currentGroup} />
      )}
    </div>
  );
};

export default memo(GroupMusic);
