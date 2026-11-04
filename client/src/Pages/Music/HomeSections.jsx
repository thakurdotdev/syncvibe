import axios from 'axios';
import he from 'he';
import { Loader2, Play } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';
import { AudioWave, SongCard } from './Cards';
import { ensureHttpsForDownloadUrls } from './Common';

/** Six tiles on phones and tablets, eight once the grid reaches four columns. */
const PICKS_SMALL = 6;
const PICKS_LARGE = 8;
const CHART_LENGTH = 20;

const GRID = 'grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4';

const QuickTile = memo(function QuickTile({ song, className }) {
  const isCurrent = usePlayerStore((s) => s.currentSong?.id === song.id);
  const isPlaying = usePlayerStore((s) => s.currentSong?.id === song.id && s.isPlaying);
  const playSong = usePlayerStore((s) => s.playSong);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const [loading, setLoading] = useState(false);

  const name = he.decode(song.name || song.title || '');
  const artist =
    song.artist_map?.artists
      ?.slice(0, 2)
      ?.map((a) => a.name)
      .join(', ') ||
    song.subtitle ||
    '';
  const art = Array.isArray(song.image) ? song.image[1]?.link || song.image[0]?.link : song.image;

  const handlePlay = async () => {
    if (isCurrent) {
      handlePlayPause();
      return;
    }
    if (song.download_url) {
      playSong(ensureHttpsForDownloadUrls(song));
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`);
      const full = response.data?.data?.songs?.[0];
      if (full) playSong(ensureHttpsForDownloadUrls(full));
    } catch (err) {
      console.error('Error fetching song:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type='button'
      onClick={handlePlay}
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${name}`}
      className={cn(
        'press group relative flex h-14 min-w-0 cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl pr-2.5 text-left',
        isCurrent ? 'bg-accent' : 'bg-card hover:bg-accent',
        className
      )}
    >
      <span className='relative h-14 w-14 shrink-0 bg-raised'>
        <img src={art} alt='' loading='lazy' className='h-full w-full object-cover' />
        <span
          className={cn(
            'absolute inset-0 grid place-items-center bg-scrim/45 transition-opacity duration-150',
            isCurrent || loading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          {loading ? (
            <Loader2 className='h-4 w-4 animate-spin text-on-scrim' />
          ) : isPlaying ? (
            <AudioWave />
          ) : (
            <Play className='h-4 w-4 text-on-scrim' fill='currentColor' />
          )}
        </span>
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-[13px] font-semibold leading-tight'>{name}</span>
        <span className='mt-0.5 block truncate text-xs text-muted-foreground'>{artist}</span>
      </span>
    </button>
  );
});

/** Your recent songs as compact tiles, one tap to play. No scrolling sideways to find them. */
export const QuickPicks = memo(function QuickPicks({ songs }) {
  const picks = useMemo(() => songs.filter((s) => s?.id).slice(0, PICKS_LARGE), [songs]);
  return (
    <div className={GRID}>
      {picks.map((song, i) => (
        <QuickTile key={song.id} song={song} className={i >= PICKS_SMALL ? 'hidden xl:flex' : ''} />
      ))}
    </div>
  );
});

export const QuickPicksSkeleton = () => (
  <div className='space-y-3'>
    <Skeleton className='h-6 w-36' />
    <div className={GRID}>
      {Array.from({ length: PICKS_LARGE }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-14 rounded-xl', i >= PICKS_SMALL && 'hidden xl:block')}
        />
      ))}
    </div>
  </div>
);

/**
 * Trending as a numbered chart: columns of four that scroll sideways with the next column
 * peeking in on phones, and two or three full columns on wider screens. Layout is pure CSS.
 */
export const TrendingChart = memo(function TrendingChart({ songs }) {
  const chart = useMemo(
    () => songs.filter((s) => s?.id && s.type === 'song' && s.image?.[2]).slice(0, CHART_LENGTH),
    [songs]
  );
  if (!chart.length) return null;

  return (
    <ol className='row-scroll -mx-2 grid auto-cols-[calc(100%-2.5rem)] grid-flow-col grid-rows-4 gap-x-3 overflow-x-auto scroll-px-2 px-2 pb-3 snap-x snap-proximity sm:auto-cols-[calc(50%-0.5rem)] lg:auto-cols-[calc(33.333%-0.5rem)]'>
      {chart.map((song, i) => (
        <li key={song.id} className='flex min-w-0 snap-start items-center gap-1'>
          <span className='w-6 shrink-0 text-center font-display text-base font-semibold tabular-nums text-muted-foreground'>
            {i + 1}
          </span>
          <div className='min-w-0 flex-1'>
            <SongCard song={song} />
          </div>
        </li>
      ))}
    </ol>
  );
});
