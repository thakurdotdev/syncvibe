import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

// Generate a realistic, unique waveform pattern based on sound ID/name
const generateWaveform = (str = '') => {
  const bars = [];
  let seed = 0;
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  for (let i = 0; i < 26; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const norm = Math.abs(seed % 100) / 100;
    // Height between 4px and 16px with organic voice note variation
    const h = Math.round(4 + norm * 12);
    bars.push(h);
  }
  return bars;
};

const formatAudioTime = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const SoundMessage = ({ msg, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const soundUrl = msg.soundUrl || msg.message;
  const soundName = msg.soundName || msg.message || 'Voice Note';
  const soundId = msg.soundId || soundName;

  const waveformBars = useMemo(() => generateWaveform(soundId), [soundId]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleTogglePlay = useCallback(
    (e) => {
      e?.stopPropagation();
      if (!soundUrl) return;

      if (isPlaying) {
        stopAudio();
        return;
      }

      if (!audioRef.current || audioRef.current.src !== soundUrl) {
        audioRef.current = new Audio(soundUrl);
        audioRef.current.volume = 0.85;
      }

      const audio = audioRef.current;
      audio.currentTime = 0;

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        setIsPlaying(false);
      };

      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    },
    [isPlaying, soundUrl, stopAudio]
  );

  const handleSeek = useCallback(
    (e, index) => {
      e.stopPropagation();
      if (!audioRef.current || !duration) {
        handleTogglePlay();
        return;
      }
      const seekRatio = index / waveformBars.length;
      const targetTime = seekRatio * duration;
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      if (!isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true));
      }
    },
    [duration, isPlaying, waveformBars.length, handleTogglePlay]
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : isPlaying ? 50 : 0;
  const displayTime =
    isPlaying && currentTime > 0 ? formatAudioTime(currentTime) : formatAudioTime(duration || 2);

  return (
    <div className='flex items-center gap-3 py-1 px-0.5 w-[230px] max-w-[230px] select-none'>
      {/* WhatsApp-style Circular Play/Pause Button */}
      <button
        type='button'
        onClick={handleTogglePlay}
        title={isPlaying ? 'Pause' : 'Play sound'}
        className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer border-0 shadow-sm',
          isOwn
            ? 'bg-primary text-primary-foreground hover:opacity-90'
            : 'bg-foreground/15 hover:bg-foreground/25 text-foreground'
        )}
      >
        {isPlaying ? (
          <Pause className='h-4 w-4 fill-current' />
        ) : (
          <Play className='h-4 w-4 fill-current ml-0.5' />
        )}
      </button>

      {/* Waveform & Info Section */}
      <div className='flex-1 min-w-0 flex flex-col justify-center gap-1'>
        {/* Sound Title */}
        <p className='text-[12.5px] font-semibold text-foreground truncate leading-none'>
          {soundName}
        </p>

        {/* WhatsApp Audio Waveform Track */}
        <div className='flex items-center justify-between gap-2'>
          <div
            className='flex items-center gap-[2px] h-4 flex-1 cursor-pointer'
            title='Click to seek'
          >
            {waveformBars.map((height, i) => {
              const barPercent = (i / waveformBars.length) * 100;
              const isFilled = progressPercent >= barPercent;
              return (
                <span
                  key={i}
                  onClick={(e) => handleSeek(e, i)}
                  className={cn(
                    'w-[2px] rounded-full transition-colors duration-100 shrink-0 hover:opacity-80',
                    isFilled
                      ? isOwn
                        ? 'bg-primary'
                        : 'bg-foreground'
                      : isOwn
                        ? 'bg-primary/25'
                        : 'bg-foreground/20'
                  )}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>

          {/* Time Duration */}
          <span className='text-[10px] font-medium text-muted-foreground/75 tabular-nums shrink-0'>
            {displayTime}
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(SoundMessage);
