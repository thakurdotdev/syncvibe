/** biome-ignore-all lint/a11y/useButtonType: <explanation> */

import { ChevronDownIcon, Disc3, ListMusic, MoreHorizontal, User, X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { usePlayerStore } from '@/stores/playerStore';
import DesktopQueuePanel from './DesktopQueuePanel';
import NowPlayingTab from './NowPlayingTab';
import QueueTab from './QueueTab';

const PlayerSheet = memo(({ isOpen, onClose, currentSong, onOpenModal }) => {
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const [queueReady, setQueueReady] = useState(false);
  const playlistLength = usePlayerStore((s) => s.playlist.length);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setQueueReady(true), 300);
      return () => clearTimeout(timer);
    }
    setQueueReady(false);
  }, [isOpen]);

  const handleGoToAlbum = useCallback(
    (e) => {
      e.stopPropagation();
      if (currentSong?.album_id) {
        navigate(`/music/album/${currentSong.album_id}`, { state: currentSong.album_id });
        onClose();
      }
    },
    [currentSong?.album_id, navigate, onClose]
  );

  const handleGoToArtist = useCallback(
    (e) => {
      e.stopPropagation();
      if (currentSong?.artist_map?.primary_artists?.[0]?.id) {
        navigate(`/music/artist/${currentSong.artist_map.primary_artists[0].id}`, {
          state: currentSong.artist_map.primary_artists[0].id,
        });
        onClose();
      }
    },
    [currentSong?.artist_map?.primary_artists, navigate, onClose]
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side='bottom'
        className='h-full w-full p-0 overflow-hidden border-0 bg-background text-foreground'
      >
        <div className='h-full w-full relative'>
          <NowPlayingTab currentSong={currentSong} onOpenModal={onOpenModal} isDesktop />

          {/* Top Bar Navigation */}
          <div className='absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-none'>
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              className='h-9 w-9 bg-muted/70 hover:bg-muted text-foreground rounded-full transition-colors duration-200 cursor-pointer pointer-events-auto backdrop-blur-md border border-border/40'
              aria-label='Minimize player'
            >
              <ChevronDownIcon className='h-5 w-5' />
            </Button>

            {/* Mobile-only header actions */}
            <div className='flex items-center gap-2 lg:hidden pointer-events-auto'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setMobileQueueOpen(true)}
                className='h-9 w-9 bg-muted/70 hover:bg-muted text-foreground rounded-full transition-colors duration-200 relative cursor-pointer backdrop-blur-md border border-border/40'
                aria-label='Open queue'
              >
                <ListMusic className='h-4.5 w-4.5' />
                <span className='absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-primary text-[9.5px] text-primary-foreground font-semibold flex items-center justify-center px-1'>
                  {playlistLength}
                </span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-9 w-9 bg-muted/70 hover:bg-muted text-foreground rounded-full transition-colors duration-200 cursor-pointer backdrop-blur-md border border-border/40'
                    aria-label='More options'
                  >
                    <MoreHorizontal className='h-4.5 w-4.5' />
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

          {/* Desktop: Always-Visible Right Queue Panel */}
          <div className='hidden lg:block'>
            <DesktopQueuePanel
              ready={queueReady}
              currentSong={currentSong}
              onOpenModal={onOpenModal}
              handleGoToAlbum={handleGoToAlbum}
              handleGoToArtist={handleGoToArtist}
            />
          </div>

          {/* Mobile: Full-Screen Slide-Over Queue Drawer */}
          <div
            className={`lg:hidden absolute inset-0 z-40 transition-all duration-300 ease-out ${
              mobileQueueOpen ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <div
              className={`absolute inset-0 bg-background/60 backdrop-blur-xs transition-opacity duration-300 ${
                mobileQueueOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setMobileQueueOpen(false)}
            />
            <div
              className={`absolute top-0 right-0 bottom-0 w-full sm:w-[420px] bg-background/95 text-foreground backdrop-blur-2xl transition-transform duration-300 ease-out flex flex-col border-l border-border/40 shadow-2xl ${
                mobileQueueOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className='h-14 px-4 flex items-center justify-between shrink-0 border-b border-border/40 bg-muted/10'>
                <div className='flex items-center gap-2'>
                  <ListMusic className='w-4 h-4 text-muted-foreground' />
                  <span className='text-sm font-semibold tracking-wide'>Queue</span>
                  <span className='h-5 px-2 rounded-full text-xs bg-muted text-muted-foreground font-medium flex items-center justify-center'>
                    {playlistLength}
                  </span>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setMobileQueueOpen(false)}
                  className='h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer'
                  aria-label='Close queue'
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>
              <div className='flex-1 overflow-y-auto px-0 py-1'>
                <QueueTab showHeader={false} />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});

PlayerSheet.displayName = 'PlayerSheet';
export default PlayerSheet;
