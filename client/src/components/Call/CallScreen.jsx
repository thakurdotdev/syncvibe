/* oxlint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/prefer-tag-over-role -- the stage is tapped to show or hide the controls, which are all real buttons */
import { motion } from 'framer-motion';
import {
  ChevronDown,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  Signal,
  SignalLow,
  SignalMedium,
  SwitchCamera,
  Video,
  VideoOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfile } from '@/Context/Context';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { endCall, flipCamera, toggleCamera, toggleMic } from '@/lib/call';
import { FADE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useCallStore } from '@/stores/callStore';
import { CallAvatar, CallTimer, CallVideo, FloatingTile } from './CallParts';

const HIDE_CONTROLS_AFTER_MS = 3500;

const firstName = (person) => person?.name?.split(' ')[0] || 'They';

/** One line saying where the call is: calling, ringing, how long it has lasted, how it ended. */
const CallStatus = () => {
  const phase = useCallStore((s) => s.phase);
  const ringing = useCallStore((s) => s.ringing);
  const connectedAt = useCallStore((s) => s.connectedAt);
  const endMessage = useCallStore((s) => s.endMessage);

  if (phase === 'ended') return endMessage;
  if (phase === 'outgoing') return ringing ? 'Ringing…' : 'Calling…';
  if (phase === 'reconnecting') return 'Reconnecting…';
  if (phase === 'connected' && connectedAt) return <CallTimer since={connectedAt} />;
  return 'Connecting…';
};

const QUALITY = {
  good: { Icon: Signal, label: 'Good connection' },
  fair: { Icon: SignalMedium, label: 'Unsteady connection' },
  poor: { Icon: SignalLow, label: 'Weak connection' },
};

