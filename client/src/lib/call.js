import { toast } from 'sonner';
import { selectBusy, useCallStore } from '@/stores/callStore';
import {
  MediaError,
  countCameras,
  openCamera,
  openMedia,
  startRinging,
  stopRinging,
  stopStream,
} from './callMedia';
import { createCallPeer } from './callPeer';

/**
 * Video calls, talking to the server. The server owns the call (who is in it, ringing or
 * answered, when it ends); this tab asks for changes with commands that are always answered and
 * follows the events it is sent. The protocol is described in server/src/socket/call.ts. The
 * video itself goes browser to browser (lib/callPeer). What the screen shows is in the call store.
 */

const COMMAND_TIMEOUT_MS = 12000;
/** Answered, but the two browsers never found each other. */
const CONNECT_TIMEOUT_MS = 30000;
/** It was connected, dropped, and didn't come back. */
const RECONNECT_TIMEOUT_MS = 30000;
/** How long "Call ended" and the like stay on screen. */
const ENDED_SHOWN_MS = 1800;

const store = () => useCallStore.getState();
const patch = (changes) => store().patch(changes);

let socket = null;
/**
 * The call this tab is taking part in: its camera and its connection. A tab that is only ringing
 * has none. Replaced, never reused, so anything still waiting on an old call can tell.
 */
let session = null;
let endedTimer = null;
let notification = null;

class CallError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const command = async (event, payload) => {
  if (!socket?.connected) throw new CallError('OFFLINE', "You're offline");
  let reply;
  try {
    reply = await socket.timeout(COMMAND_TIMEOUT_MS).emitWithAck(event, payload);
  } catch {
    throw new CallError('TIMEOUT', 'No answer from the server');
  }
  if (!reply?.ok) {
    throw new CallError(reply?.code || 'INTERNAL', reply?.message || 'Something went wrong');
  }
  return reply;
};

const newSession = (role) => ({
  role,
  id: null,
  token: null,
  stream: null,
  peer: null,
  /** Messages from the other browser that arrived before the connection here existed. */
  pending: [],
  facingMode: 'user',
  switchingCamera: false,
  watchdog: null,
});

// ── Ending ──────────────────────────────────────────────────────────────────

const closeNotification = () => {
  notification?.close();
  notification = null;
};

/** Lets go of the camera, the microphone and the connection. */
const release = () => {
  stopRinging();
  closeNotification();
  if (!session) return;
  clearTimeout(session.watchdog);
  session.peer?.close();
  stopStream(session.stream);
  session = null;
};

/** The call is over here. With a message it stays on screen for a moment saying so. */
const finish = (message = null) => {
  release();
  clearTimeout(endedTimer);
  if (!message) {
    store().reset();
    return;
  }
  patch({
    phase: 'ended',
    endMessage: message,
    ringing: false,
    localStream: null,
    remoteStream: null,
    quality: null,
  });
  endedTimer = setTimeout(() => {
    if (store().phase === 'ended') store().reset();
  }, ENDED_SHOWN_MS);
};

const hangUpOnServer = (callId) => {
  if (callId) command('call:end', { callId }).catch(() => {});
};

/** Gives up on a call that isn't getting (back) to a working connection. */
const armWatchdog = (mine, ms, message) => {
  clearTimeout(mine.watchdog);
  mine.watchdog = setTimeout(() => {
    if (session !== mine || mine.peer?.isConnected()) return;
    hangUpOnServer(mine.id);
    finish(message);
  }, ms);
};

// ── Camera, microphone, connection ──────────────────────────────────────────

const adoptStream = (mine, stream) => {
  mine.stream = stream;
  patch({
    localStream: stream,
    micOn: stream.getAudioTracks().length > 0,
    cameraOn: stream.getVideoTracks().length > 0,
    mirrored: true,
  });
  // Switching cameras is a phone thing; a laptop with two webcams rarely wants it mid-call.
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    void countCameras().then((count) => {
      if (session === mine) patch({ canFlipCamera: count > 1 });
    });
  }
};

const signal = (mine, data) => {
  if (socket?.connected && mine.id) socket.emit('call:signal', { callId: mine.id, data });
};

/** The other side shows a picture or a muted mark from this, instead of guessing from the video. */
const sendMediaState = (mine) => {
  const { micOn, cameraOn } = store();
  signal(mine, { media: { audio: micOn, video: cameraOn } });
};

const connect = (mine, iceServers) => {
  mine.peer = createCallPeer({
    iceServers,
    polite: mine.role === 'callee',
    stream: mine.stream,
    send: (data) => signal(mine, data),
    onRemoteStream: (remoteStream) => {
      if (session === mine) patch({ remoteStream });
    },
    onState: (state) => {
      if (session !== mine) return;
      if (state === 'connected') {
        clearTimeout(mine.watchdog);
        patch({ phase: 'connected', connectedAt: store().connectedAt ?? Date.now() });
        sendMediaState(mine);
      } else if (state === 'reconnecting' && store().phase === 'connected') {
        patch({ phase: 'reconnecting', quality: null });
        armWatchdog(mine, RECONNECT_TIMEOUT_MS, 'Connection lost');
      }
    },
    onQuality: (quality) => {
      if (session === mine && store().phase === 'connected') patch({ quality });
    },
  });
  for (const data of mine.pending.splice(0)) mine.peer.receive(data);
};

