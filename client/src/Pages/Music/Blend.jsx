import { useQuery } from '@tanstack/react-query';
import he from 'he';
import { Play } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { fetchBlend, personalKeys } from '@/api/music/personal';
import { useProfile } from '@/Context/Context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { playSongs } from '@/lib/playSongs';
import { cn } from '@/lib/utils';
import { getSongImage } from '@/Pages/GroupMusic/utils/song';

const SIDE_LABEL = { both: 'Both of you', you: 'You', them: null };

/** A mix of your taste and a friend's, the same for both of you today. */
const Blend = () => {
  const { userId } = useParams();
  const { user } = useProfile();
  const {
    data: blend,
    isLoading,
    error,
  } = useQuery({
    queryKey: personalKeys.blend(userId),
    queryFn: () => fetchBlend(userId),
    retry: false,
    staleTime: 1000 * 60 * 30,
  });

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:py-12'>
        <Skeleton className='h-20 w-72' />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-14 rounded-xl' />
        ))}
      </div>
    );
  }

  if (error || !blend) {
    return (
      <div className='mx-auto flex max-w-sm flex-col items-center gap-2 py-24 text-center'>
        <h1 className='text-2xl font-bold'>No Blend yet</h1>
        <p className='text-sm text-muted-foreground'>
          {error?.response?.data?.error || "Couldn't make this Blend. Try again later."}
        </p>
      </div>
    );
  }

  const { partner, songs, sides } = blend;
  const theirLabel = partner.name.split(' ')[0];

  return (
    <div className='mx-auto w-full max-w-3xl space-y-8 px-4 pb-32 pt-8 md:pt-12'>
      <header className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <div className='flex -space-x-3'>
            <Avatar className='h-14 w-14 border-2 border-background'>
              <AvatarImage src={user?.profilepic} alt='' />
              <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <Avatar className='h-14 w-14 border-2 border-background'>
              <AvatarImage src={partner.profilepic} alt='' />
              <AvatarFallback>{partner.name[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div>
            <h1 className='text-2xl font-bold md:text-3xl'>You + {theirLabel}</h1>
            <p className='text-sm text-muted-foreground'>
              A Blend of both your tastes, new every day
            </p>
          </div>
        </div>
        <Button className='gap-2 rounded-full' onClick={() => playSongs(songs)}>
          <Play className='h-4 w-4' fill='currentColor' />
          Play
        </Button>
      </header>

      <ol className='space-y-1'>
        {songs.map((song, index) => {
          const side = sides[song.id];
          return (
            <li key={song.id}>
              <button
                type='button'
                onClick={() => playSongs(songs, index)}
                className='flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left hover:bg-accent'
              >
                <img
                  src={getSongImage(song, 'medium')}
                  alt=''
                  className='h-12 w-12 shrink-0 rounded-lg object-cover'
                />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-semibold'>
                    {he.decode(song.name || '')}
                  </span>
                  <span className='block truncate text-xs text-muted-foreground'>
                    {he.decode(song.artist_map?.primary_artists?.[0]?.name || '')}
                  </span>
                </span>
                {side && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                      side === 'both' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    {SIDE_LABEL[side] ?? theirLabel}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Blend;
