import { useSocket } from '@/Context/ChatContext';
import { useProfile } from '@/Context/Context';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useState } from 'react';
import '../Music/music.css';
import GlobalSoundAnimation from './GlobalSoundAnimation';
import GroupModal from './GroupModal';
import { useMyRooms } from './hooks/useMyRooms';
import InviteSheet from './InviteSheet';
import ArtworkBackdrop from './player/ArtworkBackdrop';
import QRCodeDialog from './QRCodeDialog';
import ReconnectingView from './room/ReconnectingView';
import RoomView from './room/RoomView';
import { getSongImage } from './utils/song';
import WelcomeView from './WelcomeView';
import { VIEW } from '@/lib/motion';

const VIEW_TRANSITION = VIEW;

/**
 * /rooms — fills the layout's content area exactly (no page scroll).
 * Shows the welcome screen, a reconnecting state, or the active room.
 */
const GroupMusic = () => {
  const { user } = useProfile();
  const {
    currentGroup,
    currentSong,
    isRejoining,
    groupMembers,
    isGroupModalOpen,
    setIsGroupModalOpen,
    createGroup,
    joinGroup,
    isInviteSheetOpen,
    setIsInviteSheetOpen,
    sendInvite,
  } = useGroupMusic();

  const { socket } = useSocket();
  const myRooms = useMyRooms(socket, currentGroup?.id);

  const [isQrCodeOpen, setIsQrCodeOpen] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState('join');

  const openGroupModal = useCallback(
    (tab = 'join') => {
      setModalDefaultTab(tab);
      setIsGroupModalOpen(true);
    },
    [setIsGroupModalOpen]
  );
  const closeGroupModal = useCallback(() => setIsGroupModalOpen(false), [setIsGroupModalOpen]);
  const openInvite = useCallback(() => setIsInviteSheetOpen(true), [setIsInviteSheetOpen]);
  const openQrCode = useCallback(() => setIsQrCodeOpen(true), []);
  const closeQrCode = useCallback(() => setIsQrCodeOpen(false), []);

  const view = currentGroup ? 'room' : isRejoining ? 'reconnecting' : 'welcome';

  return (
    <div className='relative h-full overflow-hidden'>
      {currentGroup && (
        <ArtworkBackdrop imageUrl={getSongImage(currentSong, 'large')} intensity={0.18} />
      )}

      <div className='relative h-full p-2 md:p-3 lg:px-4 lg:pb-4 lg:pt-2'>
        <AnimatePresence mode='wait' initial={false}>
          <motion.div key={view} {...VIEW_TRANSITION} className='h-full'>
            {view === 'room' && <RoomView onInvite={openInvite} onShowQrCode={openQrCode} />}
            {view === 'reconnecting' && <ReconnectingView />}
            {view === 'welcome' && (
              <div className='h-full overflow-y-auto overscroll-contain'>
                <WelcomeView
                  onOpenModal={openGroupModal}
                  myRooms={myRooms.rooms}
                  onJoinRoom={joinGroup}
                  onAskRoom={myRooms.ask}
                  onDismissRoom={myRooms.dismiss}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isGroupModalOpen && (
        <GroupModal
          isOpen={isGroupModalOpen}
          onClose={closeGroupModal}
          onCreateGroup={createGroup}
          onJoinGroup={joinGroup}
          defaultTab={modalDefaultTab}
        />
      )}

      {isQrCodeOpen && (
        <QRCodeDialog isOpen={isQrCodeOpen} onClose={closeQrCode} group={currentGroup} />
      )}

      <InviteSheet
        isOpen={isInviteSheetOpen}
        onClose={setIsInviteSheetOpen}
        groupMembers={groupMembers}
        sendInvite={sendInvite}
      />

      <GlobalSoundAnimation currentUserId={user?.userid} />
    </div>
  );
};

export default memo(GroupMusic);
