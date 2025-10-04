import { memo, useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { usePlayer, usePlayerState, usePlaylist } from '@/Context/PlayerContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import axios from 'axios';

import { ProgressBarMusic } from '../Common';
import PlayerControls from './PlayerControls';
import SongInfo from './SongInfo';
import MinimizedPlayer from './MinimizedPlayer';
import PlayerSheet from './PlayerSheet';
import AddToPlaylist from '../AddToPlaylist';

const BottomPlayer = () => {
  const { addToPlaylist } = usePlayer();
  const { currentSong } = usePlayerState();
  const { playlist } = usePlaylist();

  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  const getRecommendations = useCallback(async () => {
    if (!currentSong?.id) return;

    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/song/recommend?id=${currentSong.id}`
      );
      if (response.data?.data) {
        setRecommendations(response.data.data);
        if (playlist.length < 2 && response.data.data.length > 0) {
          addToPlaylist(response.data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentSong?.id, playlist.length, addToPlaylist]);

  useEffect(() => {
    getRecommendations();
  }, [getRecommendations]);

  console.log(currentSong);

  if (!currentSong) return null;

  return (
    <>
      <Card
        className={cn(
          'fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-md border-t z-50 transition-all duration-500',
          isMinimized ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        )}
      >
        <CardContent className='p-0'>
          {/* Progress Bar */}
          <div className='absolute -top-1 left-0 w-full'>
            <ProgressBarMusic />
          </div>

          <div className='flex items-center justify-between p-4 pt-5'>
            <SongInfo currentSong={currentSong} onOpenSheet={() => setIsSheetOpen(true)} />

            <PlayerControls
              isMinimized={isMinimized}
              onMinimize={() => setIsMinimized(true)}
              onOpenModal={() => setIsModalOpen(true)}
              isMobile={isMobile}
            />
          </div>
        </CardContent>
      </Card>

      <MinimizedPlayer
        isMinimized={isMinimized}
        onMaximize={() => setIsMinimized(false)}
        currentSong={currentSong}
        isMobile={isMobile}
      />

      <PlayerSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentSong={currentSong}
        loading={loading}
        recommendations={recommendations}
        onOpenModal={() => setIsModalOpen(true)}
      />

      <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={currentSong} />
    </>
  );
};

export default memo(BottomPlayer);
