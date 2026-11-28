import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { usePlayerStore } from '@/stores/playerStore';

const VOICE_MAX_MS = 10 * 60 * 1000;
const VOICE_MIN_MS = 1000;
const TICK_MS = 200;

/** What this browser can record, best first, with the extension the server knows it by. */
const FORMATS = [
  { mime: 'audio/webm;codecs=opus', ext: 'weba' },
  { mime: 'audio/webm', ext: 'weba' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  { mime: 'audio/mp4', ext: 'm4a' },
];

const pickFormat = () =>
  typeof MediaRecorder === 'undefined'
    ? null
    : (FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mime)) ?? null);

export const canRecordVoice = () =>
  Boolean(navigator.mediaDevices?.getUserMedia) && pickFormat() !== null;

/**
 * Records a voice message. The microphone is asked for only when `start` is clicked. `send`
 * hands the recording over as `{ file, kind, durationSec }`, ready for sendMessage; `cancel`
 * throws it away. Music you're playing pauses while you record.
 */
export const useVoiceNote = (onRecorded) => {
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const session = useRef(null);

  const release = () => {
    const current = session.current;
    session.current = null;
    if (!current) return;
    clearInterval(current.timer);
    current.stream.getTracks().forEach((track) => track.stop());
  };

  const finish = useCallback(
    (send) => {
      const current = session.current;
      if (!current) return;
      const elapsed = Date.now() - current.startedAt;
      current.recorder.onstop = () => {
        const { chunks, format } = current;
        release();
        if (!send) return;
        if (elapsed < VOICE_MIN_MS) {
          toast('Too short to send. Record a little longer.');
          return;
        }
        const type = format.mime.split(';')[0];
        const file = new File([new Blob(chunks, { type })], `voice-message.${format.ext}`, {
          type,
        });
        onRecorded({ file, kind: 'audio', durationSec: Math.max(1, Math.round(elapsed / 1000)) });
      };
      setRecording(false);
      setDurationMs(0);
      if (current.recorder.state !== 'inactive') current.recorder.stop();
      else current.recorder.onstop();
    },
    [onRecorded]
  );

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const start = useCallback(async () => {
    if (session.current) return;
    const format = pickFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      toast.error("This browser can't record voice messages");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      toast.error(
        error?.name === 'NotAllowedError'
          ? 'Allow the microphone for this site to record voice messages'
          : "Couldn't find a microphone to record with"
      );
      return;
    }

    const player = usePlayerStore.getState();
    if (player.isPlaying) player.handlePlayPause();

    const recorder = new MediaRecorder(stream, {
      mimeType: format.mime,
      audioBitsPerSecond: 64000,
    });
    const current = { recorder, stream, format, chunks: [], startedAt: Date.now(), timer: null };
    recorder.ondataavailable = (event) => event.data.size && current.chunks.push(event.data);
    current.timer = setInterval(() => {
      const elapsed = Date.now() - current.startedAt;
      setDurationMs(elapsed);
      if (elapsed >= VOICE_MAX_MS) finishRef.current(true);
    }, TICK_MS);
    session.current = current;
    recorder.start(1000);
    setDurationMs(0);
    setRecording(true);
  }, []);

  // Leaving the chat mid-recording throws it away and lets go of the microphone.
  useEffect(() => () => finishRef.current(false), []);

  return {
    recording,
    durationMs,
    start,
    send: () => finish(true),
    cancel: () => finish(false),
  };
};
