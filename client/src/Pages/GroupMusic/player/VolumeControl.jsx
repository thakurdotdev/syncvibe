import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { memo, useCallback, useRef } from 'react';

const VolumeIcon = ({ volume }) => {
  if (volume === 0) return <VolumeX className='h-4 w-4' />;
  if (volume < 0.5) return <Volume1 className='h-4 w-4' />;
  return <Volume2 className='h-4 w-4' />;
};

const VolumeControl = ({ volume, onVolumeChange, className }) => {
  const lastAudibleVolume = useRef(volume || 0.5);
  const isMuted = volume === 0;

  const handleChange = useCallback(
    (value) => {
      if (value[0] > 0) lastAudibleVolume.current = value[0];
      onVolumeChange(value);
    },
    [onVolumeChange]
  );

  const toggleMute = useCallback(() => {
    onVolumeChange(isMuted ? [lastAudibleVolume.current] : [0]);
  }, [isMuted, onVolumeChange]);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button
        type='button'
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute' : 'Mute'}
        className='flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground'
      >
        <VolumeIcon volume={volume} />
      </button>
      <Slider
        aria-label='Volume'
        value={[volume]}
        max={1}
        step={0.01}
        onValueChange={handleChange}
        className='w-20 xl:w-24'
      />
    </div>
  );
};

export default memo(VolumeControl);
