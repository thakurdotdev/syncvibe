import { useProfile } from '@/Context/Context';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { memo, useCallback, useEffect, useMemo } from 'react';
import ChatPanel from '../chat/ChatPanel';
import { useUnreadCount } from '../chat/useUnreadCount';
import { useElementWidth } from '../hooks/useElementWidth';
import { useRoomShortcuts } from '../hooks/useRoomShortcuts';
import { MOBILE_TABS, SIDEBAR_TABS, useRoomUi } from '../hooks/useRoomUi';
import PeoplePanel from '../people/PeoplePanel';
import PlayerPanel from '../player/PlayerPanel';
import QueuePanel from '../queue/QueuePanel';
import MobileRoomTabs from './MobileRoomTabs';
import RoomSidebar from './RoomSidebar';
import RoomTopBar from './RoomTopBar';

/**
 * An active listening room. Always exactly fills its container:
 * the page never scrolls, each panel scrolls on its own.
 *
 * Layout is chosen from the room's own width (the app sidebar may be open):
 *  ≥ SPLIT_LAYOUT_MIN_WIDTH  top bar / [player + queue | chat & people rail]
 *  narrower                  top bar / player / [chat | queue | people] tabs
 */
const SPLIT_LAYOUT_MIN_WIDTH = 900;
const FULL_PLAYER_MIN_WIDTH = 600;

const RoomView = ({ onInvite, onShowQrCode }) => {
  const { user } = useProfile();
  const { canChat, maxGroupMembers } = useFeatureAccess();
  const [roomRef, roomWidth] = useElementWidth();
  const isDesktop = roomWidth >= SPLIT_LAYOUT_MIN_WIDTH;
  const {
    currentGroup,
    groupMembers,
    currentSong,
    currentQueueItem,
    upcomingQueue,
    isPlaying,
    isLoading,
    isSyncing,
    syncCountdown,
    currentTime,
    duration,
    volume,
    formatTime,
    handlePlayPause,
    handleSeek,
    handleVolumeChange,
    skipSong,
    sendReaction,
    playNow,
    addToQueue,
    leaveGroup,
    isRejoining,
    connectionQuality,
    syncStatus,
    outputOffsetMs,
    setOutputOffset,
    isHost,
    canControl,
    controlMode,
    setControlMode,
    transferHost,
    messages,
    sendMessage,
    sendMessageReaction,
    typingUsers,
    onTypingStart,
    onTypingStop,
  } = useGroupMusic();

  const mobileTab = useRoomUi((s) => s.mobileTab);
  const sidebarTab = useRoomUi((s) => s.sidebarTab);
  const showPeople = useRoomUi((s) => s.showPeople);
  const requestSearchFocus = useRoomUi((s) => s.requestSearchFocus);
  const requestChatFocus = useRoomUi((s) => s.requestChatFocus);
  const resetRoomUi = useRoomUi((s) => s.reset);

  useEffect(() => resetRoomUi, [resetRoomUi]);

  const userId = user?.userid;
  const isChatVisible = isDesktop
    ? sidebarTab === SIDEBAR_TABS.chat
    : mobileTab === MOBILE_TABS.chat;
  const unreadCount = useUnreadCount(messages, isChatVisible, userId);
  const isChatAllowed = canChat || Boolean(currentGroup?.features?.realtimeChat);
  const maxMembers = Math.max(currentGroup?.maxMembers || 0, maxGroupMembers || 0);

  const playback = useMemo(
    () => ({
      song: currentSong,
      isPlaying,
      isSyncing,
      isBusy: isLoading || isSyncing,
      isLocked: !canControl,
      syncCountdown,
      currentTime,
      duration,
      volume,
      formatTime,
    }),
    [
      currentSong,
      isPlaying,
      isSyncing,
      isLoading,
      canControl,
      syncCountdown,
      currentTime,
      duration,
      volume,
      formatTime,
    ]
  );

  // Handlers are called without arguments on purpose: e.g. handlePlayPause(forceState)
  // must never receive a click event.
  const controls = useMemo(
    () => ({
      onPlayPause: () => handlePlayPause(),
      onSkip: () => skipSong(),
      onRestart: () => handleSeek([0]),
      onSeek: handleSeek,
      onVolumeChange: handleVolumeChange,
    }),
    [handlePlayPause, skipSong, handleSeek, handleVolumeChange]
  );

  const togglePlayFromKeyboard = useCallback(() => {
    if (currentSong && !playback.isBusy && !playback.isLocked) handlePlayPause();
  }, [currentSong, playback.isBusy, playback.isLocked, handlePlayPause]);

  useRoomShortcuts({ onTogglePlay: togglePlayFromKeyboard, onFocusChat: requestChatFocus });

  const chat = (
    <ChatPanel
      messages={messages}
      currentUserId={userId}
      currentUserName={user?.name}
      onSendMessage={sendMessage}
      onReactToMessage={sendMessageReaction}
      locked={!isChatAllowed}
      typingUsers={typingUsers}
      onTypingStart={onTypingStart}
      onTypingStop={onTypingStop}
    />
  );

  const people = (
    <PeoplePanel
      members={groupMembers}
      currentUserId={userId}
      hostId={currentGroup?.createdBy}
      maxMembers={maxMembers}
      onInvite={onInvite}
      onMakeHost={isHost ? transferHost : undefined}
    />
  );

  const player = (
    <PlayerPanel
      variant={roomWidth >= FULL_PLAYER_MIN_WIDTH ? 'full' : 'compact'}
      playback={playback}
      controls={controls}
      queueItem={currentQueueItem}
      onReact={sendReaction}
      onFindSong={requestSearchFocus}
      onPlayNow={playNow}
      onAddToQueue={addToQueue}
    />
  );

  // After leaving, the room stays mounted briefly while its exit animation runs,
  // but the group is already gone from the store. Render nothing in that window.
  if (!currentGroup) return null;

  return (
    <div ref={roomRef} className='@container flex h-full min-h-0 flex-col gap-2 lg:gap-3'>
      <RoomTopBar
        group={currentGroup}
        members={groupMembers}
        connectionQuality={connectionQuality}
        syncStatus={currentSong && isPlaying ? syncStatus : 'synced'}
        isReconnecting={isRejoining}
        isHost={isHost}
        controlMode={controlMode}
        onSetControlMode={setControlMode}
        outputOffsetMs={outputOffsetMs}
        onSetOutputOffset={setOutputOffset}
        onShowPeople={showPeople}
        onInvite={onInvite}
        onShowQrCode={onShowQrCode}
        onLeave={leaveGroup}
      />

      {isDesktop ? (
        <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)] gap-3 @min-[1200px]:grid-cols-[minmax(0,1fr)_400px] @min-[1440px]:grid-cols-[minmax(0,1fr)_440px]'>
          <div className='flex min-h-0 flex-col gap-3'>
            {player}
            <QueuePanel className='flex-1' />
          </div>
          <RoomSidebar
            chat={chat}
            people={people}
            unreadCount={unreadCount}
            memberCount={groupMembers.length}
          />
        </div>
      ) : (
        <>
          {player}
          <MobileRoomTabs
            chat={chat}
            queue={<QueuePanel bare />}
            people={people}
            unreadCount={unreadCount}
            queueCount={upcomingQueue.length}
            memberCount={groupMembers.length}
          />
        </>
      )}
    </div>
  );
};

export default memo(RoomView);
