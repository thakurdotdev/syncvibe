import he from 'he';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Radio, MessageCircle, Plus, LogIn, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/motion';
import { useRoomSeedPreview } from '@/lib/roomSeed';
import Equalizer from './components/Equalizer';
import MyRooms from './MyRooms';
import SavedRooms from './SavedRooms';
import { getSongImage } from './utils/song';

const FEATURE_CARDS = [
  { icon: Users, title: 'Listen', subtitle: 'Together' },
  { icon: Radio, title: 'Perfect', subtitle: 'Sync' },
  { icon: MessageCircle, title: 'Group', subtitle: 'Chat' },
];

/** What you're listening to, one tap from being a room's first song. */
const StartFromMusic = ({ onStart }) => {
  const { song, upNext, playing } = useRoomSeedPreview();
  if (!song) return null;
  const image = getSongImage(song, 'small');
  return (
    <button
      type='button'
      onClick={onStart}
      className='group mb-6 flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-2xl border border-border bg-muted/20 p-2.5 text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    >
      <span className='relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted'>
        {image && <img src={image} alt='' className='h-full w-full object-cover' />}
        {playing && (
          <span className='absolute inset-0 flex items-center justify-center bg-scrim/40'>
            <Equalizer bars={3} className='h-3.5' barClassName='bg-on-scrim' />
          </span>
        )}
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block text-sm font-semibold'>Start a room with this</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {he.decode(song.name || '')}
          {upNext > 0 && ` · ${upNext} up next`}
        </span>
      </span>
      <ChevronRight className='h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5' />
    </button>
  );
};

const WelcomeView = ({
  onOpenModal,
  onStartFromMusic,
  myRooms = [],
  onJoinRoom,
  onAskRoom,
  onDismissRoom,
  onOpenSavedRoom,
}) => {
  return (
    <motion.div
      key='welcome'
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className='flex flex-col items-center justify-center min-h-full py-8 px-4'
    >
      <div className='max-w-lg w-full flex flex-col items-center text-center'>
        <MyRooms rooms={myRooms} onJoin={onJoinRoom} onAsk={onAskRoom} onDismiss={onDismissRoom} />
        <SavedRooms onOpen={onOpenSavedRoom} />

        <div className='relative mb-8'>
          <div className='h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-primary/10 flex items-center justify-center'>
            <Users className='h-10 w-10 sm:h-12 sm:w-12 text-primary animate-rainbow' />
          </div>
        </div>

        <h2 className='text-2xl sm:text-3xl font-bold mb-3'>Group Music Session</h2>
        <p className='text-muted-foreground text-sm sm:text-base mb-10 max-w-sm leading-relaxed'>
          Create or join a group to listen together, perfectly synchronized across all devices.
        </p>

        <StartFromMusic onStart={onStartFromMusic} />

        <div className='flex flex-col sm:flex-row items-center gap-3 mb-12 w-full sm:w-auto'>
          <motion.div whileTap={{ scale: 0.97 }} className='w-full sm:w-auto'>
            <Button
              onClick={() => onOpenModal('create')}
              size='lg'
              className='rounded-full px-8 gap-2 w-full sm:w-auto text-sm'
            >
              <Plus className='h-4 w-4' />
              Create Group
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.97 }} className='w-full sm:w-auto'>
            <Button
              onClick={() => onOpenModal('join')}
              variant='outline'
              size='lg'
              className='rounded-full px-8 gap-2 w-full sm:w-auto text-sm'
            >
              <LogIn className='h-4 w-4' />
              Join Group
            </Button>
          </motion.div>
        </div>

        <div className='grid grid-cols-3 gap-6 sm:gap-10 w-full max-w-sm'>
          {FEATURE_CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.06 }}
              className='flex flex-col items-center gap-2.5'
            >
              <div className='h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-muted/30 border border-border/20 flex items-center justify-center'>
                <card.icon className='h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground' />
              </div>
              <div>
                <p className='text-xs sm:text-sm font-medium'>{card.title}</p>
                <p className='text-[10px] sm:text-xs text-muted-foreground mt-0.5'>
                  {card.subtitle}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default memo(WelcomeView);
