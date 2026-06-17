import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowLeftRight,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useVideoCallStore } from "../../stores/videoCallStore"
import { useProfile } from "../../Context/Context"

const CallTimer = ({ remoteStream }) => {
  const [duration, setDuration] = useState("00:00")
  
  useEffect(() => {
    if (!remoteStream) return
    const startTime = Date.now()
    
    const updateDuration = () => {
      const elapsed = Date.now() - startTime
      const seconds = Math.floor(elapsed / 1000)
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      const hrs = Math.floor(mins / 60)
      const remainingMins = mins % 60

      setDuration(
        hrs > 0
          ? `${hrs}:${remainingMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
          : `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      )
    }

    updateDuration() // Initial call
    const interval = setInterval(updateDuration, 1000)
    return () => clearInterval(interval)
  }, [remoteStream])

  return <span className="tabular-nums">{duration}</span>
}

const VideoCallUI = () => {
  const { connectionState, localStream, remoteStream, endCall, currentCall } = useVideoCallStore()
  const { user } = useProfile()

  const [callState, setCallState] = useState({
    isVideoEnabled: true,
    isAudioEnabled: true,
    isFullscreen: false,
    hasRemoteVideo: false,
    isRemoteVideoPlaying: false,
    remoteVideoError: null,
    showRemoteAsPrimary: true,
  })

  const refs = {
    localVideo: useRef(null),
    remoteVideo: useRef(null),
    fullscreenContainer: useRef(null),
  }

  const getConnectionStatus = useCallback(() => {
    const statusMap = {
      connected: { icon: <Wifi className="w-3.5 h-3.5" />, text: "Connected", variant: "secondary", className: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
      connecting: { icon: <Wifi className="w-3.5 h-3.5 animate-pulse" />, text: "Connecting", variant: "secondary", className: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
      disconnected: { icon: <WifiOff className="w-3.5 h-3.5" />, text: "Connection Lost", variant: "secondary", className: "text-red-400 border-red-500/20 bg-red-500/10" },
      failed: { icon: <WifiOff className="w-3.5 h-3.5" />, text: "Connection Failed", variant: "secondary", className: "text-red-400 border-red-500/20 bg-red-500/10" },
    }

    return statusMap[connectionState] || {
      icon: <Wifi className="w-3.5 h-3.5 animate-pulse" />,
      text: "Initializing",
      variant: "secondary",
      className: "text-zinc-400 border-zinc-500/20 bg-zinc-500/10"
    }
  }, [connectionState])

  useEffect(() => {
    const onUnloadBefore = (e) => {
      e.preventDefault()
      e.returnValue = "If you leave, the call will end."
    }
    window.addEventListener("beforeunload", onUnloadBefore)
    return () => window.removeEventListener("beforeunload", onUnloadBefore)
  }, [])

  // Set up local stream
  useEffect(() => {
    if (!refs.localVideo.current || !localStream) return
    refs.localVideo.current.srcObject = localStream
    refs.localVideo.current.play().catch(console.error)
  }, [localStream])

  // Set up remote stream
  useEffect(() => {
    const setupRemoteStream = async () => {
      if (!remoteStream || !refs.remoteVideo.current) return

      try {
        refs.remoteVideo.current.srcObject = remoteStream
        await refs.remoteVideo.current.play()

        setCallState((prev) => ({
          ...prev,
          isRemoteVideoPlaying: true,
          hasRemoteVideo: remoteStream
            .getVideoTracks()
            .some((track) => track.readyState === "live" && !track.muted && track.enabled),
        }))
      } catch (error) {
        console.error("Remote video setup error:", error)
        setCallState((prev) => ({
          ...prev,
          remoteVideoError: error.message,
          isRemoteVideoPlaying: false,
        }))
      }
    }

    setupRemoteStream()
    return () => {
      if (refs.remoteVideo.current) refs.remoteVideo.current.srcObject = null
    }
  }, [remoteStream])

  const toggleVideo = useCallback(() => {
    if (!localStream) return
    const enabled = !callState.isVideoEnabled
    localStream.getVideoTracks().forEach((track) => (track.enabled = enabled))
    setCallState((prev) => ({ ...prev, isVideoEnabled: enabled }))
  }, [localStream, callState.isVideoEnabled])

  const toggleAudio = useCallback(() => {
    if (!localStream) return
    const enabled = !callState.isAudioEnabled
    localStream.getAudioTracks().forEach((track) => (track.enabled = enabled))
    setCallState((prev) => ({ ...prev, isAudioEnabled: enabled }))
  }, [localStream, callState.isAudioEnabled])

  const toggleFullscreen = useCallback(async () => {
    if (!refs.fullscreenContainer.current) return
    try {
      if (!document.fullscreenElement) {
        await refs.fullscreenContainer.current.requestFullscreen()
        setCallState((prev) => ({ ...prev, isFullscreen: true }))
      } else {
        await document.exitFullscreen()
        setCallState((prev) => ({ ...prev, isFullscreen: false }))
      }
    } catch (err) {
      console.error("Fullscreen error:", err)
    }
  }, [])

  const handleEndCall = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(console.error)
    endCall()
  }, [endCall])

  const swapVideos = useCallback(() => {
    setCallState((prev) => ({ ...prev, showRemoteAsPrimary: !prev.showRemoteAsPrimary }))

    const tempSrcObject = refs.localVideo.current.srcObject
    refs.localVideo.current.srcObject = refs.remoteVideo.current.srcObject
    refs.remoteVideo.current.srcObject = tempSrcObject

    refs.localVideo.current.muted = !refs.localVideo.current.muted
    refs.remoteVideo.current.muted = !refs.remoteVideo.current.muted
  }, [])

  const status = getConnectionStatus()
  const isRemotePrimary = callState.showRemoteAsPrimary
  const primaryParticipant = isRemotePrimary ? currentCall : user
  const secondaryParticipant = isRemotePrimary ? user : currentCall

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      <div
        ref={refs.fullscreenContainer}
        className="relative w-full h-full overflow-hidden select-none bg-black"
      >
        {/* Primary Video Area */}
        <div className="relative w-full h-full overflow-hidden bg-zinc-950">
          <video
            ref={refs.remoteVideo}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={!isRemotePrimary}
          />
          
          {/* Connecting / No Video State */}
          {!remoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-900 to-black">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
                <Avatar className="relative w-32 h-32 md:w-40 md:h-40 border-4 border-zinc-800 shadow-2xl">
                  <AvatarImage src={currentCall?.profilepic} alt={currentCall?.name} />
                  <AvatarFallback className="text-5xl font-light text-zinc-400 bg-zinc-900">
                    {currentCall?.name?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-center">
                <p className="text-white text-xl font-medium mb-2">{currentCall?.name}</p>
                <p className="text-zinc-400 text-sm flex items-center gap-2 justify-center">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                  {connectionState === 'connected' ? 'Starting video...' : 'Connecting...'}
                </p>
              </div>
            </div>
          )}

          {/* Primary Participant Info */}
          {remoteStream && (
            <div className="absolute bottom-24 md:bottom-8 left-4 md:left-8 z-10 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg text-white">
              <Avatar className="h-8 w-8 border border-white/20">
                <AvatarImage src={primaryParticipant?.profilepic} alt={primaryParticipant?.name} />
                <AvatarFallback className="bg-muted text-foreground text-xs">
                  {primaryParticipant?.name?.[0]}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm md:text-base hidden sm:block">
                {primaryParticipant?.name}
              </span>
            </div>
          )}
        </div>

        {/* Secondary Video (Picture-in-Picture) */}
        <div 
          onClick={swapVideos}
          className="group absolute top-20 md:top-6 right-4 md:right-6 w-28 sm:w-44 md:w-56 aspect-video rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl transition-all hover:ring-white/40 cursor-pointer bg-black/50 z-20"
        >
          <video
            ref={refs.localVideo}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted={isRemotePrimary}
          />
          
          {/* Secondary Participant Info */}
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md text-white text-xs font-medium pointer-events-none">
            <Avatar className="h-5 w-5 border border-white/20">
              <AvatarImage src={secondaryParticipant?.profilepic} alt={secondaryParticipant?.name} />
              <AvatarFallback className="bg-muted text-foreground text-[10px]">
                {secondaryParticipant?.name?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block">{secondaryParticipant?.name}</span>
          </div>

          {/* Swap Indicator Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex items-center gap-2 text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-full">
              <ArrowLeftRight className="w-3 h-3" />
              Swap
            </div>
          </div>
        </div>

        {/* Top Status Bar */}
        <div className="absolute top-4 left-4 md:left-6 flex items-center gap-2 z-30">
          <Badge 
            variant="secondary" 
            className="bg-black/50 backdrop-blur-md text-white border-white/10 hover:bg-black/50 gap-1.5 px-3 py-1.5 font-mono"
          >
            <Video className="w-3.5 h-3.5" />
            <CallTimer remoteStream={remoteStream} />
          </Badge>

          <Badge 
            variant="secondary" 
            className={`${status.className} backdrop-blur-md border hover:bg-black/50 gap-1.5 px-3 py-1.5 hidden sm:flex`}
          >
            {status.icon}
            {status.text}
          </Badge>
        </div>

        {/* Bottom Controls Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full px-4 flex justify-center">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={callState.isVideoEnabled ? "secondary" : "destructive"}
                  size="icon"
                  className="h-12 w-12 rounded-xl shrink-0 transition-transform active:scale-95"
                  onClick={toggleVideo}
                  aria-label={callState.isVideoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {callState.isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{callState.isVideoEnabled ? "Turn off camera" : "Turn on camera"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={callState.isAudioEnabled ? "secondary" : "destructive"}
                  size="icon"
                  className="h-12 w-12 rounded-xl shrink-0 transition-transform active:scale-95"
                  onClick={toggleAudio}
                  aria-label={callState.isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {callState.isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{callState.isAudioEnabled ? "Mute microphone" : "Unmute microphone"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={swapVideos}
                  className="h-12 w-12 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white shrink-0 hidden sm:inline-flex transition-transform active:scale-95"
                  aria-label="Swap video positions"
                >
                  <ArrowLeftRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Swap video positions</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="h-12 w-12 rounded-xl hover:bg-white/10 text-zinc-300 hover:text-white shrink-0 hidden sm:inline-flex transition-transform active:scale-95"
                  aria-label={callState.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {callState.isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{callState.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</TooltipContent>
            </Tooltip>

            <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block"></div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-12 w-12 rounded-xl shrink-0 bg-red-600 hover:bg-red-700 transition-transform active:scale-95"
                  onClick={handleEndCall}
                  aria-label="End call"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>End call</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoCallUI
