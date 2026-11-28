import { toast } from '@/context/ToastContext';
import { VOICE_MESSAGE_NAME } from '@/lib/attachments';
import type { PickedFile } from '@/lib/chat';
import { usePlayerStore } from '@/stores/playerStore';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** A voice: one channel at a speech bit rate keeps a minute well under a megabyte. */
const VOICE_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

export const VOICE_MAX_MS = 10 * 60 * 1000;
const VOICE_MIN_MS = 1000;

const discard = (uri: string | null) => {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone: the system clears the cache folder too.
  }
};

/**
 * Records a voice message. `start` asks for the microphone the first time; `send` hands the
 * recording over as a file to send like any other, `cancel` throws it away. Music you're playing
 * pauses while you record.
 */
export const useVoiceNote = (onRecorded: (file: PickedFile) => void) => {
  const recorder = useAudioRecorder(VOICE_OPTIONS);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const busy = useRef(false);

  const start = useCallback(async () => {
    if (busy.current || recording) return;
    busy.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        toast('Allow SyncVibe to use the microphone in your phone settings', { type: 'error' });
        return;
      }
      const player = usePlayerStore.getState();
      if (player.isPlaying && player.activePlayerMode === 'normal') player.handlePlayPause();
      await setAudioModeAsync({ allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch (error) {
      console.error('Starting a voice message failed:', error);
      toast("Couldn't start recording. Try again.", { type: 'error' });
    } finally {
      busy.current = false;
    }
  }, [recorder, recording]);

  const finish = useCallback(
    async (send: boolean) => {
      if (busy.current || !recording) return;
      busy.current = true;
      let durationMs = 0;
      try {
        durationMs = recorder.getStatus().durationMillis;
        await recorder.stop();
      } catch (error) {
        console.error('Stopping a voice message failed:', error);
      }
      setRecording(false);
      busy.current = false;
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});

      const uri = recorder.uri;
      if (!send || !uri) {
        discard(uri);
        return;
      }
      if (durationMs < VOICE_MIN_MS) {
        discard(uri);
        toast('Too short to send. Record a little longer.');
        return;
      }
      let size = 0;
      try {
        size = new File(uri).size ?? 0;
      } catch {
        // Measured again by the upload; a size of 0 only hides it in the bubble meanwhile.
      }
      onRecorded({
        key: uri,
        uri,
        name: VOICE_MESSAGE_NAME,
        size,
        kind: 'audio',
        durationSec: Math.max(1, Math.round(durationMs / 1000)),
      });
    },
    [recorder, recording, onRecorded]
  );

  // The longest a voice message goes: it's sent when it gets there.
  useEffect(() => {
    if (recording && state.durationMillis >= VOICE_MAX_MS) void finish(true);
  }, [recording, state.durationMillis, finish]);

  // Recording stops with the app in the background: what was said so far is thrown away.
  useEffect(() => {
    if (!recording) return undefined;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        void finish(false);
        toast('Recording stopped');
      }
    });
    return () => subscription.remove();
  }, [recording, finish]);

  // Leaving the chat mid-recording throws it away.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);
  useEffect(() => () => void finishRef.current(false), []);

  return {
    recording,
    durationMs: recording ? state.durationMillis : 0,
    start,
    send: () => finish(true),
    cancel: () => finish(false),
  };
};
