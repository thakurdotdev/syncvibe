import { cn } from '@/lib/utils';
import { AudioLines, ListPlus, Play, Search } from 'lucide-react';
import { memo } from 'react';
import { getArtistName, getSongImage } from '../utils/song';

const QuickPick = memo(({ song, onPlayNow, onAddToQueue }) => (
  <div className='group flex min-w-0 items-center gap-2.5 rounded-xl bg-foreground/[0.03] p-1.5 pr-2 transition-colors hover:bg-foreground/[0.07]'>
    <button
      type='button'
      onClick={() => onPlayNow(song)}
      aria-label={`Play ${song.name}`}
      className='relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg'
    >
      <img
        src={getSongImage(song, 'medium')}
        alt=''
        loading='lazy'
        className='h-full w-full object-cover'
      />
      <span className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
        <Play className='h-3.5 w-3.5 fill-white text-white' />
      </span>
    </button>
    <div className='min-w-0 flex-1'>
      <p className='truncate text-[13px] font-medium leading-snug'>{song.name}</p>
      <p className='truncate text-[11px] leading-snug text-muted-foreground'>
        {getArtistName(song, '')}
      </p>
    </div>
    <button
      type='button'
      onClick={() => onAddToQueue(song)}
      aria-label={`Add ${song.name} to queue`}
      title='Add to queue'
      className='flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100'
    >
      <ListPlus className='h-3.5 w-3.5' />
    </button>
  </div>
));

const EmptyPlayer = ({ compact, quickPicks = [], onFindSong, onPlayNow, onAddToQueue }) => {
  const picks = quickPicks.slice(0, 4);

  return (
    <div className={cn('relative z-10', compact ? 'p-3' : 'p-4 xl:p-5')}>
      <div className='flex items-center gap-3'>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-muted-foreground',
            compact ? 'h-12 w-12' : 'h-16 w-16'
          )}
        >
          <AudioLines className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
        <div className='min-w-0 flex-1'>
          <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
            Nothing playing yet
          </p>
          <p className='truncate text-xs text-muted-foreground'>
            Pick a song to start the session for everyone
          </p>
        </div>
        <button
          type='button'
          onClick={onFindSong}
          className='flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background transition-transform hover:scale-[1.03]'
        >
          <Search className='h-3.5 w-3.5' />
          {compact ? 'Add' : 'Find a song'}
        </button>
      </div>

      {!compact && picks.length > 0 && (
        <div className='mt-4'>
          <p className='mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70'>
            Quick picks
          </p>
          <div className='grid grid-cols-2 gap-1.5'>
            {picks.map((song) => (
              <QuickPick
                key={song.id}
                song={song}
                onPlayNow={onPlayNow}
                onAddToQueue={onAddToQueue}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(EmptyPlayer);