const ControlButton = ({ label, on = true, danger = false, onClick, className, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type='button'
        aria-label={label}
        onClick={onClick}
        className={cn(
          'press grid h-13 w-13 shrink-0 cursor-pointer place-items-center rounded-full backdrop-blur-md sm:h-14 sm:w-14',
          danger
            ? 'w-[4.5rem] bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-20'
            : on
              ? 'bg-on-scrim/15 text-on-scrim hover:bg-on-scrim/25'
              : 'bg-on-scrim text-scrim hover:bg-on-scrim/90',
          className
        )}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent className='z-[70]'>{label}</TooltipContent>
  </Tooltip>
);

/** Shown in place of a picture: before the call connects, or when a camera is off. */
const Presence = ({ person, calling = false, note }) => (
  <div className='absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center'>
    <div className='relative'>
      {calling && (
        <>
          <span className='absolute inset-0 animate-ping rounded-full bg-on-scrim/15 [animation-duration:2s]' />
          <span className='absolute -inset-3 animate-pulse rounded-full border border-on-scrim/15' />
        </>
      )}
      <CallAvatar
        person={person}
        className='relative h-28 w-28 sm:h-36 sm:w-36'
        textClassName='text-4xl sm:text-5xl'
      />
    </div>
    <div>
      <p className='text-2xl font-semibold tracking-tight sm:text-3xl'>{person?.name}</p>
      <p className='mt-1.5 text-sm text-on-scrim/70 sm:text-base' aria-live='polite'>
        {note ?? <CallStatus />}
      </p>
    </div>
  </div>
);

/** The call shrunk to a tile, so the rest of the app can be used while talking. */
const MiniCall = ({ peer, picture }) => {
  const micOn = useCallStore((s) => s.micOn);
  const setMinimized = useCallStore((s) => s.setMinimized);

  return (
    <FloatingTile
      startCorner='bottom-right'
      inset={{ top: 16, bottom: 96, left: 16, right: 16 }}
      onTap={() => setMinimized(false)}
      label='Return to the call'
      className='z-[55] aspect-video w-48 text-on-scrim sm:w-64'
    >
      {picture ?? (
        <div className='grid h-full w-full place-items-center pb-6'>
          <CallAvatar person={peer} className='h-12 w-12' textClassName='text-lg' />
        </div>
      )}
      <div className='absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-scrim/85 to-transparent p-2 pt-6'>
        <p className='min-w-0 flex-1 truncate text-xs font-medium'>
          {firstName(peer)} · <CallStatus />
        </p>
        <div data-no-drag className='flex shrink-0 gap-1.5'>
          <button
            type='button'
            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            onClick={toggleMic}
            className={cn(
              'press grid h-8 w-8 cursor-pointer place-items-center rounded-full',
              micOn ? 'bg-on-scrim/20 text-on-scrim' : 'bg-on-scrim text-scrim'
            )}
          >
            {micOn ? <Mic className='h-4 w-4' /> : <MicOff className='h-4 w-4' />}
          </button>
          <button
            type='button'
            aria-label='End call'
            onClick={endCall}
            className='press grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-destructive text-destructive-foreground'
          >
            <PhoneOff className='h-4 w-4' />
          </button>
        </div>
      </div>
    </FloatingTile>
  );
};

const CallScreen = () => {
  const { user: me } = useProfile();
  const phase = useCallStore((s) => s.phase);
  const peer = useCallStore((s) => s.peer);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const micOn = useCallStore((s) => s.micOn);
  const cameraOn = useCallStore((s) => s.cameraOn);
  const mirrored = useCallStore((s) => s.mirrored);
  const canFlipCamera = useCallStore((s) => s.canFlipCamera);
  const peerMicOn = useCallStore((s) => s.peerMicOn);
  const peerCameraOn = useCallStore((s) => s.peerCameraOn);
  const quality = useCallStore((s) => s.quality);
  const minimized = useCallStore((s) => s.minimized);
  const setMinimized = useCallStore((s) => s.setMinimized);

  const containerRef = useRef(null);
  const hideTimer = useRef(null);
  const [swapped, setSwapped] = useState(false);
  const [controlsHidden, setHiddenRaw] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const live = phase === 'connected' || phase === 'reconnecting';
  // Only a running call hides them; while calling or connecting they stay.
  const controlsShown = !controlsHidden || !live;
  const setControlsShown = (shown) => setHiddenRaw(!shown);
  const ended = phase === 'ended';
  const hasLocalPicture = Boolean(localStream) && cameraOn;
  const hasRemotePicture = live && Boolean(remoteStream) && peerCameraOn;

  const hideSoon = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsShown(false), HIDE_CONTROLS_AFTER_MS);
  }, []);

  // The controls step aside while the call is running and come back on any movement.
  const wake = () => {
    setControlsShown(true);
    if (live) hideSoon();
  };

  useEffect(() => {
    if (live) hideSoon();
    return () => clearTimeout(hideTimer.current);
  }, [live, hideSoon]);

  useEffect(() => {
    if (!live) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [live]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current?.requestFullscreen?.().catch(() => {});
  };

  const minimize = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setMinimized(true);
  };

  const remotePicture = (className) =>
    hasRemotePicture ? <CallVideo stream={remoteStream} adaptive className={className} /> : null;
  const localPicture = (className) =>
    hasLocalPicture ? (
      <CallVideo stream={localStream} mirrored={mirrored} className={className} />
    ) : null;

  if (minimized) return <MiniCall peer={peer} picture={remotePicture('h-full w-full')} />;

  const stageIsMine = live && swapped;
  const stage = stageIsMine
    ? localPicture('absolute inset-0 h-full w-full')
    : remotePicture('absolute inset-0 h-full w-full');
  const tile = stageIsMine ? remotePicture('h-full w-full') : localPicture('h-full w-full');
  const tilePerson = stageIsMine ? peer : me;
  const Quality = quality ? QUALITY[quality] : null;
  const chromeHidden = !controlsShown && 'pointer-events-none opacity-0';

  return (
    <motion.div
      ref={containerRef}
      {...FADE}
      role='dialog'
      aria-label={`Video call with ${peer?.name}`}
      onPointerMove={wake}
      onClick={() => (controlsShown && live ? setControlsShown(false) : wake())}
      className='fixed inset-0 z-[60] select-none overflow-hidden bg-scrim text-on-scrim'
    >
      {live ? (
        (stage ?? (
          <Presence
            person={stageIsMine ? me : peer}
            note={
              stageIsMine
                ? 'Your camera is off'
                : phase === 'connected'
                  ? `${firstName(peer)}'s camera is off`
                  : undefined
            }
          />
        ))
      ) : (
        <>
          {/* Until the call connects you see yourself, dimmed, behind who you are calling. */}
          {localPicture('absolute inset-0 h-full w-full scale-105 opacity-40 blur-sm')}
          <Presence person={peer} calling={phase === 'outgoing'} />
        </>
      )}

      {phase === 'reconnecting' && stage && (
        <div className='absolute inset-0 grid place-items-center bg-scrim/55'>
          <p className='flex items-center gap-2.5 rounded-full bg-scrim/70 px-4 py-2 text-sm font-medium backdrop-blur-md'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Reconnecting…
          </p>
        </div>
      )}

      {/* Top: step out of the call screen, and who you are talking to. */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-scrim/70 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-200 ease-snappy sm:px-5',
          chromeHidden
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {!ended && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                aria-label='Minimise the call'
                onClick={minimize}
                className='press grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-on-scrim/15 backdrop-blur-md hover:bg-on-scrim/25'
              >
                <ChevronDown className='h-5 w-5' />
              </button>
            </TooltipTrigger>
            <TooltipContent className='z-[70]'>Minimise</TooltipContent>
          </Tooltip>
        )}
        {live && (
          <div className='min-w-0 flex-1'>
            <p className='flex items-center gap-1.5 text-sm font-semibold sm:text-base'>
              <span className='truncate'>{peer?.name}</span>
              {!peerMicOn && (
                <MicOff
                  className='h-3.5 w-3.5 shrink-0 text-on-scrim/70'
                  aria-label={`${firstName(peer)} is muted`}
                />
              )}
            </p>
            <p className='flex items-center gap-2 text-xs text-on-scrim/70'>
              <CallStatus />
              {Quality && (
                <span className='flex items-center gap-1' title={Quality.label}>
                  <Quality.Icon className='h-3.5 w-3.5' aria-hidden />
                  {quality === 'poor' && Quality.label}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {live && (
        <FloatingTile
          startCorner='top-right'
          inset={{ top: 72, bottom: 128, left: 12, right: 12 }}
          onTap={() => setSwapped((value) => !value)}
          label='Swap the two pictures'
          className='z-10 aspect-[3/4] w-24 text-on-scrim sm:aspect-video sm:w-56'
        >
          {tile ?? (
            <div className='grid h-full w-full place-items-center'>
              <CallAvatar person={tilePerson} className='h-10 w-10 sm:h-12 sm:w-12' />
            </div>
          )}
          {!stageIsMine && !micOn && (
            <span className='absolute bottom-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-scrim/70'>
              <MicOff className='h-3.5 w-3.5' />
            </span>
          )}
        </FloatingTile>
      )}

      {!ended && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-scrim/75 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-14 transition-[opacity,transform] duration-200 ease-snappy',
            chromeHidden,
            !controlsShown && 'translate-y-2'
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className='flex items-center gap-3 sm:gap-4'>
            <ControlButton
              label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              on={micOn}
              onClick={toggleMic}
            >
              {micOn ? <Mic className='h-5 w-5' /> : <MicOff className='h-5 w-5' />}
            </ControlButton>
            <ControlButton
              label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              on={cameraOn}
              onClick={toggleCamera}
            >
              {cameraOn ? <Video className='h-5 w-5' /> : <VideoOff className='h-5 w-5' />}
            </ControlButton>
            {canFlipCamera && cameraOn && (
              <ControlButton label='Switch camera' onClick={flipCamera}>
                <SwitchCamera className='h-5 w-5' />
              </ControlButton>
            )}
            {document.fullscreenEnabled && (
              <ControlButton
                label={fullscreen ? 'Leave full screen' : 'Full screen'}
                onClick={toggleFullscreen}
                className='hidden sm:grid'
              >
                {fullscreen ? <Minimize2 className='h-5 w-5' /> : <Maximize2 className='h-5 w-5' />}
              </ControlButton>
            )}
            <ControlButton label={live ? 'End call' : 'Cancel call'} danger onClick={endCall}>
              <PhoneOff className='h-5 w-5' />
            </ControlButton>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CallScreen;
