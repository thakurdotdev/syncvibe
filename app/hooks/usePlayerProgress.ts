import { useProgress } from '@rntp/player';
import { useEffect, useState } from 'react';
import { remoteProgress } from '@/lib/player';
import { usePlayerSessionStore, useRemoteDevice } from '@/stores/playerSessionStore';

/**
 * The song's progress for a progress bar: the native player's, or, while another of your
 * devices plays, that device's, worked out from the shared timeline.
 */
export const usePlayerProgress = () => {
  const native = useProgress();
  const remote = useRemoteDevice();
  const playing = usePlayerSessionStore((s) => Boolean(remote && s.playback?.timeline.playing));
  const rev = usePlayerSessionStore((s) => (remote ? s.playback?.rev : null));
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [playing, rev]);

  return remoteProgress() ?? native;
};
