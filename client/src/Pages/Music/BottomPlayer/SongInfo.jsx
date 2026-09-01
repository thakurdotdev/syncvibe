import he from 'he';
import { Music } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { usePlayerStore } from '@/stores/playerStore';
import { formatTime } from '../Common';
import { cn } from '@/lib/utils';

const SongInfo = memo(({ currentSong, onOpenSheet }) => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek);

  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);

  const songImage = useMemo(
    () =>
      currentSong?.image?.[2]?.link ||
      currentSong?.image?.[1]?.link ||
      'https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png',
    [currentSong]
  );

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(', ') || '',
    [currentSong]
  );

  const decodedName = useMemo(() => he.decode(currentSong?.name || ''), [currentSong]);
  const decodedArtist = useMemo(() => he.decode(artistName), [artistName]);

  const handleSliderMouseMove = useCallback(
    (e) => {
      if (!sliderRef.current || !duration) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = x / rect.width;
      setHoverTime(pct * duration);
      setHoverX(x);
    },
    [duration]
  );

  const handleSliderMouseLeave = useCallback(() => {
    if (!isDragging) setHoverTime(null);
  }, [isDragging]);

  const showTooltip = (hoverTime !== null || isDragging) && duration > 0;
  const displayTime = isDragging ? currentTime : hoverTime;

  return (
    <div className='flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1'>
      {/* Squircle Cover Artwork */}
      <button
        type='button'
        className='relative shrink-0 cursor-pointer group/cover bg-transparent border-0 p-0 focus-visible:outline-none'
        onClick={onOpenSheet}
        title='Open full player'
      >
        <Avatar className='h-10 w-10 sm:h-11 sm:w-11 rounded-xl border border-border shadow-sm overflow-hidden transition-transform duration-200 group-hover/cover:scale-105'>
          <AvatarImage src={songImage} alt={decodedName} className='object-cover w-full h-full' />
          <AvatarFallback className='bg-muted rounded-xl text-muted-foreground'>
            <Music className='w-4 h-4' />
          </AvatarFallback>
        </Avatar>
      </button>

      {/* Details + Scrubber + Time Stack */}
      <div className='flex flex-col min-w-0 flex-1 justify-center'>
        {/* Track Title & Artist */}
        <button
          type='button'
          className='text-left bg-transparent border-0 p-0 cursor-pointer focus-visible:outline-none group/text w-full'
          onClick={onOpenSheet}
        >
          <p className='text-xs sm:text-[13.5px] font-semibold text-foreground truncate group-hover/text:text-foreground/80 transition-colors leading-tight'>
            {decodedName}
          </p>
          <div className='flex items-center justify-between gap-2 mt-0.5'>
            <p className='text-[10.5px] sm:text-[11.5px] text-muted-foreground truncate font-normal'>
              {decodedArtist || 'Unknown Artist'}
            </p>
            <span className='text-[10px] text-muted-foreground/80 font-mono tabular-nums select-none shrink-0'>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </button>

        {/* Integrated Scrubber Slider */}
        <div
          ref={sliderRef}
          className='relative w-full group/slider py-1 mt-0.5 cursor-pointer'
          onMouseMove={handleSliderMouseMove}
          onMouseLeave={handleSliderMouseLeave}
        >
          {/* Tooltip on seek hover */}
          {showTooltip && (
            <div
              className='absolute z-50 -top-6.5 pointer-events-none -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-popover border border-border text-[9px] font-mono font-medium text-popover-foreground shadow-xl tabular-nums animate-in fade-in zoom-in-95 duration-100'
              style={{ left: `${hoverX}px` }}
            >
              {formatTime(displayTime)}
            </div>
          )}

          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 1}
            step={0.1}
            onValueChange={([val]) => handleTimeSeek(val)}
            onPointerDown={() => setIsDragging(true)}
            onPointerUp={() => {
              setIsDragging(false);
              setHoverTime(null);
            }}
            className={cn(
              'relative h-2 cursor-pointer',
              '[&>span:first-child]:h-[2.5px] sm:[&>span:first-child]:h-[3px] [&>span:first-child]:bg-muted [&>span:first-child]:rounded-full [&>span:first-child]:transition-[height,background-color] [&>span:first-child]:duration-150',
              'group-hover/slider:[&>span:first-child]:h-[4px] group-hover/slider:[&>span:first-child]:bg-muted-foreground/30',
              '[&>span:first-child>span]:bg-primary group-hover/slider:[&>span:first-child>span]:bg-primary [&>span:first-child>span]:rounded-full',
              '**:[[role=slider]]:h-2.5 **:[[role=slider]]:w-2.5 **:[[role=slider]]:bg-primary **:[[role=slider]]:border-0 **:[[role=slider]]:shadow-sm',
              '**:[[role=slider]]:opacity-0 group-hover/slider:**:[[role=slider]]:opacity-100 **:[[role=slider]]:transition-opacity'
            )}
          />
        </div>
      </div>
    </div>
  );
});

SongInfo.displayName = 'SongInfo';
export default SongInfo;
