/**
 * The camera, the microphone and the ringing sounds of a video call.
 */

/**
 * 720p at 30 frames is asked for, not required: the browser lowers what it sends by itself when
 * the connection can't carry it, and does that better than fixed low settings would.
 */
const videoConstraints = (facingMode) => ({
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: facingMode || 'user',
});

const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/** Tells the encoder what matters in each track when it has to give something up. */
const hint = (stream) => {
  for (const track of stream.getVideoTracks()) track.contentHint = 'motion';
  for (const track of stream.getAudioTracks()) track.contentHint = 'speech';
  return stream;
};

export class MediaError extends Error {}

const explain = (error) => {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Allow the camera and microphone for this site to make calls';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') {
    return 'No camera or microphone was found';
  }
  if (error?.name === 'NotReadableError') {
    return 'The camera or microphone is being used by another app';
  }
  return "Couldn't use the camera or microphone";
};

/**
 * Camera and microphone together. If one of them can't be had (no camera, or it is in use), the
 * call goes ahead with the other; it fails only with neither.
 */
export const openMedia = async (facingMode = 'user') => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new MediaError("This browser can't make video calls");
  }
  try {
    return hint(
      await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(facingMode),
        audio: AUDIO,
      })
    );
  } catch (both) {
    // Refusing permission refuses both; asking again would only show the prompt twice.
    if (both?.name === 'NotAllowedError') throw new MediaError(explain(both));
    try {
      return hint(await navigator.mediaDevices.getUserMedia({ audio: AUDIO }));
    } catch {
      try {
        return hint(
          await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facingMode) })
        );
      } catch {
        throw new MediaError(explain(both));
      }
    }
  }
};

/** Just a camera track, for turning the camera back on or switching to the other one. */
export const openCamera = async (facingMode = 'user') => {
  try {
    const stream = hint(
      await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facingMode) })
    );
    return stream.getVideoTracks()[0];
  } catch (error) {
    throw new MediaError(explain(error));
  }
};

export const stopStream = (stream) => {
  for (const track of stream?.getTracks() ?? []) track.stop();
};

export const countCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'videoinput').length;
  } catch {
    return 0;
  }
};

// ── Ringing ─────────────────────────────────────────────────────────────────

let audioContext = null;
let ringTimer = null;

const beep = (context, at, frequencies, seconds, volume) => {
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.03);
  gain.gain.setValueAtTime(volume, at + seconds - 0.05);
  gain.gain.linearRampToValueAtTime(0, at + seconds);
  for (const frequency of frequencies) {
    const tone = context.createOscillator();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    tone.connect(gain);
    tone.start(at);
    tone.stop(at + seconds);
  }
};

const PATTERNS = {
  // Two short notes, repeated: someone is calling you.
  incoming: {
    every: 2400,
    play: (context, now) => {
      beep(context, now, [784, 988], 0.32, 0.09);
      beep(context, now + 0.42, [784, 988], 0.32, 0.09);
    },
  },
  // One long low tone: their device is ringing.
  outgoing: {
    every: 3600,
    play: (context, now) => beep(context, now, [440, 480], 1.2, 0.04),
  },
};

/**
 * Made with Web Audio, so there is no sound file to load. A browser may refuse sound in a tab the
 * user hasn't touched yet; the call still shows, it just doesn't ring.
 */
export const startRinging = (kind) => {
  stopRinging();
  const pattern = PATTERNS[kind];
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!pattern || !Context) return;
  try {
    audioContext ??= new Context();
    const context = audioContext;
    const play = () => {
      if (context.state === 'running') pattern.play(context, context.currentTime);
    };
    const timer = setInterval(play, pattern.every);
    ringTimer = timer;
    // The first notes wait for the browser to let the sound through, unless ringing stopped first.
    Promise.resolve(context.resume?.())
      .then(() => ringTimer === timer && play())
      .catch(() => {});
  } catch {
    // No sound, then.
  }
};

export const stopRinging = () => {
  clearInterval(ringTimer);
  ringTimer = null;
  // Suspending cuts a note that is still playing.
  if (audioContext?.state === 'running') void audioContext.suspend();
};