// ── What the user does ──────────────────────────────────────────────────────

export const startCall = async (person) => {
  if (session || selectBusy(store())) return;
  if (!person?.userid) return;
  if (!socket?.connected) {
    toast.error("You're offline");
    return;
  }

  clearTimeout(endedTimer);
  const mine = (session = newSession('caller'));
  store().reset();
  patch({
    phase: 'outgoing',
    peer: {
      userid: person.userid,
      name: person.name,
      username: person.username,
      profilepic: person.profilepic ?? null,
    },
  });

  try {
    const stream = await openMedia();
    if (session !== mine) {
      stopStream(stream);
      return;
    }
    adoptStream(mine, stream);

    const reply = await command('call:start', { to: person.userid });
    if (session !== mine) {
      // Cancelled while the server was starting it.
      hangUpOnServer(reply.call.id);
      return;
    }
    mine.id = reply.call.id;
    patch({ callId: reply.call.id, peer: reply.call.peer });
    // Made now, so routes are being found while the other side is still ringing.
    connect(mine, reply.iceServers);
  } catch (error) {
    if (session !== mine) return;
    if (error.code === 'BUSY') {
      finish(error.message);
      return;
    }
    finish();
    toast.error(error.message || "Couldn't start the call");
  }
};

export const acceptCall = async () => {
  const { phase, callId } = store();
  if (phase !== 'incoming' || session) return;

  stopRinging();
  closeNotification();
  const mine = (session = newSession('callee'));
  mine.id = callId;
  patch({ phase: 'connecting' });

  try {
    const stream = await openMedia();
    if (session !== mine) {
      stopStream(stream);
      return;
    }
    adoptStream(mine, stream);

    const reply = await command('call:accept', { callId });
    if (session !== mine) return;
    mine.token = reply.token;
    connect(mine, reply.iceServers);
    armWatchdog(mine, CONNECT_TIMEOUT_MS, "Couldn't connect");
  } catch (error) {
    if (session !== mine) return;
    if (error instanceof MediaError) {
      // Nothing was answered yet, so it keeps ringing: they can allow the camera and try again.
      release();
      patch({ phase: 'incoming', localStream: null });
      startRinging('incoming');
      toast.error(error.message);
      return;
    }
    finish();
    toast.error(error.code === 'GONE' ? 'That call has already ended' : error.message);
  }
};

/** Hang up, decline, or stop calling: whichever applies. */
export const endCall = () => {
  const { phase, callId } = store();
  if (phase === 'idle' || phase === 'ended') return;
  hangUpOnServer(callId);
  finish(phase === 'incoming' || phase === 'outgoing' ? null : 'Call ended');
};

export const toggleMic = () => {
  const mine = session;
  const track = mine?.stream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  patch({ micOn: track.enabled });
  sendMediaState(mine);
};

/** The camera is stopped, not just blanked, so its light goes off. */
export const toggleCamera = async () => {
  const mine = session;
  if (!mine?.stream || mine.switchingCamera) return;
  mine.switchingCamera = true;
  try {
    const current = mine.stream.getVideoTracks()[0];
    if (current) {
      current.stop();
      mine.stream.removeTrack(current);
      await mine.peer?.setTrack('video', null);
      patch({ cameraOn: false });
    } else {
      const track = await openCamera(mine.facingMode);
      if (session !== mine) {
        track.stop();
        return;
      }
      mine.stream.addTrack(track);
      await mine.peer?.setTrack('video', track);
      patch({ cameraOn: true });
    }
    sendMediaState(mine);
  } catch (error) {
    if (session === mine) toast.error(error.message || "Couldn't change the camera");
  } finally {
    mine.switchingCamera = false;
  }
};

/** Front camera to back camera and the other way, on phones. */
export const flipCamera = async () => {
  const mine = session;
  const current = mine?.stream?.getVideoTracks()[0];
  if (!current || mine.switchingCamera) return;
  mine.switchingCamera = true;
  const next = mine.facingMode === 'user' ? 'environment' : 'user';
  try {
    // Most phones can't open a second camera while the first is in use.
    current.stop();
    mine.stream.removeTrack(current);
    let track;
    try {
      track = await openCamera(next);
      mine.facingMode = next;
    } catch {
      track = await openCamera(mine.facingMode);
    }
    if (session !== mine) {
      track.stop();
      return;
    }
    mine.stream.addTrack(track);
    await mine.peer?.setTrack('video', track);
    patch({ mirrored: mine.facingMode === 'user' });
  } catch (error) {
    if (session === mine) {
      patch({ cameraOn: false });
      sendMediaState(mine);
      toast.error(error.message || "Couldn't switch the camera");
    }
  } finally {
    mine.switchingCamera = false;
  }
};

