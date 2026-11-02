import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Loader2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { memo } from 'react';

const TAP = { scale: 0.92, transition: { duration: 0.12 } };

const SIZES = {
  md: { secondary: 'h-9 w-9', primary: 'h-11 w-11', icon: 'h-4 w-4', primaryIcon: 'h-5 w-5' },
  sm: { secondary: 'h-8 w-8', primary: 'h-9 w-9', icon: 'h-3.5 w-3.5', primaryIcon: 'h-4 w-4' },
};

const ControlButton = ({ label, onClick, disabled, className, children }) => (
  <motion.button
    type='button'
    aria-label={label}
    title={label}
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
  onRestart,
  onPlayPause,
  onSkip,
  showRestart = true,
  size = 'md',
}) => {
  const s = SIZES[size];

  return (
    <div className='flex items-center gap-1.5'>
      {showRestart && (
        <ControlButton
          label='Restart song'
          onClick={onRestart}
          disabled={isBusy}
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
        disabled={isBusy}
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
        label='Skip song'
        onClick={onSkip}
        disabled={isBusy}
        className={cn(
          s.secondary,
          'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        )}
      >
        <SkipForward className={s.icon} />
      </ControlButton>
    </div>
  );
};

export default memo(TransportControls);
