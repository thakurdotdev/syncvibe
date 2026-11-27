import TrackPlayer from '@rntp/player';
import { create } from 'zustand';
import { usePlayerStore } from './playerStore';

/*
 * Stops your music after a while or when this song ends.
 *
 * A time is counted by the native player's own sleep timer, inside the playback service: it
 * keeps going with the app in the background and pauses there, so nothing in JS has to wake
 * up for it. "End of this song" is counted here, on song changes, and pauses outright: a
 * play/pause toggle could start playback again from the background if the player was
 * between states.
 */

interface SleepTimerState {
  /** When the music pauses, as a timestamp; null when not set by time. */
  endsAt: number | null;
  /** Songs still to play, the current one included; null when not set by songs. */
  songsLeft: number | null;
}

/** The last seconds fade out, so the music doesn't stop mid-note. */
const FADE_OUT_SECONDS = 8;

export const useSleepTimer = create<SleepTimerState>(() => ({ endsAt: null, songsLeft: null }));

const forget = () => useSleepTimer.setState({ endsAt: null, songsLeft: null });

const cancelNative = () => {
  try {
    TrackPlayer.cancelSleepTimer();
  } catch (error) {
    console.error('Error cancelling sleep timer:', error);
  }
};

export const clearSleepTimer = () => {
  cancelNative();
  forget();
};

export const setSleepTimerMinutes = (minutes: number) => {
  const seconds = minutes * 60;
  TrackPlayer.sleepAfterTime(seconds, { fadeOutSeconds: FADE_OUT_SECONDS });
  useSleepTimer.setState({ endsAt: Date.now() + seconds * 1000, songsLeft: null });
};

/** 1 is "end of this song". */
export const setSleepTimerSongs = (songs: number) => {
  cancelNative();
  useSleepTimer.setState({ endsAt: null, songsLeft: songs });
};

/** The native timer paused the music. */
export const sleepTimerTriggered = () => forget();

/** On progress ticks: drops a time that has passed (the native timer already paused). */
export const checkSleepTimer = () => {
  const { endsAt } = useSleepTimer.getState();
  if (endsAt !== null && Date.now() >= endsAt) forget();
};

/** Back in the app: take the time left from the native timer, which is the one counting. */
export const syncSleepTimerFromNative = () => {
  const { endsAt } = useSleepTimer.getState();
  if (endsAt === null) return;
  try {
    const native = TrackPlayer.getSleepTimer();
    if (native?.type === 'time') {
      useSleepTimer.setState({ endsAt: Date.now() + native.remainingSeconds * 1000 });
    } else {
      forget();
    }
  } catch (error) {
    console.error('Error reading sleep timer:', error);
  }
};

/** On each new song: counts down, and pauses the one after the last. */
export const noteSongChangeForSleepTimer = () => {
  const { songsLeft } = useSleepTimer.getState();
  if (songsLeft === null) return;
  if (songsLeft > 1) {
    useSleepTimer.setState({ songsLeft: songsLeft - 1 });
    return;
  }
  forget();
  if (usePlayerStore.getState().activePlayerMode !== 'normal') return;
  try {
    TrackPlayer.pause();
  } catch (error) {
    console.error('Error pausing for sleep timer:', error);
  }
};

// A room isn't yours to stop for everyone, and its audio isn't yours to pause: joining one ends
// the timer.
usePlayerStore.subscribe((state, prev) => {
  if (state.activePlayerMode === 'group' && prev.activePlayerMode !== 'group') {
    const { endsAt, songsLeft } = useSleepTimer.getState();
    if (endsAt !== null || songsLeft !== null) clearSleepTimer();
  }
});

/** "23 min", "2 songs", "End of song", or null when off. */
export const sleepTimerLabel = ({ endsAt, songsLeft }: SleepTimerState, now = Date.now()) => {
  if (endsAt !== null) {
    return endsAt > now ? `${Math.max(1, Math.ceil((endsAt - now) / 60_000))} min` : null;
  }
  if (songsLeft === 1) return 'End of song';
  if (songsLeft !== null) return `${songsLeft} songs`;
  return null;
};
