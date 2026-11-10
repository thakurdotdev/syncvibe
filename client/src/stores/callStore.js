import { create } from 'zustand';

/**
 * What the screen shows of a video call. It only holds state: everything that happens to a call
 * (the server, the camera, the connection) is in lib/call, which writes here.
 *
 * phase:
 *   idle          no call
 *   incoming      someone is calling, not answered yet
 *   outgoing      calling someone, not answered yet (`ringing` once a device of theirs rings)
 *   connecting    answered; the two browsers are finding each other
 *   connected     video is flowing
 *   reconnecting  it was connected and the connection dropped; being repaired
 *   ended         over; shown briefly with `endMessage` before going back to idle
 */
const IDLE = {
  phase: 'idle',
  callId: null,
  /** The other person: { userid, name, username, profilepic }. */
  peer: null,
  ringing: false,
  localStream: null,
  remoteStream: null,
  micOn: true,
  cameraOn: true,
  /** Whether the camera in use faces the user, so the self view is mirrored. */
  mirrored: true,
  canFlipCamera: false,
  peerMicOn: true,
  peerCameraOn: true,
  /** good | fair | poor, once there is something to measure. */
  quality: null,
  connectedAt: null,
  endMessage: null,
  minimized: false,
};

export const useCallStore = create((set) => ({
  ...IDLE,
  patch: (changes) => set(changes),
  reset: () => set(IDLE),
  setMinimized: (minimized) => set({ minimized }),
}));

/** Whether a call occupies this tab, so another can't be started. */
export const selectBusy = (state) => state.phase !== 'idle' && state.phase !== 'ended';
