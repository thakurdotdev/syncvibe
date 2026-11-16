import { useQuery } from '@tanstack/react-query';
import { Loader2, Shuffle, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { toast } from 'sonner';
import { fetchMoods, personalKeys } from '@/api/music/personal';
import { fetchSongRecommendations } from '@/api/music/songs';
import { cn } from '@/lib/utils';
import { isRecommended } from '@/stores/playEvents';
import { usePlayerStore } from '@/stores/playerStore';

/**
 * Swaps autoplay's upcoming picks for ones that go where you ask. Songs you queued yourself stay
 * where they are, in front of the new picks.
 */
const steerQueue = async (steer, label) => {
  const { currentSong } = usePlayerStore.getState();
  if (!currentSong?.id) return;
  const songs = await fetchSongRecommendations(currentSong.id, steer);
  if (!songs.length) {
    toast.info('Nothing new to play that way yet');
    return;
  }
  const store = usePlayerStore.getState();
  const index = store.playlist.findIndex((song) => song.id === currentSong.id);
  const yours = store.playlist.slice(index + 1).filter((song) => !isRecommended(song.id));
  store.removeFromQueueBelow(currentSong.id);
  // A plain add, not an autoplay one: you asked for these, from whichever device you're on.
  store.addToQueue([...yours, ...songs]);
  toast.success(`Up next: ${label}`);
};

const Chip = ({ icon: Icon, label, busy, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    disabled={busy}
    className={cn(
      'press flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-accent disabled:opacity-70'
    )}
  >
    {busy ? (
      <Loader2 className='h-3.5 w-3.5 animate-spin' />
    ) : (
      Icon && <Icon className='h-3.5 w-3.5 text-muted-foreground' />
    )}
    {label}
  </button>
);

/** "More like this", "Something different" and the moods, above the queue. */
const SteerBar = memo(function SteerBar() {
  const { data: moods = [] } = useQuery({
    queryKey: personalKeys.moods(),
    queryFn: fetchMoods,
    staleTime: Infinity,
  });
  const [busy, setBusy] = useState(null);

  const run = async (steer, label) => {
    setBusy(steer);
    try {
      await steerQueue(steer, label);
    } catch {
      toast.error("Couldn't change what's next. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <fieldset className='row-scroll flex min-w-0 gap-1.5 overflow-x-auto px-2.5 pb-2 pt-1.5'>
      <legend className='sr-only'>Steer what plays next</legend>
      <Chip
        icon={Sparkles}
        label='More like this'
        busy={busy === 'more'}
        onClick={() => run('more', 'more like this')}
      />
      <Chip
        icon={Shuffle}
        label='Something different'
        busy={busy === 'different'}
        onClick={() => run('different', 'something different')}
      />
      {moods.map((mood) => (
        <Chip
          key={mood.key}
          label={mood.title}
          busy={busy === `mood:${mood.key}`}
          onClick={() => run(`mood:${mood.key}`, mood.title)}
        />
      ))}
    </fieldset>
  );
});

export default SteerBar;
