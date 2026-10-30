import { useProfile } from '@/Context/Context';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ListMusic } from 'lucide-react';
import '../Music/music.css';
import {
  GlobalSoundAnimation,
  GroupChat,
  GroupHeader,
  GroupModal,
  InviteSheet,
  MembersList,
  NowPlayingCard,
  QRCodeDialog,
  QueueSheet,
  WelcomeView,
} from './index';

const AmbientGlow = memo(({ imageUrl }) => {
  const bgStyle = useMemo(
    () => ({
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(80px) saturate(1.5)',
      transform: 'scale(1.4)',
      willChange: 'transform',
    }),
    [imageUrl]
  );

  if (!imageUrl) return null;
  return (
    <div className='absolute inset-0 overflow-hidden pointer-events-none' aria-hidden='true'>
      <div className='absolute inset-0 opacity-[0.08]' style={bgStyle} />
      <div className='absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background' />
    </div>
  );
});

const GroupMusic = () => {
  const { user } = useProfile();
  const { canChat, maxGroupMembers } = useFeatureAccess();
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
    currentQueueItem,
    upcomingQueue,
    setIsQueueOpen,
    isSyncing,
    syncCountdown,
    isInviteSheetOpen,
    setIsInviteSheetOpen,
    sendInvite,
    sendReaction,
    typingUsers,
    onTypingStart,
    onTypingStop,
    connectionQuality,
    playNow,
    addToQueue,
    clearQueue,
    toggleAutoRecommendations,
    autoPlayRecommendations,
  } = useGroupMusic();

  const [isQrCodeOpen, setQrCodeOpen] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState('join');
  const [inlineQueueEnabled, setInlineQueueEnabled] = useState(() => {
    try { return localStorage.getItem('syncvibe_group_inline_queue') === 'true'; } catch { return false; }
  });
  const [wideViewport, setWideViewport] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1200);

  useEffect(() => {
    const update = () => setWideViewport(window.innerWidth >= 1200);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const inlineQueue = Boolean(currentGroup && inlineQueueEnabled && wideViewport);
  const toggleInlineQueue = useCallback(() => {
    setInlineQueueEnabled((value) => {
      const next = !value;
      try { localStorage.setItem('syncvibe_group_inline_queue', String(next)); } catch {}
      return next;
    });
  }, []);

  const activeQueueCount = useMemo(
    () => (currentQueueItem ? 1 : 0) + upcomingQueue.length,
    [currentQueueItem, upcomingQueue.length]
  );

  const albumArt = useMemo(() => currentSong?.image?.[2]?.link, [currentSong?.image]);

  const handleOpenSearch = useCallback(() => setIsQueueOpen(true), [setIsQueueOpen]);
  const handleOpenQrCode = useCallback(() => setQrCodeOpen(true), []);
  const handleCloseQrCode = useCallback(() => setQrCodeOpen(false), []);
  const handleOpenGroupModal = useCallback(
    (tab = 'join') => {
      setModalDefaultTab(tab);
      setIsGroupModalOpen(true);
    },
    [setIsGroupModalOpen]
  );
  const handleCloseGroupModal = useCallback(
    () => setIsGroupModalOpen(false),
    [setIsGroupModalOpen]
  );
  const handleOpenQueue = useCallback(() => setIsQueueOpen(true), [setIsQueueOpen]);
  const handleOpenInvite = useCallback(() => setIsInviteSheetOpen(true), [setIsInviteSheetOpen]);

  const userId = useMemo(() => user?.userid, [user?.userid]);
  const groupMaxMembers = Math.max(currentGroup?.maxMembers || 0, maxGroupMembers);
  const isChatAllowed = canChat || Boolean(currentGroup?.features?.realtimeChat);

  return (
    <div className='mx-auto max-w-7xl px-2 md:px-4 py-2 md:py-4'>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className='relative rounded-2xl md:rounded-3xl overflow-hidden liquid-panel-elevated'>
          <AmbientGlow imageUrl={albumArt} />

          <div className='relative z-10'>
            <div className='px-3 md:px-6 pt-3 md:pt-4 pb-2'>
              <div className='flex items-center justify-between gap-3'>
              <GroupHeader
                currentGroup={currentGroup}
                isRejoining={isRejoining}
                onSearchOpen={handleOpenSearch}
                onQRCodeOpen={handleOpenQrCode}
                onLeaveGroup={leaveGroup}
                onQueueOpen={handleOpenQueue}
                onInviteOpen={handleOpenInvite}
                queueCount={activeQueueCount}
                connectionQuality={connectionQuality}
                inlineQueue={inlineQueue}
              />
              {currentGroup && (
                <button type='button' onClick={toggleInlineQueue} aria-pressed={inlineQueueEnabled} aria-label={inlineQueueEnabled ? 'Hide inline queue' : 'Show inline queue'} title={inlineQueueEnabled ? 'Hide inline queue' : 'Show inline queue'} className='shrink-0 h-9 w-9 rounded-xl liquid-btn flex items-center justify-center text-muted-foreground hover:text-foreground'>
                  <ListMusic className='h-4 w-4' />
                </button>
              )}
              </div>
            </div>

            <div className='px-3 md:px-6 pb-5 md:pb-6'>
              <AnimatePresence mode='popLayout'>
                {isRejoining && !currentGroup ? (
                  <motion.div
                    key='rejoining'
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className='flex flex-col items-center justify-center py-24 gap-5'
                  >
                    <div className='relative'>
                      <div className='h-14 w-14 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin' />
                      <div className='absolute inset-0 flex items-center justify-center'>
                        <div className='h-6 w-6 rounded-full bg-primary/10 animate-pulse' />
                      </div>
                    </div>
                    <div className='text-center space-y-1.5'>
                      <p className='text-sm font-semibold text-foreground'>
                        Reconnecting to your session
                      </p>
                      <p className='text-xs text-muted-foreground/60'>Syncing playback state...</p>
                    </div>
                  </motion.div>
                ) : !currentGroup ? (
                  <WelcomeView key='welcome' onOpenModal={handleOpenGroupModal} />
                ) : (
                  <motion.div
                    key='group-content'
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={inlineQueue ? 'grid grid-cols-[minmax(0,60fr)_minmax(340px,40fr)] gap-5 items-stretch' : 'space-y-4 md:space-y-5'}
                  >
                    <div className={inlineQueue ? 'min-w-0 space-y-4' : undefined}>
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
                      onPlayNow={playNow}
                      onAddToQueue={addToQueue}
                      onToggleAutoRecommendations={toggleAutoRecommendations}
                      autoPlayRecommendations={autoPlayRecommendations}
                      onRestartSong={() => handleSeek([0])}
                      inlineQueue={inlineQueue}
                    />

                    <div className={inlineQueue ? 'min-w-0 w-full' : 'flex flex-col lg:flex-row gap-4'}>
                      <div className={inlineQueue ? 'w-full min-w-0' : 'flex-1 min-w-0'}>
                        <GroupChat
                          messages={messages}
                          currentUserId={userId}
                          onSendMessage={sendMessage}
                          locked={!isChatAllowed}
                          typingUsers={typingUsers}
                          onTypingStart={onTypingStart}
                          onTypingStop={onTypingStop}
                        />
                      </div>
                      {!inlineQueue && <div className='w-full lg:w-[280px] lg:shrink-0 lg:max-h-[380px]'>
                        <MembersList
                          members={groupMembers}
                          currentUserId={userId}
                          createdBy={currentGroup?.createdBy}
                          maxMembers={groupMaxMembers}
                        />
                      </div>}
                    </div>
                    </div>
                    {inlineQueue && <div className='min-w-0 flex flex-col max-h-[calc(100vh-200px)] overflow-hidden'><QueueSheet inline /></div>}
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

      {!inlineQueue && <QueueSheet />}

      <InviteSheet
        isOpen={isInviteSheetOpen}
        onClose={setIsInviteSheetOpen}
        groupMembers={groupMembers}
        sendInvite={sendInvite}
      />

      <GlobalSoundAnimation currentUserId={userId} />
    </div>
  );
};

export default memo(GroupMusic);
