import { useProfile } from '@/Context/Context';
import { useGroupMusic } from '@/Context/GroupMusicContext';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useState } from 'react';
import '../Music/music.css';
import GlobalSoundAnimation from './GlobalSoundAnimation';
import GroupModal from './GroupModal';
import InviteSheet from './InviteSheet';
import ArtworkBackdrop from './player/ArtworkBackdrop';
import QRCodeDialog from './QRCodeDialog';
import ReconnectingView from './room/ReconnectingView';
import RoomView from './room/RoomView';
import { getSongImage } from './utils/song';
import WelcomeView from './WelcomeView';

const VIEW_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

/**
 * /music/sync — fills the layout's content area exactly (no page scroll).
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
                <WelcomeView onOpenModal={openGroupModal} />
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
