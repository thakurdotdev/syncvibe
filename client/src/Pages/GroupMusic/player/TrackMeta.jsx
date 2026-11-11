import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Radio } from 'lucide-react';
import { memo } from 'react';
import { getArtistName, getInitial } from '../utils/song';

const AddedBy = ({ user }) => (
  <span className='inline-flex min-w-0 items-center gap-1.5 text-muted-foreground'>
    <Avatar className='h-4 w-4 shrink-0'>
      <AvatarImage src={user.profilePic} />
      <AvatarFallback className='bg-accent text-[8px]'>{getInitial(user.userName)}</AvatarFallback>
    </Avatar>
    <span className='truncate'>{user.userName}</span>
  </span>
);

export const SyncBadge = ({ countdown }) => (
  <span className='inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary'>
    <Radio className='h-3 w-3 animate-pulse' />
    Syncing{countdown > 0 ? ` ${countdown}s` : '…'}
  </span>
);

const SIZES = {
  lg: { title: 'text-xl @xl:text-2xl @3xl:text-3xl', meta: 'text-sm' },
  sm: { title: 'text-sm', meta: 'text-xs' },
};

const TrackMeta = ({
  song,
  addedBy,
  isSyncing,
  syncCountdown,
  isLocked = false,
  size = 'lg',
  showEyebrow = false,
}) => {
  const styles = SIZES[size];
  const showAddedBy = addedBy?.userName && addedBy.userId !== 'system';

  return (
    <div className='min-w-0'>
      {showEyebrow && (
        <div className='mb-1 flex h-5 items-center gap-2'>
          <span className='text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70'>
            Now playing
          </span>
          {isSyncing && <SyncBadge countdown={syncCountdown} />}
          {isLocked && !isSyncing && (
            <span className='inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted-foreground'>
              <Lock className='h-3 w-3' />
              Hosts control
            </span>
          )}
        </div>
      )}
      <AnimatePresence mode='wait' initial={false}>
        <motion.div
          key={song?.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <h2 className={cn('truncate font-bold tracking-tight', styles.title)} title={song?.name}>
            {song?.name}
          </h2>
          <div className={cn('mt-0.5 flex min-w-0 items-center gap-1.5', styles.meta)}>
            <span className='truncate text-muted-foreground'>{getArtistName(song)}</span>
            {showAddedBy && size === 'lg' && (
              <>
                <span className='text-muted-foreground/40' aria-hidden='true'>
                  ·
                </span>
                <span className='shrink-0 text-muted-foreground/60'>added by</span>
                <AddedBy user={addedBy} />
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default memo(TrackMeta);
