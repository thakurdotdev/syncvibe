import he from 'he';
import { memo } from 'react';
import { useRoomSeedPreview } from '@/lib/roomSeed';
import { cn } from '@/lib/utils';
import Equalizer from './components/Equalizer';
import { getSongImage } from './utils/song';

/**
 * In the create form while something is on: whether the new room starts with it and its queue.
 * A switch, so it reads as a setting of the room rather than a second way to submit.
 */
const StartWithMusic = ({ enabled, onChange }) => {
  const { song, upNext, playing } = useRoomSeedPreview();
  if (!song) return null;
  const image = getSongImage(song, 'small');

  return (
    <button
      type='button'
      role='switch'
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-2.5 text-left',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 hover:bg-muted/40'
      )}
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
        <span className='block text-sm font-semibold'>Start with what you&apos;re playing</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {he.decode(song.name || '')}
          {upNext > 0 && ` · ${upNext} up next`}
        </span>
      </span>

      <span
        aria-hidden='true'
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          enabled ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow-sm',
            'transition-transform duration-200 ease-out',
            enabled && 'translate-x-4'
          )}
        />
      </span>
    </button>
  );
};

export default memo(StartWithMusic);
