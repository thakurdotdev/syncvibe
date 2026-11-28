import { Pause, Play } from 'lucide-react';
import { memo } from 'react';
import { songArtists, songCoverOf, songName } from '@/lib/chatSongs';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';

/** A song someone shared: click it to play it in your own player. */
const SongMessage = ({ song, isOwn, rounded }) => {
  const isCurrent = usePlayerStore((s) => s.currentSong?.id === song.id);
  const isPlaying = usePlayerStore((s) => s.currentSong?.id === song.id && s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);

  const name = songName(song);
  const artists = songArtists(song);
  const play = () => (isCurrent ? handlePlayPause() : playSong(song));

  return (
    <button
      type='button'
      onClick={play}
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${name}${artists ? ` by ${artists}` : ''}`}
      className={cn(
        'flex w-64 max-w-full cursor-pointer items-center gap-3 p-2 text-left transition-colors',
        isOwn
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-muted text-foreground hover:bg-muted/80 dark:bg-muted/70',
        rounded
      )}
    >
      <span className='relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-foreground/10'>
        {songCoverOf(song) && (
          <img
            src={songCoverOf(song)}
            alt=''
            loading='lazy'
            className='h-full w-full object-cover'
          />
        )}
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-sm font-semibold'>{name}</span>
        {artists && <span className='block truncate text-xs opacity-75'>{artists}</span>}
      </span>
      <span
        className={cn(
          'mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isOwn ? 'bg-primary-foreground text-primary' : 'bg-foreground text-background'
        )}
        aria-hidden='true'
      >
        {isPlaying ? (
          <Pause className='h-3.5 w-3.5 fill-current' />
        ) : (
          <Play className='ml-0.5 h-3.5 w-3.5 fill-current' />
        )}
      </span>
    </button>
  );
};

export default memo(SongMessage);
