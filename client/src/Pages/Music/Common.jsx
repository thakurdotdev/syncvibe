import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { memo, useCallback, useState, useRef } from 'react';
import ShareDrawer from '@/components/Posts/ShareDrawer';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';

export const formatTime = (time) => {
  if (!time) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const PlaylistActions = ({ onPlayAll, onShuffle, disabled, showShare = true }) => {
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
  return (
    <>
      <div className='flex items-center gap-2'>
        <Button onClick={onPlayAll} disabled={disabled} className='gap-2'>
          <Play className='w-4 h-4' />
          Play All
        </Button>

        <Button variant='outline' onClick={onShuffle} disabled={disabled} className='gap-2'>
          <Shuffle className='w-4 h-4' />
          Shuffle
        </Button>

        {showShare && (
          <Button variant='outline' onClick={() => setIsShareDrawerOpen(true)} className='gap-2'>
            <Share2 className='w-4 h-4' />
            Share
          </Button>
        )}
      </div>
      {showShare && (
        <ShareDrawer
          isOpen={isShareDrawerOpen}
          onClose={() => setIsShareDrawerOpen(false)}
          shareLink={window.location.href}
        />
      )}
    </>
  );
};

export const LoadingState = ({ message, height }) => (
  <div
    className={`flex ${
      height ? height : 'h-full'
    } items-center justify-center bg-background/50 backdrop-blur-xs`}
  >
    <div className='flex flex-col items-center gap-4'>
      <Loader2 className='w-10 h-10 animate-spin text-emerald-500' />
      <p className='text-muted-foreground animate-pulse'>{message || 'Loading your music...'}</p>
    </div>
  </div>
);

export const MusicControls = memo(({ size = 'default', showExtras = true }) => {
  const handleNextSong = usePlayerStore((s) => s.handleNextSong);
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong);
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);

  const isLarge = size === 'large';
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const repeatLabel = { off: 'Repeat: Off', all: 'Repeat: All', one: 'Repeat: One' };

  const btnAnim = { hover: { scale: 1.1 }, tap: { scale: 0.9 } };
  const playAnim = { hover: { scale: 1.06 }, tap: { scale: 0.92 } };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center justify-center',
          isLarge ? 'gap-3 sm:gap-5' : 'gap-1 sm:gap-2'
        )}
      >
        {showExtras && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div variants={btnAnim} whileHover='hover' whileTap='tap'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={toggleShuffle}
                  className={cn(
                    'relative transition-all duration-200 cursor-pointer rounded-full',
                    isLarge ? 'h-10 w-10' : 'h-8.5 w-8.5',
                    shuffleMode
                      ? 'text-primary bg-primary/10 border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label={shuffleMode ? 'Shuffle on' : 'Shuffle off'}
                >
                  <Shuffle className={isLarge ? 'h-4.5 w-4.5' : 'h-4 w-4'} />
                  {shuffleMode && (
                    <motion.span
                      layoutId='shuffle-indicator'
                      className='absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary'
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    />
                  )}
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side='top' className='text-xs'>
              {shuffleMode ? 'Shuffle: On' : 'Shuffle: Off'}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={btnAnim} whileHover='hover' whileTap='tap'>
              <Button
                variant='ghost'
                size='icon'
                onClick={handlePrevSong}
                className={cn(
                  'transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer',
                  isLarge ? 'h-11 w-11' : 'h-8.5 w-8.5'
                )}
                aria-label='Previous track'
              >
                <SkipBack
                  className={isLarge ? 'h-5 w-5' : 'h-4 w-4'}
                  fill='currentColor'
                />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side='top' className='text-xs'>
            Previous
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={playAnim} whileHover='hover' whileTap='tap'>
              <Button
                size='icon'
                onClick={handlePlayPause}
                className={cn(
                  'bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 cursor-pointer shadow-md',
                  isLarge
                    ? 'h-14 w-14 rounded-full'
                    : 'h-9.5 w-9.5 rounded-full'
                )}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <AnimatePresence mode='wait' initial={false}>
                  <motion.span
                    key={isPlaying ? 'pause' : 'play'}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className='flex items-center justify-center'
                  >
                    {isPlaying ? (
                      <Pause className={isLarge ? 'h-6 w-6' : 'h-4 w-4'} fill='currentColor' />
                    ) : (
                      <Play
                        className={cn(isLarge ? 'h-6 w-6 ml-0.5' : 'h-4 w-4 ml-0.5')}
                        fill='currentColor'
                      />
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side='top' className='text-xs'>
            {isPlaying ? 'Pause' : 'Play'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={btnAnim} whileHover='hover' whileTap='tap'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => handleNextSong(false)}
                className={cn(
                  'transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer',
                  isLarge ? 'h-11 w-11' : 'h-8.5 w-8.5'
                )}
                aria-label='Next track'
              >
                <SkipForward
                  className={isLarge ? 'h-5 w-5' : 'h-4 w-4'}
                  fill='currentColor'
                />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side='top' className='text-xs'>
            Next
          </TooltipContent>
        </Tooltip>

        {showExtras && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div variants={btnAnim} whileHover='hover' whileTap='tap'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={toggleRepeat}
                  className={cn(
                    'relative transition-all duration-200 cursor-pointer rounded-full',
                    isLarge ? 'h-10 w-10' : 'h-8.5 w-8.5',
                    repeatMode !== 'off'
                      ? 'text-primary bg-primary/10 border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label={repeatLabel[repeatMode]}
                >
                  <RepeatIcon className={isLarge ? 'h-4.5 w-4.5' : 'h-4 w-4'} />
                  {repeatMode !== 'off' && (
                    <motion.span
                      layoutId='repeat-indicator'
                      className='absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary'
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    />
                  )}
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side='top' className='text-xs'>
              {repeatLabel[repeatMode]}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
});

export const VolumeControl = memo(({ showVolume = false, alwaysShowSlider = false }) => {
  const handleVolumeChange = usePlayerStore((s) => s.handleVolumeChange);
  const volume = usePlayerStore((s) => s.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      handleVolumeChange(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      handleVolumeChange(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, prevVolume, handleVolumeChange]);

  if (!showVolume) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className='flex items-center gap-2 group'>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant='ghost'
                size='icon'
                className='h-8.5 w-8.5 transition-colors duration-200 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full cursor-pointer'
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                <AnimatePresence mode='wait' initial={false}>
                  <motion.span
                    key={isMuted || volume === 0 ? 'muted' : 'unmuted'}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className='flex items-center justify-center'
                  >
                    {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side='top' className='text-xs'>
            {isMuted || volume === 0 ? 'Unmute' : 'Mute'}
          </TooltipContent>
        </Tooltip>
        <div
          className={cn(
            'transition-all duration-300',
            alwaysShowSlider
              ? 'w-24 sm:w-28 opacity-100'
              : 'w-0 overflow-hidden group-hover:w-20 opacity-0 group-hover:opacity-100'
          )}
        >
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            className={cn(
              'w-full cursor-pointer',
              '[&>span:first-child]:h-[3px] [&>span:first-child]:bg-muted [&>span:first-child]:rounded-full',
              '[&>span:first-child>span]:bg-primary [&>span:first-child>span]:rounded-full',
              '**:[[role=slider]]:h-2.5 **:[[role=slider]]:w-2.5 **:[[role=slider]]:bg-primary **:[[role=slider]]:border-0'
            )}
            onValueChange={([value]) => {
              handleVolumeChange(value);
              if (value > 0) setIsMuted(false);
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
});

export const ProgressBarMusic = memo(({ isTimeVisible = false }) => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(pct * duration);
    setHoverX(x);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  const showTooltip = (hoverTime !== null || isDragging) && duration > 0;
  const displayTime = isDragging ? currentTime : hoverTime;

  let activeX = hoverX;
  if (isDragging && containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    const pct = currentTime / (duration || 1);
    activeX = pct * rect.width;
  }

  return (
    <div
      ref={containerRef}
      className='relative group/progress cursor-pointer overflow-visible'
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {showTooltip && (
        <div
          className='absolute z-[100] bg-popover border border-border text-popover-foreground text-[10px] font-mono font-semibold px-2 py-0.5 rounded shadow-xl pointer-events-none -translate-x-1/2'
          style={{
            left: `${activeX}px`,
            bottom: '18px',
          }}
        >
          {formatTime(displayTime)}
        </div>
      )}

      <Slider
        value={[currentTime]}
        min={0}
        max={duration || 1}
        step={0.1}
        onValueChange={([value]) => handleTimeSeek(value)}
        onPointerDown={() => setIsDragging(true)}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
        className={cn(
          'relative h-5 py-2 -my-2 cursor-pointer transition-colors duration-200',
          '[&>span:first-child]:h-[3.5px] [&>span:first-child]:bg-muted [&>span:first-child]:rounded-full [&>span:first-child]:transition-[height,background-color] [&>span:first-child]:duration-200',
          'group-hover/progress:[&>span:first-child]:h-[5px] group-hover/progress:[&>span:first-child]:bg-muted-foreground/30',
          '[&>span:first-child>span]:bg-primary [&>span:first-child>span]:rounded-full [&>span:first-child>span]:transition-colors [&>span:first-child>span]:duration-200',
          'group-hover/progress:[&>span:first-child>span]:bg-primary',
          '**:[[role=slider]]:h-3.5 **:[[role=slider]]:w-3.5 **:[[role=slider]]:bg-primary **:[[role=slider]]:border-0',
          '**:[[role=slider]]:shadow-sm',
          '**:[[role=slider]]:opacity-0 **:[[role=slider]]:scale-50',
          '**:[[role=slider]]:transition-[opacity,transform] **:[[role=slider]]:duration-200',
          'group-hover/progress:**:[[role=slider]]:opacity-100 group-hover/progress:**:[[role=slider]]:scale-100'
        )}
      />
      {isTimeVisible && (
        <div className='flex justify-between px-0.5'>
          <span className='text-[11px] text-muted-foreground font-mono tabular-nums font-medium'>
            {formatTime(currentTime)}
          </span>
          <span className='text-[11px] text-muted-foreground font-mono tabular-nums font-medium'>
            {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
});

export const ensureHttpsForDownloadUrls = (song) => {
  if (!song || typeof song !== 'object') return song;

  const updatedDownloadUrls = Array.isArray(song.download_url)
    ? song.download_url.map((item) => {
        if (!item || typeof item !== 'object') return item;
        return {
          ...item,
          link:
            item.link && typeof item.link === 'string'
              ? item.link.startsWith('http://')
                ? item.link.replace('http://', 'https://')
                : item.link
              : item.link,
        };
      })
    : song.download_url;

  const updatedArtworkUrls = Array.isArray(song.image)
    ? song.image.map((item) => {
        if (!item || typeof item !== 'object') return item;
        return {
          ...item,
          link:
            item.link && typeof item.link === 'string'
              ? item.link.startsWith('http://')
                ? item.link.replace('http://', 'https://')
                : item.link
              : item.link,
        };
      })
    : song.image;

  return {
    ...song,
    download_url: updatedDownloadUrls,
    image: updatedArtworkUrls,
  };
};

export const addToHistory = async (songData, playedTime, trackingType) => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/history/add`,
      { songData, playedTime, trackingType },
      { withCredentials: true }
    );

    if (response.status === 200) {
    }
  } catch (error) {
    console.error('Error adding to history:', error);
  }
};
