import { create } from 'zustand';

/*
 * Moments: everything that happens while you're in the app (a message, a room invite, "Saved")
 * shows in one place, growing out of the header's pill, one at a time. A moment with the same
 * key as the one showing replaces it and starts its time again.
 */

export type MomentLeading =
  | { kind: 'avatar'; name: string; pic?: string | null }
  | { kind: 'image'; uri: string }
  | { kind: 'icon'; icon: 'success' | 'error' | 'info' };

export interface Moment {
  key: string;
  title: string;
  subtitle?: string;
  leading?: MomentLeading;
  /** One button at the end. Pressing it also puts the moment away. */
  action?: { label: string; onPress: () => void };
  /** Tapping the moment itself. */
  onPress?: () => void;
  duration: number;
  /** Screens that already show this (the conversation, the Rooms tab): it's skipped there. */
  hideOn?: (pathname: string) => boolean;
  /** How many times it has come in while showing (messages from one person). */
  count: number;
  /** Changes each time it comes in, which restarts its time. */
  stamp: number;
}

export type MomentInput = Omit<Moment, 'count' | 'stamp'>;

/** Waiting behind the one showing; older ones beyond this are dropped. */
const MAX_WAITING = 5;

interface IslandState {
  current: Moment | null;
  queue: Moment[];
  /** The one showing has finished leaving: bring the next one. */
  next: () => void;
}

export const useIslandStore = create<IslandState>((set) => ({
  current: null,
  queue: [],
  next: () => set((s) => ({ current: s.queue[0] ?? null, queue: s.queue.slice(1) })),
}));

let stamp = 0;

export const showMoment = (input: MomentInput) => {
  const { current, queue } = useIslandStore.getState();
  stamp += 1;
  if (current?.key === input.key) {
    useIslandStore.setState({ current: { ...input, count: current.count + 1, stamp } });
    return;
  }
  const waiting = queue.find((m) => m.key === input.key);
  const moment: Moment = { ...input, count: (waiting?.count ?? 0) + 1, stamp };
  if (!current) {
    useIslandStore.setState({ current: moment });
    return;
  }
  useIslandStore.setState({
    queue: [...queue.filter((m) => m.key !== input.key), moment].slice(-MAX_WAITING),
  });
};

/** Takes a moment off the queue (an invite answered somewhere else, say). */
export const dropMoment = (key: string) => {
  const { current, queue } = useIslandStore.getState();
  useIslandStore.setState({ queue: queue.filter((m) => m.key !== key) });
  if (current?.key === key)
    useIslandStore.setState({ current: { ...current, duration: 0, stamp: ++stamp } });
};
