import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeftRight,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  Timer,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../Context/ChatContext';
import { useProfile } from '../../Context/Context';

const VideoCallUI = () => {
  const { connectionState, localStream, remoteStream, endCall, currentCall } = useSocket();
  const { user } = useProfile();

  const [callState, setCallState] = useState({
    isVideoEnabled: true,
    isAudioEnabled: true,
    isFullscreen: false,
    duration: '00:00',
    hasRemoteVideo: false,
    isRemoteVideoPlaying: false,
    remoteVideoError: null,
    showRemoteAsPrimary: true,
  });

  const refs = {
    startTime: useRef(Date.now()),
    timer: useRef(null),
    localVideo: useRef(null),
    remoteVideo: useRef(null),
    fullscreenContainer: useRef(null),
  };

  const getConnectionStatus = useCallback(() => {
    const statusMap = {
      connected: {
        icon: <Wifi className='w-4 h-4' />,
        text: 'Connected',
        variant: 'outline',
      },
      connecting: {
        icon: <Wifi className='w-4 h-4 animate-pulse' />,
        text: 'Connecting',
        variant: 'warning',
      },
      disconnected: {
        icon: <WifiOff className='w-4 h-4' />,
        text: 'Connection Lost',
        variant: 'destructive',
      },
      failed: {
        icon: <WifiOff className='w-4 h-4' />,
        text: 'Connection Failed',
        variant: 'destructive',
      },
    };

    return (
      statusMap[connectionState] || {
        icon: <Wifi className='w-4 h-4' />,
        text: 'Initializing',
        variant: 'secondary',
      }
    );
  }, [connectionState]);

  useEffect(() => {
    const onUnloadBefore = (e) => {
      e.preventDefault();
      e.returnValue = 'If you leave, the call will end.';
    };

    window.addEventListener('beforeunload', onUnloadBefore);
    return () => window.removeEventListener('beforeunload', onUnloadBefore);
  }, []);

  // Set up video streams
  useEffect(() => {
    if (!refs.localVideo.current || !localStream) return;
    refs.localVideo.current.srcObject = localStream;
    refs.localVideo.current.play().catch(console.error);
  }, [localStream]);

  useEffect(() => {
    const setupRemoteStream = async () => {
      if (!remoteStream || !refs.remoteVideo.current) return;

      try {
        refs.remoteVideo.current.srcObject = remoteStream;
        await refs.remoteVideo.current.play();

        setCallState((prev) => ({
          ...prev,
          isRemoteVideoPlaying: true,
          hasRemoteVideo: remoteStream
            .getVideoTracks()
            .some((track) => track.readyState === 'live' && !track.muted && track.enabled),
        }));
      } catch (error) {
        console.error('Remote video setup error:', error);
        setCallState((prev) => ({
          ...prev,
          remoteVideoError: error.message,
          isRemoteVideoPlaying: false,
        }));
      }
    };

    setupRemoteStream();
    return () => {
      if (refs.remoteVideo.current) refs.remoteVideo.current.srcObject = null;
    };
  }, [remoteStream]);

  // Timer logic
  useEffect(() => {
    if (!remoteStream) return;

    refs.startTime.current = Date.now();
    const updateDuration = () => {
      const elapsed = Date.now() - refs.startTime.current;
      const seconds = Math.floor(elapsed / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;

      const duration =
        hrs > 0
          ? `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs
              .toString()
              .padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      setCallState((prev) => ({ ...prev, duration }));
      refs.timer.current = requestAnimationFrame(updateDuration);
    };

    refs.timer.current = requestAnimationFrame(updateDuration);
    return () => refs.timer.current && cancelAnimationFrame(refs.timer.current);
  }, [remoteStream]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const enabled = !callState.isVideoEnabled;
    localStream.getVideoTracks().forEach((track) => (track.enabled = enabled));
    setCallState((prev) => ({ ...prev, isVideoEnabled: enabled }));
  }, [localStream, callState.isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const enabled = !callState.isAudioEnabled;
    localStream.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setCallState((prev) => ({ ...prev, isAudioEnabled: enabled }));
  }, [localStream, callState.isAudioEnabled]);

  const toggleFullscreen = useCallback(async () => {
    if (!refs.fullscreenContainer.current) return;
    try {
      if (!document.fullscreenElement) {
        await refs.fullscreenContainer.current.requestFullscreen();
        setCallState((prev) => ({ ...prev, isFullscreen: true }));
      } else {
        await document.exitFullscreen();
        setCallState((prev) => ({ ...prev, isFullscreen: false }));
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const handleEndCall = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
    endCall();
  }, [endCall]);

  const swapVideos = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      showRemoteAsPrimary: !prev.showRemoteAsPrimary,
    }));

    // Swap video streams between elements
    const tempSrcObject = refs.localVideo.current.srcObject;
    refs.localVideo.current.srcObject = refs.remoteVideo.current.srcObject;
    refs.remoteVideo.current.srcObject = tempSrcObject;

    // Update muted state
    refs.localVideo.current.muted = !refs.localVideo.current.muted;
    refs.remoteVideo.current.muted = !refs.remoteVideo.current.muted;
  }, []);

  const renderParticipantInfo = (participant, isPrimary = false) => (
    <div
      className={`absolute ${isPrimary ? 'bottom-4 left-4 hidden md:block' : 'bottom-2 left-2'}`}
    >
      <div
        className={`flex items-center gap-2 bg-background/95 backdrop-blur-md ${
          isPrimary ? 'p-3' : 'px-3 py-1.5'
        } rounded-full shadow-lg`}
      >
        <Avatar className={isPrimary ? 'h-8 w-8' : 'h-6 w-6'}>
          <AvatarImage src={participant?.profilepic} alt={participant?.name} />
          <AvatarFallback>{participant?.name?.[0]}</AvatarFallback>
        </Avatar>
        <span className={`text-foreground ${isPrimary ? 'text-base' : 'text-sm'} font-medium`}>
          {participant?.name}
        </span>
      </div>
    </div>
  );

  return (
    <div className='fixed inset-0 flex items-center justify-center z-50 overflow-hidden'>
      <Card
        ref={refs.fullscreenContainer}
        className='relative w-full h-[100vh] overflow-hidden select-none'
      >
        <div className='relative w-full h-full flex'>
          {/* Primary Video */}
          <div className='relative w-full h-full overflow-hidden rounded-lg'>
            <video
              ref={refs.remoteVideo}
              className='w-full h-full object-cover'
              autoPlay
              playsInline
              muted={!callState.showRemoteAsPrimary}
            />
            {renderParticipantInfo(callState.showRemoteAsPrimary ? currentCall : user, true)}
          </div>

          {/* Secondary Video */}
          <div className='absolute top-4 right-4 w-72 h-40 rounded-lg overflow-hidden ring-2 ring-border shadow-lg transition-all hover:scale-105'>
            <video
              ref={refs.localVideo}
              className='w-full h-full object-cover'
              autoPlay
              playsInline
              muted={callState.showRemoteAsPrimary}
            />
            {renderParticipantInfo(callState.showRemoteAsPrimary ? user : currentCall, false)}
          </div>
        </div>

        {/* Status Bar */}
        <div className='absolute top-4 left-4 flex items-center gap-3 bg-background/95 backdrop-blur-md p-2 rounded-full shadow-lg'>
          <Badge variant='outline' className='gap-2 px-3 py-1.5'>
            <Timer className='w-4 h-4' />
            {callState.duration}
          </Badge>

          <Badge
            variant={getConnectionStatus().variant}
            className='gap-2 px-3 py-1.5 hidden md:flex'
          >
            {getConnectionStatus().icon}
            {getConnectionStatus().text}
          </Badge>
        </div>

        {/* Controls */}
        <div className='absolute bottom-10 left-1/2 -translate-x-1/2 max-w-full'>
          <div className='flex items-center gap-6 bg-background/95 backdrop-blur-md px-6 py-3 rounded-full shadow-lg'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={callState.isVideoEnabled ? 'outline' : 'destructive'}
                  size='icon'
                  className='h-12 w-12 rounded-full'
                  onClick={toggleVideo}
                >
                  {callState.isVideoEnabled ? (
                    <Video className='h-5 w-5' />
                  ) : (
                    <VideoOff className='h-5 w-5' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {callState.isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={callState.isAudioEnabled ? 'outline' : 'destructive'}
                  size='icon'
                  className='h-12 w-12 rounded-full'
                  onClick={toggleAudio}
                >
                  {callState.isAudioEnabled ? (
                    <Mic className='h-5 w-5' />
                  ) : (
                    <MicOff className='h-5 w-5' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {callState.isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={swapVideos}
                  className='hover:bg-accent rounded-full'
                >
                  <ArrowLeftRight className='w-4 h-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Swap video positions</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={toggleFullscreen}
                  className='hover:bg-accent rounded-full'
                >
                  {callState.isFullscreen ? <Minimize2 /> : <Maximize2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {callState.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='destructive'
                  size='icon'
                  className='h-12 w-12 rounded-full'
                  onClick={handleEndCall}
                >
                  <PhoneOff className='h-5 w-5' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>End call</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VideoCallUI;
