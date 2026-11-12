import { create } from 'zustand';
import type { Song } from '@/types/song';

/**
 * Your listening as the server shares it between your devices (see server/src/socket/player).
 * lib/player.ts keeps it up to date and makes the player follow it. The web has the same store
 * in client/src/stores/playerSessionStore.js: change them together.
 *
 * `playback.active` is the device that plays; every other one is a remote that shows its
 * progress. Until `live` (connected and caught up), the player works on its own as it always did.
 */

export interface PlayerDevice {
  deviceId: string;
  name: string;
  mobile: boolean;
}

export interface QueueItem {
  id: string;
  song: Song;
  autoplay?: boolean;
}

export interface Playback {
  rev: number;
  queueRev: number;
  itemId: string | null;
  song: Song | null;
  timeline: { playing: boolean; positionMs: number; anchorAt: number };
  jumps: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  autoplay: boolean;
  active: PlayerDevice | null;
  activeOnline: boolean;
  serverTime: number;
}

interface PlayerSessionState {
  live: boolean;
  deviceId: string | null;
  playback: Playback | null;
  items: QueueItem[];
  queueRev: number;
  devices: PlayerDevice[];
  /**
   * Catching up with your other devices, shown on the orb while the app opens: `syncing`
   * from connecting until the session arrives, then `synced`. `at` is when that attempt began.
   */
  sync: { state: 'idle' | 'syncing' | 'synced'; at: number };
}

export const usePlayerSessionStore = create<PlayerSessionState>(() => ({
  live: false,
  deviceId: null,
  playback: null,
  items: [],
  queueRev: 0,
  devices: [],
  sync: { state: 'idle', at: 0 },
}));

export const sessionState = () => usePlayerSessionStore.getState();

/** The device playing, if it's another one: this one is then a remote control. */
export const remoteDeviceOf = ({ live, playback, deviceId }: PlayerSessionState) =>
  live && playback?.active && playback.active.deviceId !== deviceId ? playback.active : null;

export const useRemoteDevice = () => usePlayerSessionStore(remoteDeviceOf);
