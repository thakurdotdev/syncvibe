import TrackPlayer, { type Progress } from '@rntp/player';
import { useEffect, useState } from 'react';
import { useAppActive } from './useAppActive';

const same = (a: Progress, b: Progress) => a.position === b.position && a.duration === b.duration;

/**
 * The native player's progress, read once a second. Unlike the library's `useProgress`, it
 * re-renders only when the position moved: nothing while paused, and nothing while the app is in
 * the background (it reads again on the way back).
 */
export function useTrackProgress(): Progress {
  const active = useAppActive();
  const [progress, setProgress] = useState<Progress>(() => TrackPlayer.getProgress());

  useEffect(() => {
    if (!active) return;
    const read = () => {
      const next = TrackPlayer.getProgress();
      setProgress((prev) => (same(prev, next) ? prev : next));
    };
    read();
    const timer = setInterval(read, 1000);
    return () => clearInterval(timer);
  }, [active]);

  return progress;
}
