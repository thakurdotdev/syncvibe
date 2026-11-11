import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Loader2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { memo } from 'react';

const TAP = { scale: 0.92, transition: { duration: 0.12 } };

const SIZES = {
  md: { secondary: 'h-9 w-9', primary: 'h-11 w-11', icon: 'h-4 w-4', primaryIcon: 'h-5 w-5' },
  sm: { secondary: 'h-8 w-8', primary: 'h-9 w-9', icon: 'h-3.5 w-3.5', primaryIcon: 'h-4 w-4' },
};

const ControlButton = ({ label, title, onClick, disabled, className, children }) => (
  <motion.button
    type='button'
    aria-label={label}
    title={title || label}
    onClick={onClick}
    disabled={disabled}
    whileTap={disabled ? undefined : TAP}
    className={cn(
      'flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
  >
    {children}
  </motion.button>
);

const TransportControls = ({
  isPlaying,
  isBusy,
  isLocked = false,
  onRestart,
  onPlayPause,
  onSkip,
  skipVote,
  onVoteSkip,
  showRestart = true,
  size = 'md',
}) => {
  const s = SIZES[size];
  const disabled = isBusy || isLocked;
  const lockedHint = isLocked ? 'Only the hosts can control playback' : null;
  // Without control, skipping becomes a vote the room settles.
  const voting = isLocked && Boolean(onVoteSkip);
  const votes = skipVote?.count ?? 0;
  const voteLabel = skipVote?.voted
    ? 'Take back your vote to skip'
    : votes > 0 && skipVote?.needed
      ? `Vote to skip (${votes} of ${skipVote.needed})`
      : 'Vote to skip';

  return (
    <div className='flex items-center gap-1.5'>
      {showRestart && (
        <ControlButton
          label='Restart song'
          onClick={onRestart}
          title={lockedHint}
          disabled={disabled}
          className={cn(
            s.secondary,
            'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
          )}
        >
          <SkipBack className={s.icon} />
        </ControlButton>
      )}
      <ControlButton
        label={isPlaying ? 'Pause' : 'Play'}
        onClick={onPlayPause}
        title={lockedHint}
        disabled={disabled}
        className={cn(s.primary, 'bg-foreground text-background shadow-md hover:scale-[1.04]')}
      >
        {isBusy ? (
          <Loader2 className={cn(s.primaryIcon, 'animate-spin')} />
        ) : isPlaying ? (
          <Pause className={cn(s.primaryIcon, 'fill-current')} />
        ) : (
          <Play className={cn(s.primaryIcon, 'ml-0.5 fill-current')} />
        )}
      </ControlButton>
      <ControlButton
        label={voting ? voteLabel : 'Skip song'}
        onClick={voting ? onVoteSkip : onSkip}
        title={voting ? voteLabel : lockedHint}
        disabled={voting ? isBusy : disabled}
        className={cn(
          s.secondary,
          'relative text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
          voting && skipVote?.voted && 'bg-foreground/10 text-foreground'
        )}
      >
        <SkipForward className={s.icon} />
        {voting && votes > 0 && (
          <span className='absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background'>
            {votes}
            {skipVote?.needed ? `/${skipVote.needed}` : ''}
          </span>
        )}
      </ControlButton>
    </div>
  );
};

export default memo(TransportControls);
