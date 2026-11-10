/* oxlint-disable jsx-a11y/media-has-caption -- a live voice has no captions */
import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useCallStore } from '@/stores/callStore';
import CallScreen from './CallScreen';
import IncomingCall from './IncomingCall';

/**
 * Everything a call puts on screen, over whatever page the user is on: the incoming-call card,
 * the call itself (full screen or as a small floating tile), and the other person's voice.
 */
const CallLayer = () => {
  const phase = useCallStore((s) => s.phase);
  const peer = useCallStore((s) => s.peer);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const audioRef = useRef(null);

  // Played here and not by the video, so the voice carries on when the picture is swapped,
  // minimised or switched off.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = remoteStream ?? null;
    if (remoteStream) audio.play().catch(() => {});
  }, [remoteStream]);

  return (
    <>
      <audio ref={audioRef} autoPlay className='hidden' />
      <AnimatePresence>
        {phase === 'incoming' && <IncomingCall key='incoming' person={peer} />}
        {phase !== 'idle' && phase !== 'incoming' && <CallScreen key='call' />}
      </AnimatePresence>
    </>
  );
};

export default CallLayer;
