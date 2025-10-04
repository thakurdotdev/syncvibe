import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlaylist } from '@/Context/PlayerContext';
import he from 'he';
import { ChevronDownIcon, Download, ListMusic, MoreHorizontal, Music, Share2 } from 'lucide-react';
import { memo, useState } from 'react';
import { toast } from 'sonner';

import NowPlayingTab from './NowPlayingTab';
import QueueTab from './QueueTab';
import { useMemo } from 'react';

const PlayerSheet = memo(({ isOpen, onClose, currentSong, onOpenModal }) => {
  const [activeTab, setActiveTab] = useState('current');
  const { playlist } = usePlaylist();

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(', ') || '',
    [currentSong]
  );

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: he.decode(currentSong.name),
        text: `Listen to ${he.decode(currentSong.name)} by ${he.decode(artistName)}`,
        url: window.location.href,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handleDownload = async () => {
    const songLink = currentSong?.download_url?.[4]?.link;

    if (!songLink) {
      toast.error('Download link not available');
      return;
    }

    try {
      toast.loading('Preparing download...');

      // Fetch the audio file
      const response = await fetch(songLink);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the file as a blob
      const blob = await response.blob();

      // Create object URL
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `${he.decode(currentSong.name)} - ${he.decode(artistName)}.mp3`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the object URL
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success('Download completed');
    } catch (error) {
      console.error('Download failed:', error);
      toast.dismiss();

      // Fallback: open in new tab if download fails
      toast.error('Direct download failed. Opening in new tab...');
      window.open(songLink, '_blank');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side='bottom'
        className='h-full w-full p-0 overflow-hidden bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-xl border-t border-white/10 shadow-2xl'
      >
        <div className='absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none' />
        <div className='h-full flex flex-col w-full max-w-[500px] mx-auto relative z-10'>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className='h-full flex flex-col w-full'
          >
            {/* Header */}
            <SheetHeader className='px-3 pb-0 border-b border-white/10 bg-gradient-to-r from-white/[0.05] to-transparent'>
              <div className='flex items-center justify-between'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={onClose}
                  className='h-8 w-8 shrink-0 hover:bg-white/10 backdrop-blur-sm transition-all duration-200'
                >
                  <ChevronDownIcon className='h-5 w-5' />
                </Button>
                {/* Action Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-9 w-9 shrink-0 hover:bg-white/10 backdrop-blur-sm transition-all duration-200 border border-transparent hover:border-white/10'
                    >
                      <MoreHorizontal className='h-5 w-5' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align='end'
                    className='w-56 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl'
                  >
                    <DropdownMenuItem onClick={onOpenModal} className='cursor-pointer'>
                      <ListMusic className='mr-2 h-4 w-4' />
                      Add to Playlist
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleShare} className='cursor-pointer'>
                      <Share2 className='mr-2 h-4 w-4' />
                      Share Song
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownload} className='cursor-pointer'>
                      <Download className='mr-2 h-4 w-4' />
                      Download
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Tabs Navigation */}
              <div className='flex justify-center pb-4'>
                <TabsList className='grid grid-cols-2 w-full bg-white/[0.08] backdrop-blur-sm border border-white/10 shadow-lg'>
                  <TabsTrigger
                    value='current'
                    className='flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-200'
                  >
                    <Music className='w-4 h-4' />
                    <span className='hidden sm:inline'>Now Playing</span>
                    <span className='sm:hidden'>Current</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value='queue'
                    className='flex items-center justify-center space-x-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/30 data-[state=active]:to-primary/20 data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-200'
                  >
                    <ListMusic className='w-4 h-4' />
                    <span>Queue</span>
                    <Badge
                      variant='secondary'
                      className='ml-1 h-5 text-xs bg-gradient-to-r from-primary/20 to-primary/15 text-primary border border-primary/20 backdrop-blur-sm shadow-sm'
                    >
                      {playlist?.length || 0}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
            </SheetHeader>

            {/* Content */}
            <div className='flex-1 overflow-hidden bg-gradient-to-b from-transparent via-white/[0.02] to-transparent'>
              <TabsContent value='current' className='mt-0 h-full overflow-y-auto p-0'>
                <NowPlayingTab currentSong={currentSong} onOpenModal={onOpenModal} />
              </TabsContent>

              <TabsContent value='queue' className='mt-0 h-full overflow-y-auto p-0'>
                <QueueTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
});

PlayerSheet.displayName = 'PlayerSheet';
export default PlayerSheet;
