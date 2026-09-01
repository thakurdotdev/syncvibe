import {
  Disc3,
  ListMusic,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSongRecommendationsQuery } from '@/hooks/queries/useSongQueries';
import { usePlayerStore } from '@/stores/playerStore';
import QueueTab from './QueueTab';

const DesktopQueuePanel = memo(
  ({ ready, currentSong, onOpenModal, handleGoToAlbum, handleGoToArtist }) => {
    const playlistLength = usePlayerStore((s) => s.playlist.length);
    const clearQueue = usePlayerStore((s) => s.clearQueue);
    const replaceQueue = usePlayerStore((s) => s.replaceQueue);
    const addToQueue = usePlayerStore((s) => s.addToQueue);
    const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
    const setAutoFetchRecommendations = usePlayerStore((s) => s.setAutoFetchRecommendations);

    const [fetchingRecs, setFetchingRecs] = useState(false);

    const { refetch: fetchRecommendations } = useSongRecommendationsQuery(currentSong?.id, {
      enabled: false,
    });

    const handleClearQueue = useCallback(() => {
      clearQueue();
      toast.success('Queue cleared');
    }, [clearQueue]);

    const handleFetchAndReplace = useCallback(async () => {
      if (!currentSong?.id) return;
      setFetchingRecs(true);
      try {
        const { data } = await fetchRecommendations();
        if (data?.length > 0) {
          replaceQueue(data, true);
          toast.success(`Added ${data.length} recommendations`);
        } else {
          toast.info('No recommendations found');
        }
      } catch {
        toast.error('Failed to fetch recommendations');
      }
      setFetchingRecs(false);
    }, [currentSong?.id, fetchRecommendations, replaceQueue]);

    const handleFetchAndAdd = useCallback(async () => {
      if (!currentSong?.id) return;
      setFetchingRecs(true);
      try {
        const { data } = await fetchRecommendations();
        if (data?.length > 0) {
          addToQueue(data);
          toast.success(`Added ${data.length} songs to queue`);
        } else {
          toast.info('No recommendations found');
        }
      } catch {
        toast.error('Failed to fetch recommendations');
      }
      setFetchingRecs(false);
    }, [currentSong?.id, fetchRecommendations, addToQueue]);

    const handleToggleAutoFetch = useCallback(() => {
      setAutoFetchRecommendations(!autoFetchRecommendations);
      toast.success(autoFetchRecommendations ? 'Auto-fetch disabled' : 'Auto-fetch enabled');
    }, [autoFetchRecommendations, setAutoFetchRecommendations]);

    return (
      <TooltipProvider delayDuration={300}>
        <div className='dqp-panel'>
          <div className='dqp-header text-foreground'>
            <div className='flex items-center gap-2'>
              <ListMusic className='w-4 h-4 text-muted-foreground' />
              <span className='text-sm font-semibold tracking-wide'>Queue</span>
              <Badge
                variant='secondary'
                className='h-5 text-[10.5px] px-2 rounded-full bg-muted text-muted-foreground border-0 font-medium'
              >
                {playlistLength}
              </Badge>
            </div>

            <div className='flex items-center gap-1'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7.5 w-7.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors cursor-pointer'
                    onClick={handleClearQueue}
                    disabled={playlistLength <= 1}
                    aria-label='Clear queue'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side='bottom' className='text-xs'>
                  Clear queue
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-7.5 w-7.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer'
                        disabled={fetchingRecs}
                        aria-label='Recommendations'
                      >
                        {fetchingRecs ? (
                          <Loader2 className='h-3.5 w-3.5 animate-spin' />
                        ) : (
                          <Sparkles className='h-3.5 w-3.5' />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side='bottom' className='text-xs'>
                    Recommendations
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align='end'
                  className='w-52 bg-popover text-popover-foreground border-border shadow-xl rounded-lg p-1.5 z-50'
                >
                  <DropdownMenuItem
                    onClick={handleFetchAndAdd}
                    className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
                  >
                    <RefreshCw className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                    Add to queue
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleFetchAndReplace}
                    className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
                  >
                    <Sparkles className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                    Replace queue
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className='bg-border my-1' />
                  <DropdownMenuItem
                    onClick={handleToggleAutoFetch}
                    className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
                  >
                    {autoFetchRecommendations ? (
                      <ToggleRight className='w-3.5 h-3.5 mr-2 text-primary' />
                    ) : (
                      <ToggleLeft className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                    )}
                    Auto-fetch: {autoFetchRecommendations ? 'On' : 'Off'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-7.5 w-7.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer'
                    aria-label='More options'
                  >
                    <MoreHorizontal className='h-3.5 w-3.5' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align='end'
                  className='w-56 bg-popover text-popover-foreground border-border shadow-xl rounded-lg p-1.5 z-50'
                >
                  <DropdownMenuItem
                    onClick={onOpenModal}
                    className='cursor-pointer text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
                  >
                    <ListMusic className='mr-2 h-4 w-4 text-muted-foreground' />
                    Add to Playlist
                  </DropdownMenuItem>

                  {currentSong?.album_id && (
                    <DropdownMenuItem
                      onClick={handleGoToAlbum}
                      className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
                    >
                      <Disc3 className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                      Go to Album
                    </DropdownMenuItem>
                  )}
                  {currentSong?.artist_map?.primary_artists?.[0] && (
                    <DropdownMenuItem
                      onClick={handleGoToArtist}
                      className='cursor-pointer text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
                    >
                      <User className='w-3.5 h-3.5 mr-2 text-muted-foreground' />
                      Go to Artist
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className='dqp-list'>
            {ready ? (
              <QueueTab variant='desktop' />
            ) : (
              <div className='flex items-center justify-center h-32'>
                <div className='w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin' />
              </div>
            )}
          </div>
        </div>

        <style>{`
          .dqp-panel {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 360px;
            background: hsl(var(--background) / 0.35);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-left: 1px solid hsl(var(--border) / 0.25);
            display: flex;
            flex-direction: column;
            z-index: 25;
          }
          .dqp-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            padding: 0 14px;
            flex-shrink: 0;
            border-bottom: 1px solid hsl(var(--border) / 0.25);
          }
          .dqp-list {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            scrollbar-color: hsl(var(--muted-foreground) / 0.2) transparent;
            padding: 0;
          }
          .dqp-list::-webkit-scrollbar {
            width: 4px;
          }
          .dqp-list::-webkit-scrollbar-track {
            background: transparent;
          }
          .dqp-list::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.2);
            border-radius: 4px;
          }
          .dqp-list::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--muted-foreground) / 0.35);
          }
        `}</style>
      </TooltipProvider>
    );
  }
);

DesktopQueuePanel.displayName = 'DesktopQueuePanel';
export default DesktopQueuePanel;
