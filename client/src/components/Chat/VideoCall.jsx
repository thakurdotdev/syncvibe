import { useState, useContext, useEffect, useRef, useCallback } from "react";
import {
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Timer,
  Maximize2,
  Minimize2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { ChatContext } from "../../Context/ChatContext";
import { Context } from "../../Context/Context";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VideoCallUI = () => {
  const { connectionState, localStream, remoteStream, endCall, currentCall } =
    useContext(ChatContext);
  const { user } = useContext(Context);

  const [callState, setCallState] = useState({
    isVideoEnabled: true,
    isAudioEnabled: true,
    isFullscreen: false,
    duration: "00:00",
    hasRemoteVideo: false,
    isRemoteVideoPlaying: false,
    remoteVideoError: null,
  });

  // Refs
  const refs = {
    startTime: useRef(Date.now()),
    timer: useRef(null),
    mainVideo: useRef(null),
    pipVideo: useRef(null),
    fullscreenContainer: useRef(null),
  };

  const getConnectionStatus = useCallback(() => {
    const statusMap = {
      connected: {
        icon: <Wifi className="w-4 h-4" />,
        text: "Connected",
        variant: "success",
      },
      connecting: {
        icon: <Wifi className="w-4 h-4 animate-pulse" />,
        text: "Connecting",
        variant: "warning",
      },
      disconnected: {
        icon: <WifiOff className="w-4 h-4" />,
        text: "Connection Lost",
        variant: "destructive",
      },
      failed: {
        icon: <WifiOff className="w-4 h-4" />,
        text: "Connection Lost",
        variant: "destructive",
      },
    };

    return (
      statusMap[connectionState] || {
        icon: <Wifi className="w-4 h-4" />,
        text: "Initializing",
        variant: "secondary",
      }
    );
  }, [connectionState]);

  // Set up initial streams
  useEffect(() => {
    if (!refs.mainVideo.current || !localStream) return;

    refs.mainVideo.current.srcObject = localStream;
    refs.mainVideo.current.play().catch(console.error);
  }, [localStream]);

  useEffect(() => {
    const setupRemoteStream = async () => {
      if (!remoteStream || !refs.pipVideo.current) return;

      try {
        refs.pipVideo.current.srcObject = remoteStream;
        await refs.pipVideo.current.play();

        setCallState((prev) => ({
          ...prev,
          isRemoteVideoPlaying: true,
          hasRemoteVideo: remoteStream
            .getVideoTracks()
            .some(
              (track) =>
                track.readyState === "live" && !track.muted && track.enabled,
            ),
        }));
      } catch (error) {
        console.error("Remote video setup error:", error);
        setCallState((prev) => ({
          ...prev,
          remoteVideoError: error.message,
          isRemoteVideoPlaying: false,
        }));
      }
    };

    setupRemoteStream();

    return () => {
      if (refs.pipVideo.current) refs.pipVideo.current.srcObject = null;
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
          ? `${hrs}:${remainingMins.toString().padStart(2, "0")}:${secs
              .toString()
              .padStart(2, "0")}`
          : `${mins.toString().padStart(2, "0")}:${secs
              .toString()
              .padStart(2, "0")}`;

      setCallState((prev) => ({ ...prev, duration }));
      refs.timer.current = requestAnimationFrame(updateDuration);
    };

    refs.timer.current = requestAnimationFrame(updateDuration);
    return () => refs.timer.current && cancelAnimationFrame(refs.timer.current);
  }, [remoteStream]);

  // Action handlers
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
      console.error("Fullscreen error:", err);
    }
  }, []);

  const handleEndCall = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    }
    endCall();
  }, [endCall]);

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-lg flex items-center justify-center z-50">
      <Card
        ref={refs.fullscreenContainer}
        className="relative w-full h-[100svh] bg-gradient-to-b from-background to-background/90"
      >
        {/* Main video */}
        <div className="relative w-full h-full overflow-hidden rounded-lg">
          <video
            ref={refs.mainVideo}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute bottom-4 left-4">
            <div className="flex items-center gap-3 bg-background/80 backdrop-blur-md p-3 rounded-full">
              <Avatar>
                <AvatarImage src={user?.profilepic} alt={user?.name} />
                <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
              </Avatar>
              <span className="text-foreground font-medium">{user?.name}</span>
            </div>
          </div>
        </div>

        {/* PiP video */}
        {remoteStream && (
          <div className="absolute top-4 right-4 w-64 h-36 rounded-lg overflow-hidden ring-2 ring-border">
            <video
              ref={refs.pipVideo}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
            />
            <div className="absolute bottom-2 left-2">
              <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full">
                <Avatar className="w-6 h-6">
                  <AvatarImage
                    src={currentCall?.profilepic}
                    alt={currentCall?.name}
                  />
                  <AvatarFallback>{currentCall?.name?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-foreground text-sm">
                  {currentCall?.name}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-4 bg-background/80 backdrop-blur-md p-4 rounded-full">
            <Button
              variant={callState.isVideoEnabled ? "secondary" : "destructive"}
              size="icon"
              onClick={toggleVideo}
            >
              {callState.isVideoEnabled ? <Video /> : <VideoOff />}
            </Button>

            <Button
              variant={callState.isAudioEnabled ? "secondary" : "destructive"}
              size="icon"
              onClick={toggleAudio}
            >
              {callState.isAudioEnabled ? <Mic /> : <MicOff />}
            </Button>

            <Button variant="destructive" size="icon" onClick={handleEndCall}>
              <PhoneOff />
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <div className="absolute top-4 left-4 flex items-center gap-4">
          <Badge variant="secondary" className="gap-2">
            <Timer className="w-4 h-4" />
            {callState.duration}
          </Badge>

          <Badge variant={getConnectionStatus().variant} className="gap-2">
            {getConnectionStatus().icon}
            {getConnectionStatus().text}
          </Badge>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="ml-2"
          >
            {callState.isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default VideoCallUI;
