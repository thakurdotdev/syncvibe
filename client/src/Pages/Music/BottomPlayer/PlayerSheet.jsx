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
      <SheetContent side='bottom' className='dark h-full w-full p-0 overflow-hidden border-0 bg-black text-white'>
        <div className='h-full w-full relative'>
          <NowPlayingTab currentSong={currentSong} onOpenModal={onOpenModal} isDesktop />

          {/* Top Bar Navigation */}
          <div className='absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-none'>
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              className='h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors duration-200 cursor-pointer pointer-events-auto shadow-lg backdrop-blur-md'
              aria-label='Minimize player'
            >
              <ChevronDownIcon className='h-5 w-5 text-white' />
            </Button>

            {/* Mobile-only header actions (Desktop has them unified in DesktopQueuePanel) */}
            <div className='flex items-center gap-2 lg:hidden pointer-events-auto'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setMobileQueueOpen(true)}
                className='h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors duration-200 relative cursor-pointer shadow-lg backdrop-blur-md'
                aria-label='Open queue'
              >
                <ListMusic className='h-5 w-5 text-white' />
                <span className='absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-white/30 text-[10px] text-white font-semibold flex items-center justify-center px-1'>
                  {playlistLength}
                </span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-10 w-10 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors duration-200 cursor-pointer shadow-lg backdrop-blur-md'
                    aria-label='More options'
                  >
                    <MoreHorizontal className='h-5 w-5 text-white' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align='end'
                  className='w-56 bg-[#161822]/95 backdrop-blur-xl border-white/10 text-white shadow-2xl rounded-xl p-1.5 z-50'
                >
                  <DropdownMenuItem
                    onClick={onOpenModal}
                    className='cursor-pointer text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
                  >
                    <ListMusic className='mr-2 h-4 w-4 text-white/70' />
                    Add to Playlist
                  </DropdownMenuItem>

                  {currentSong?.album_id && (
                    <DropdownMenuItem
                      onClick={handleGoToAlbum}
                      className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
                    >
                      <Disc3 className='w-3.5 h-3.5 mr-2 text-white/70' />
                      Go to Album
                    </DropdownMenuItem>
                  )}
                  {currentSong?.artist_map?.primary_artists?.[0] && (
                    <DropdownMenuItem
                      onClick={handleGoToArtist}
                      className='cursor-pointer text-sm text-white/90 hover:text-white focus:bg-white/10 focus:text-white rounded-lg transition-colors'
                    >
                      <User className='w-3.5 h-3.5 mr-2 text-white/70' />
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
              className={`absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${
                mobileQueueOpen ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={() => setMobileQueueOpen(false)}
            />
            <div
              className={`absolute top-0 right-0 bottom-0 w-full sm:w-[420px] bg-[#0c0e14]/95 backdrop-blur-2xl transition-transform duration-300 ease-out flex flex-col border-l border-white/10 shadow-2xl ${
                mobileQueueOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className='h-16 px-5 flex items-center justify-between shrink-0 border-b border-white/10 bg-white/[0.02]'>
                <div className='flex items-center gap-2.5'>
                  <ListMusic className='w-4 h-4 text-white/70' />
                  <span className='text-sm font-semibold text-white tracking-wide'>Queue</span>
                  <span className='h-5 px-2 rounded-full text-xs bg-white/10 text-white/70 font-medium flex items-center justify-center'>
                    {playlistLength}
                  </span>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setMobileQueueOpen(false)}
                  className='h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer'
                  aria-label='Close queue'
                >
                  <X className='h-4 w-4 text-white' />
                </Button>
              </div>
              <div className='flex-1 overflow-y-auto px-2 py-3'>
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
