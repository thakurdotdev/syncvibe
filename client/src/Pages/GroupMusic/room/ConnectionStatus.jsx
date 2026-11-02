import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { memo } from 'react';

const QUALITY = {
  good: { bars: 3, label: 'Good connection', color: 'bg-emerald-500' },
  fair: { bars: 2, label: 'Fair connection', color: 'bg-amber-500' },
  poor: { bars: 1, label: 'Poor connection', color: 'bg-rose-500' },
};

/** "Live" pill + signal bars, or a reconnecting state. */
const ConnectionStatus = ({ quality = 'good', isReconnecting }) => {
  if (isReconnecting) {
    return (
      <span className='inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-500'>
        <RefreshCw className='h-3 w-3 animate-spin' />
        Reconnecting
      </span>
    );
  }

  const meta = QUALITY[quality] || QUALITY.good;

  return (
    <span className='inline-flex items-center gap-2' title={meta.label}>
      <span className='inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-500'>
        <span className='relative flex h-1.5 w-1.5'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
          <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500' />
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
