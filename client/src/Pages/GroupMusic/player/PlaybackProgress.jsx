import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { memo } from 'react';

const PlaybackProgress = ({ currentTime, duration, onSeek, formatTime, disabled, className }) => (
  <div className={cn('flex items-center gap-3', className)}>
    <span className='w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground'>
      {formatTime(currentTime)}
    </span>
    <Slider
      aria-label='Seek'
      value={[currentTime]}
      max={duration || 100}
      step={1}
      onValueChange={onSeek}
      disabled={disabled}
      className='flex-1 cursor-pointer'
    />
    <span className='w-10 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground'>
      {formatTime(duration)}
    </span>
  </div>
);

export default memo(PlaybackProgress);
