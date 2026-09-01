import { memo, useEffect, useRef, useState } from 'react';

import { useSongRecommendationsQuery } from '@/hooks/queries/useSongQueries';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useAppModeStore } from '@/stores/appModeStore';
import { useGroupPlaybackStore } from '@/stores/groupMusic/playbackStore';
import { usePlayerStore } from '@/stores/playerStore';
import AddToPlaylist from '../AddToPlaylist';
import PlayerControls from './PlayerControls';
import PlayerSheet from './PlayerSheet';
import SongInfo from './SongInfo';

const BottomPlayer = () => {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const playlist = usePlayerStore((s) => s.playlist);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations);
  const isSoloPlaying = usePlayerStore((s) => s.isPlaying);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const isGroupPlaying = useGroupPlaybackStore((s) => s.isPlaying);

  useEffect(() => {
    if (isGroupPlaying && isSoloPlaying) {
      handlePlayPause();
    }
  }, [isGroupPlaying, isSoloPlaying, handlePlayPause]);

  const isMobile = useIsMobile();
  const mode = useAppModeStore((s) => s.mode);
  const hasMobileNav = isMobile && mode === 'music';

  const isMinimized = usePlayerStore((s) => s.isMinimized);
  const isClosed = usePlayerStore((s) => s.isClosed);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const lastFetchedForId = useRef(null);

  const currentIndex = playlist.findIndex((song) => song.id === currentSong?.id);
  const needsRecommendations = currentIndex === -1 || currentIndex >= playlist.length - 2;
  const shouldFetch =
    autoFetchRecommendations &&
    !!currentSong?.id &&
    needsRecommendations &&
    lastFetchedForId.current !== currentSong?.id;

  const { data: recommendations = [], isLoading: loading } = useSongRecommendationsQuery(
    currentSong?.id,
    { enabled: shouldFetch }
  );

  useEffect(() => {
    if (recommendations.length > 0 && shouldFetch) {
      lastFetchedForId.current = currentSong?.id;
      addToQueue(recommendations);
    }
  }, [recommendations, shouldFetch, currentSong?.id, addToQueue]);

  if (!currentSong || isClosed) return null;

  const songImage =
    currentSong?.image?.[2]?.link ||
    currentSong?.image?.[1]?.link ||
    'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png';

  return (
    <>
      {/* Floating Modern Pill Player */}
      <div
        className={cn(
          'fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out',
          'w-[calc(100%-1.25rem)] sm:w-auto sm:min-w-[520px] md:min-w-[580px] max-w-xl md:max-w-2xl',
          hasMobileNav ? 'bottom-[72px]' : 'bottom-4 sm:bottom-6',
          isMinimized ? 'translate-y-28 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        )}
      >
        {/* Soft subtle ambient artwork backglow */}
        <div className='absolute inset-0 -z-10 rounded-2xl sm:rounded-full opacity-20 blur-2xl overflow-hidden pointer-events-none transition-opacity duration-500'>
          <img src={songImage} alt='' className='w-full h-full object-cover scale-125' />
        </div>

        {/* Clean Glass Capsule */}
        <div className='relative w-full rounded-2xl sm:rounded-full bg-card/90 backdrop-blur-xl border border-border text-card-foreground shadow-2xl px-3 sm:px-4 py-2 sm:py-2.5'>
          {/* Main Layout: Left Track Block | Right Controls */}
          <div className='flex items-center justify-between gap-2.5 sm:gap-5'>
            <SongInfo currentSong={currentSong} onOpenSheet={() => setIsSheetOpen(true)} />
            <PlayerControls />
          </div>
        </div>
      </div>

      {/* Full-Screen Player Sheet */}
      <PlayerSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentSong={currentSong}
        loading={loading}
        recommendations={recommendations}
        onOpenModal={() => setIsModalOpen(true)}
      />

      {/* Add To Playlist Dialog */}
      <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={currentSong} />
    </>
  );
};

export default memo(BottomPlayer);