// ── Socket ──────────────────────────────────────────────────────────────────

const END_MESSAGES = {
  ended: 'Call ended',
  missed: 'No answer',
  cancelled: 'Call ended',
  disconnected: 'Connection lost',
};

const notify = (person) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  try {
    notification = new Notification(`${person.name} is calling`, {
      body: 'Incoming video call',
      tag: 'incoming-call',
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      closeNotification();
    };
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
};

const onIncoming = (payload, confirm) => {
  const call = payload?.call;
  if (!call?.id || !call.peer) return;
  // Not confirmed when this tab can't ring; another tab or device may.
  if (session || selectBusy(store())) return;

  clearTimeout(endedTimer);
  store().reset();
  patch({ phase: 'incoming', callId: call.id, peer: call.peer });
  if (typeof confirm === 'function') confirm();
  startRinging('incoming');
  notify(call.peer);
};

const onRinging = ({ callId } = {}) => {
  if (!session || session.id !== callId || store().phase !== 'outgoing') return;
  patch({ ringing: true });
  startRinging('outgoing');
};

const onAccepted = ({ callId, token } = {}) => {
  const mine = session;
  if (!mine || mine.id !== callId || mine.role !== 'caller') return;
  if (store().phase !== 'outgoing') return;
  stopRinging();
  mine.token = token;
  patch({ phase: 'connecting', ringing: false });
  mine.peer?.start();
  armWatchdog(mine, CONNECT_TIMEOUT_MS, "Couldn't connect");
};

const onSignal = ({ callId, data } = {}) => {
  const mine = session;
  if (!mine || mine.id !== callId || !data) return;
  if (data.media) {
    patch({ peerMicOn: data.media.audio !== false, peerCameraOn: data.media.video !== false });
  } else if (mine.peer) {
    mine.peer.receive(data);
  } else {
    mine.pending.push(data);
  }
};

const onPeer = ({ callId, connected } = {}) => {
  const mine = session;
  if (!mine || mine.id !== callId) return;
  if (connected) {
    mine.peer?.resync();
    sendMediaState(mine);
  }
};

const onEnded = ({ callId, reason } = {}) => {
  const { phase, callId: current, peer } = store();
  if (!callId || callId !== current || phase === 'ended') return;

  if (reason === 'answered_elsewhere') {
    if (phase === 'incoming') finish();
    return;
  }
  // A call that was only ringing here just goes away; the conversation shows it as missed.
  if (phase === 'incoming') {
    finish();
    return;
  }
  finish(
    reason === 'declined'
      ? `${peer?.name?.split(' ')[0] || 'They'} declined`
      : END_MESSAGES[reason] || 'Call ended'
  );
};

/**
 * On every connection after the first: this tab's place in the call belonged to the connection
 * that dropped. The new one takes it over, and finds out what happened meanwhile.
 */
const resume = async () => {
  const { phase, callId } = store();
  if (!callId || phase === 'idle' || phase === 'ended') return;
  const mine = session;

  try {
    const reply = await command('call:rejoin', { callId, token: mine?.token });
    if (store().callId !== callId || session !== mine || !mine) return;

    if (reply.state === 'active' && store().phase === 'outgoing') {
      // Answered while we were away.
      onAccepted({ callId, token: reply.token });
    } else if (reply.state === 'active') {
      mine.peer?.resync();
      sendMediaState(mine);
    }
  } catch (error) {
    if (error.code !== 'GONE' || store().callId !== callId) return;
    finish(phase === 'incoming' ? null : 'Call ended');
  }
};

/** Starts listening on a connected-or-connecting socket. Returns a function that stops. */
export const bindCallSocket = (nextSocket) => {
  socket = nextSocket;

  const listeners = {
    connect: resume,
    'call:incoming': onIncoming,
    'call:ringing': onRinging,
    'call:accepted': onAccepted,
    'call:signal': onSignal,
    'call:peer': onPeer,
    'call:ended': onEnded,
  };
  for (const [event, listener] of Object.entries(listeners)) nextSocket.on(event, listener);

  // Wi-Fi to mobile data and the like: the old route is dead even if nobody noticed yet.
  const onOnline = () => {
    if (session?.peer && !session.peer.isConnected()) session.peer.restart();
  };
  // Closing the tab: say so, instead of leaving the other side to wait for a timeout.
  const onPageHide = () => {
    const { phase, callId } = store();
    if (callId && session && phase !== 'incoming') nextSocket.emit('call:end', { callId });
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    for (const [event, listener] of Object.entries(listeners)) nextSocket.off(event, listener);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('pagehide', onPageHide);
    // Signing out mid-call hangs up.
    if (session?.id && nextSocket.connected) nextSocket.emit('call:end', { callId: session.id });
    finish();
    if (socket === nextSocket) socket = null;
  };
};
