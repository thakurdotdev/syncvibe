import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { memo } from 'react';

const QUALITY = {
  good: { bars: 3, label: 'Good connection', color: 'bg-success' },
  fair: { bars: 2, label: 'Fair connection', color: 'bg-warning' },
  poor: { bars: 1, label: 'Poor connection', color: 'bg-destructive' },
};

/** "Live" pill + signal bars, or a reconnecting / catching-up state. */
const ConnectionStatus = ({ quality = 'good', syncStatus = 'synced', isReconnecting }) => {
  if (isReconnecting) {
    return (
      <span className='inline-flex items-center gap-1.5 text-[11px] font-medium text-warning'>
        <RefreshCw className='h-3 w-3 animate-spin' />
        Reconnecting
      </span>
    );
  }

  const meta = QUALITY[quality] || QUALITY.good;

  // Small corrections can't be heard, so only a real gap is worth showing.
  if (syncStatus === 'catching-up') {
    return (
      <span
        className='inline-flex items-center gap-1.5 text-[11px] font-medium text-warning'
        title='Getting back in step with the room'
      >
        <RefreshCw className='h-3 w-3 animate-spin' />
        Catching up
      </span>
    );
  }

  return (
    <span className='inline-flex items-center gap-2' title={meta.label}>
      <span className='inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-success'>
        <span className='relative flex h-1.5 w-1.5'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75' />
          <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-success' />
        </span>
        Live
      </span>
      <span className='flex h-3 items-end gap-[2px]' role='img' aria-label={meta.label}>
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={cn(
              'w-[3px] rounded-full',
              bar <= meta.bars ? meta.color : 'bg-muted-foreground/20'
            )}
            style={{ height: `${(bar / 3) * 100}%` }}
          />
        ))}
      </span>
    </span>
  );
};

export default memo(ConnectionStatus);
