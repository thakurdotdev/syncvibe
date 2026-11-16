import { useQuery } from '@tanstack/react-query';
import he from 'he';
import { Play, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { fetchRecap, personalKeys } from '@/api/music/personal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { playSongs } from '@/lib/playSongs';
import { getSongImage } from '@/Pages/GroupMusic/utils/song';

const PEAK = {
  morning: 'a morning listener',
  afternoon: 'an afternoon listener',
  evening: 'an evening listener',
  night: 'a night owl',
};

const formatDay = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const Stat = ({ value, label }) => (
  <div className='rounded-2xl border border-border bg-card p-4'>
    <p className='font-display text-3xl font-semibold tabular-nums'>{value}</p>
    <p className='mt-1 text-sm text-muted-foreground'>{label}</p>
  </div>
);

const shareText = (recap) =>
  [
    `My week on SyncVibe: ${recap.minutes} minutes of music`,
    recap.topArtists?.[0] && `mostly ${recap.topArtists[0].name}`,
    recap.topSongs?.[0] && `on repeat: ${he.decode(recap.topSongs[0].song.name)}`,
  ]
    .filter(Boolean)
    .join(', ');

/** The last seven days of your listening: time, top songs and artists, your mood. */
const Recap = () => {
  const {
    data: recap,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: personalKeys.recap(),
    queryFn: fetchRecap,
    staleTime: 1000 * 60 * 30,
  });

  const share = async () => {
    const text = shareText(recap);
    try {
      if (navigator.share) {
        await navigator.share({ text, url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        toast.success('Copied to share');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast.error("Couldn't share");
    }
  };

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:py-12'>
        <Skeleton className='h-12 w-72' />
        <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-24 rounded-2xl' />
          ))}
        </div>
        <Skeleton className='h-72 rounded-[1.75rem]' />
      </div>
    );
  }

  if (isError || !recap) {
    return (
      <div className='flex flex-col items-center gap-3 py-24 text-center'>
        <p className='text-sm text-muted-foreground'>Couldn&apos;t load your week.</p>
        <Button variant='outline' size='sm' onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!recap.minutes) {
    return (
      <div className='mx-auto flex max-w-sm flex-col items-center gap-2 py-24 text-center'>
        <h1 className='text-2xl font-bold'>A quiet week</h1>
        <p className='text-sm text-muted-foreground'>
          Play some music and your week in music shows up here.
        </p>
      </div>
    );
  }

  const change = recap.previousMinutes
    ? Math.round(((recap.minutes - recap.previousMinutes) / recap.previousMinutes) * 100)
    : null;
  const topSongs = recap.topSongs.map((item) => item.song);

  return (
    <div className='mx-auto w-full max-w-3xl space-y-8 px-4 pb-32 pt-8 md:pt-12'>
      <header className='flex flex-wrap items-end justify-between gap-4'>
        <div className='space-y-1'>
          <p className='text-sm text-muted-foreground'>
            {formatDay(recap.from)} – {formatDay(recap.to)}
          </p>
          <h1 className='text-3xl font-bold md:text-4xl'>Your week in music</h1>
        </div>
        <Button variant='secondary' className='gap-2 rounded-full' onClick={share}>
          <Share2 className='h-4 w-4' />
          Share
        </Button>
      </header>

      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <Stat
          value={recap.minutes}
          label={
            change === null
              ? 'minutes listened'
              : `minutes, ${change >= 0 ? `${change}% more` : `${-change}% less`} than last week`
          }
        />
        <Stat value={`${recap.daysListened}/7`} label='days with music' />
        <Stat value={recap.songsPlayed} label='different songs' />
        <Stat value={recap.discoveries} label='heard for the first time' />
      </div>

      {(recap.topMood || recap.peak) && (
        <p className='text-lg'>
          {recap.topMood && (
            <>
              Your mood was mostly <span className='font-semibold'>{recap.topMood.title}</span>
              {recap.peak ? ', and you were ' : '.'}
            </>
          )}
          {recap.peak && (
            <>
              {!recap.topMood && 'You were '}
              <span className='font-semibold'>{PEAK[recap.peak]}</span>.
            </>
          )}
        </p>
      )}

      <section className='bezel'>
        <div className='bezel-inner p-5 sm:p-6'>
          <div className='mb-4 flex items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold'>On repeat</h2>
            <Button
              size='sm'
              className='h-8 gap-1.5 rounded-full px-3'
              onClick={() => playSongs(topSongs)}
            >
              <Play className='h-3.5 w-3.5' fill='currentColor' />
              Play
            </Button>
          </div>
          <ol className='space-y-1'>
            {recap.topSongs.map(({ song, plays }, index) => (
              <li key={song.id}>
                <button
                  type='button'
                  onClick={() => playSongs(topSongs, index)}
                  className='flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left hover:bg-accent'
                >
                  <span className='w-5 text-center font-display text-sm font-semibold tabular-nums text-muted-foreground'>
                    {index + 1}
                  </span>
                  <img
                    src={getSongImage(song, 'medium')}
                    alt=''
                    className='h-11 w-11 shrink-0 rounded-lg object-cover'
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-semibold'>
                      {he.decode(song.name || '')}
                    </span>
                    <span className='block truncate text-xs text-muted-foreground'>
                      {he.decode(song.artist_map?.primary_artists?.[0]?.name || '')}
                    </span>
                  </span>
                  <span className='shrink-0 text-xs tabular-nums text-muted-foreground'>
                    {plays} {plays === 1 ? 'play' : 'plays'}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {recap.topArtists.length > 0 && (
        <section className='space-y-3'>
          <h2 className='text-lg font-semibold'>Top artists</h2>
          <ul className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {recap.topArtists.map((artist, index) => (
              <li
                key={artist.id || artist.name}
                className='flex items-center gap-3 rounded-2xl border border-border bg-card p-3'
              >
                <span className='w-5 text-center font-display text-sm font-semibold tabular-nums text-muted-foreground'>
                  {index + 1}
                </span>
                <Avatar className='h-10 w-10'>
                  <AvatarImage src={artist.image?.replace('http://', 'https://')} alt='' />
                  <AvatarFallback>{artist.name[0]}</AvatarFallback>
                </Avatar>
                <span className='min-w-0 flex-1 truncate text-sm font-semibold'>
                  {he.decode(artist.name)}
                </span>
                <span className='shrink-0 text-xs tabular-nums text-muted-foreground'>
                  {artist.minutes} min
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Recap;
