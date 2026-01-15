import { memo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ListMusic, Minimize2 } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { cn } from '@/lib/utils';
import { MusicControls, VolumeControl } from '../Common';
import SleepTimerModal from '../SleepTimer';

const PlayerControls = memo(({ isMinimized, onMinimize, onOpenModal, isMobile }) => {
  // Individual selectors - actions are stable references
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === ' ' &&
        document.activeElement &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        handlePlayPause();
      }
      if (e.key === 'ArrowRight') handleNextSong();
      if (e.key === 'ArrowLeft') handlePrevSong();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleNextSong, handlePrevSong]);

  return (
    <div className='flex items-center gap-2'>
      <Button
        variant='ghost'
        size='icon'
        className={cn(
          'h-12 w-12 rounded-full shadow-lg',
          'transition-all duration-500 hover:scale-105',
          isMinimized
            ? 'opacity-0 pointer-events-none -translate-y-10'
            : 'opacity-100 translate-y-0'
        )}
        onClick={onMinimize}
      >
        <Minimize2 size={20} />
      </Button>

      <Button
        variant='ghost'
        size='icon'
        onClick={(e) => {
          e.stopPropagation();
          onOpenModal();
        }}
        className='hidden sm:flex hover:scale-105'
      >
        <ListMusic size={18} />
      </Button>

      <VolumeControl />
      {!isMobile && <SleepTimerModal />}
      <MusicControls />
    </div>
  );
});

PlayerControls.displayName = 'PlayerControls';
export default PlayerControls;
