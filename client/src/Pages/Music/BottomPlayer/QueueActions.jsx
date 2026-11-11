import { ListPlus, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fetchSongRecommendations } from '@/api/music/songs';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';

/*
 * What you can do to the whole queue, the same set as the app's queue: autoplay on or off,
 * songs like the one playing (added, or in place of the queue), and clearing it. Shown above
 * the queue on desktop and in the queue drawer on phones.
 */
const QueueActions = memo(({ className }) => {
  const currentSongId = usePlayerStore((s) => s.currentSong?.id);
  const queueLength = usePlayerStore((s) => s.playlist.length);
  const autoplay = usePlayerStore((s) => s.autoFetchRecommendations);
  const [fetching, setFetching] = useState(false);

  const toggleAutoplay = useCallback(() => {
    usePlayerStore.getState().setAutoFetchRecommendations(!autoplay);
    toast.success(autoplay ? 'Autoplay off' : 'Autoplay on');
  }, [autoplay]);

  const fillWithSimilar = useCallback(
    async (replace) => {
      if (!currentSongId) return;
      setFetching(true);
      try {
        const songs = await fetchSongRecommendations(currentSongId);
        if (!songs.length) {
          toast.info('No similar songs found');
          return;
        }
        const player = usePlayerStore.getState();
        if (replace) player.replaceQueue(songs, true);
        else player.addToQueue(songs);
        toast.success(
          replace ? 'Queue refreshed with similar songs' : `Added ${songs.length} similar songs`
        );
      } finally {
        setFetching(false);
      }
    },
    [currentSongId]
  );

  const clearQueue = useCallback(() => {
    usePlayerStore.getState().clearQueue();
    toast.success('Queue cleared');
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-1', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              onClick={toggleAutoplay}
              aria-pressed={autoplay}
              className={cn(
                'h-7 rounded-full px-2.5 text-xs font-semibold cursor-pointer transition-colors',
                autoplay
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Auto
            </Button>
          </TooltipTrigger>
          <TooltipContent side='bottom' className='text-xs'>
            {autoplay ? 'Adding similar songs as the queue runs out' : 'Autoplay is off'}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  disabled={fetching || !currentSongId}
                  aria-label='Similar songs'
                  className='h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer'
                >
                  {fetching ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <Sparkles className='h-3.5 w-3.5' />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side='bottom' className='text-xs'>
              Similar songs
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align='end' className='w-56 rounded-lg p-1.5'>
            <DropdownMenuItem onClick={() => fillWithSimilar(false)} className='cursor-pointer'>
              <ListPlus className='mr-2 h-3.5 w-3.5 text-muted-foreground' />
              Add similar songs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fillWithSimilar(true)} className='cursor-pointer'>
              <RefreshCw className='mr-2 h-3.5 w-3.5 text-muted-foreground' />
              Refresh queue with similar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              onClick={clearQueue}
              disabled={queueLength <= 1}
              aria-label='Clear queue'
              className='h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted cursor-pointer'
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent side='bottom' className='text-xs'>
            Clear queue
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});
QueueActions.displayName = 'QueueActions';

export default QueueActions;
