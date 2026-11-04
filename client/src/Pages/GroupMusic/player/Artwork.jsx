import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { memo } from 'react';
import Equalizer from '../components/Equalizer';
import { getSongImage } from '../utils/song';

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

const Artwork = ({ song, isPlaying, isSyncing, className, showOverlay = true }) => (
  <div
    className={cn(
      'relative shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/30',
      isPlaying && !isSyncing && 'shadow-xl shadow-scrim/20',
      className
    )}
  >
    <AnimatePresence mode='wait' initial={false}>
      <motion.img
        key={song?.id}
        {...FADE}
        transition={{ duration: 0.2 }}
        src={getSongImage(song, 'large')}
        alt=''
        className='h-full w-full object-cover'
      />
    </AnimatePresence>

    {showOverlay && (
      <AnimatePresence>
        {isSyncing ? (
          <motion.div
            key='syncing'
            {...FADE}
            className='absolute inset-0 flex items-center justify-center bg-scrim/45 backdrop-blur-sm'
          >
            <Radio className='h-5 w-5 animate-pulse text-on-scrim' aria-label='Syncing' />
          </motion.div>
        ) : (
          isPlaying && (
            <motion.div
              key='playing'
              {...FADE}
              className='absolute inset-x-0 bottom-0 flex h-1/3 items-end justify-center bg-gradient-to-t from-scrim/55 to-transparent pb-2'
            >
              <Equalizer className='h-3' barClassName='bg-on-scrim/85' />
            </motion.div>
          )
        )}
      </AnimatePresence>
    )}
  </div>
);

export default memo(Artwork);
