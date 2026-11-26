import { create } from 'zustand';
import { usePlayerStore } from './playerStore';

/*
 * Stops your music after a while or after some songs. A JS timer can be held back while the app
 * is in the background, so the time is also checked on the native player's progress ticks
 * (every few seconds while playing) and the song count on each song change.
 */

interface SleepTimerState {
  /** When to pause, as a timestamp; null when not set by time. */
  endsAt: number | null;
  /** Songs still to play, the current one included; null when not set by songs. */
  songsLeft: number | null;
}

export const useSleepTimer = create<SleepTimerState>(() => ({ endsAt: null, songsLeft: null }));

let timer: ReturnType<typeof setTimeout> | null = null;

const clearTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};

export const clearSleepTimer = () => {
  clearTimer();
  useSleepTimer.setState({ endsAt: null, songsLeft: null });
};

/** Time's up: pause your own music (wherever it plays) and forget the timer. */
const fire = () => {
  clearSleepTimer();
  const player = usePlayerStore.getState();
  // A room isn't yours to stop for everyone; the timer just ends.
  if (player.activePlayerMode === 'normal' && player.isPlaying) player.handlePlayPause();
};

export const setSleepTimerMinutes = (minutes: number) => {
  clearTimer();
  const endsAt = Date.now() + minutes * 60_000;
  useSleepTimer.setState({ endsAt, songsLeft: null });
  timer = setTimeout(fire, minutes * 60_000);
};

/** 1 is "end of this song". */
export const setSleepTimerSongs = (songs: number) => {
  clearTimer();
  useSleepTimer.setState({ endsAt: null, songsLeft: songs });
};

/** On each progress tick: fires a time that passed while JS timers were held back. */
export const checkSleepTimer = () => {
  const { endsAt } = useSleepTimer.getState();
  if (endsAt !== null && Date.now() >= endsAt) fire();
};

/** On each new song: counts down, and pauses the one after the last. */
export const noteSongChangeForSleepTimer = () => {
  const { songsLeft } = useSleepTimer.getState();
  if (songsLeft === null) return;
  if (songsLeft <= 1) fire();
  else useSleepTimer.setState({ songsLeft: songsLeft - 1 });
};

/** "23 min", "2 songs", "End of song", or null when off. */
export const sleepTimerLabel = ({ endsAt, songsLeft }: SleepTimerState, now = Date.now()) => {
  if (endsAt !== null) return `${Math.max(1, Math.ceil((endsAt - now) / 60_000))} min`;
  if (songsLeft === 1) return 'End of song';
  if (songsLeft !== null) return `${songsLeft} songs`;
  return null;
};
