import { Heart, Play, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLikedSongsQuery } from '@/hooks/useLikes';
import { playSongs } from '@/lib/playSongs';
import { SongCard } from '@/Pages/Music/Cards';

const GRID = 'grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3';

/** Every song you've liked, newest first. */
const LikedSongs = () => {
  const { data: songs = [], isLoading, isError, refetch } = useLikedSongsQuery();

  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className='flex items-center gap-3 rounded-xl p-2'>
            <Skeleton className='h-14 w-14 shrink-0 rounded-lg' />
            <div className='min-w-0 flex-1 space-y-2'>
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-3 w-1/2' />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className='flex flex-col items-center gap-3 py-20 text-center'>
        <p className='text-sm text-muted-foreground'>Couldn&apos;t load your liked songs.</p>
        <Button variant='outline' size='sm' onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 py-20 text-center'>
        <span className='grid h-14 w-14 place-items-center rounded-2xl bg-muted'>
          <Heart className='h-6 w-6 text-muted-foreground' />
        </span>
        <p className='font-semibold'>No liked songs yet</p>
        <p className='max-w-xs text-sm text-muted-foreground'>
          Tap the heart in the player on songs you love. They land here, and we&apos;ll recommend
          more like them.
        </p>
      </div>
    );
  }

  const shuffled = () => playSongs([...songs].sort(() => Math.random() - 0.5));

  return (
    <div className='space-y-5'>
      <div className='flex items-center gap-2'>
        <Button className='gap-2 rounded-full' onClick={() => playSongs(songs)}>
          <Play className='h-4 w-4' fill='currentColor' />
          Play
        </Button>
        <Button variant='secondary' className='gap-2 rounded-full' onClick={shuffled}>
          <Shuffle className='h-4 w-4' />
          Shuffle
        </Button>
        <span className='ml-auto text-sm tabular-nums text-muted-foreground'>
          {songs.length} {songs.length === 1 ? 'song' : 'songs'}
        </span>
      </div>
      <div className={GRID}>
        {songs.map((song) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
    </div>
  );
};

export default LikedSongs;
