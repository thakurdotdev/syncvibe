import { create } from 'zustand';

/**
 * Your listening as the server shares it between your devices (see server/src/socket/player).
 * lib/player.js keeps it up to date and makes the player follow it. The app has the same store
 * in app/stores/playerSessionStore.ts: change them together.
 *
 * `playback.active` is the device that plays; every other one is a remote that shows its
 * progress. Until `live` (connected and caught up), the player works on its own as it always did.
 */
export const usePlayerSessionStore = create(() => ({
  live: false,
  deviceId: null,
  playback: null,
  /** Queue items `{ id, song }` in play order, as of `queueRev`. */
  items: [],
  queueRev: 0,
  /** Your devices online now: `{ deviceId, name, mobile }`. */
  devices: [],
  /** Playback moved here, but the browser won't start sound until the page is tapped. */
  needsTap: false,
}));

export const sessionState = () => usePlayerSessionStore.getState();

/** The device playing, if it's another one: this one is then a remote control. */
export const remoteDeviceOf = ({ live, playback, deviceId }) =>
  live && playback?.active && playback.active.deviceId !== deviceId ? playback.active : null;

export const useRemoteDevice = () => usePlayerSessionStore(remoteDeviceOf);
export const usePlayerDevices = () => usePlayerSessionStore((s) => s.devices);
