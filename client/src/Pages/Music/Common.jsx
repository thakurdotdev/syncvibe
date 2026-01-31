import axios from "axios"
import { AnimatePresence, motion } from "framer-motion"
import {
  Loader2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react"
import { memo, useCallback, useState } from "react"
import ShareDrawer from "@/components/Posts/ShareDrawer"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"

export const formatTime = (time) => {
  if (!time) return "00:00"
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export const PlaylistActions = ({ onPlayAll, onShuffle, disabled, showShare = true }) => {
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false)
  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={onPlayAll} disabled={disabled} className="gap-2">
          <Play className="w-4 h-4" />
          Play All
        </Button>

        <Button variant="outline" onClick={onShuffle} disabled={disabled} className="gap-2">
          <Shuffle className="w-4 h-4" />
          Shuffle
        </Button>

        {showShare && (
          <Button variant="outline" onClick={() => setIsShareDrawerOpen(true)} className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </div>
      {showShare && (
        <ShareDrawer
          isOpen={isShareDrawerOpen}
          onClose={() => setIsShareDrawerOpen(false)}
          shareLink={window.location.href}
        />
      )}
    </>
  )
}

export const LoadingState = ({ message, height }) => (
  <div
    className={`flex ${
      height ? height : "h-full"
    } items-center justify-center bg-background/50 backdrop-blur-sm`}
  >
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
      <p className="text-muted-foreground animate-pulse">{message || "Loading your music..."}</p>
    </div>
  </div>
)

export const MusicControls = memo(({ size = "default", showExtras = true }) => {
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const shuffleMode = usePlayerStore((s) => s.shuffleMode)
  const repeatMode = usePlayerStore((s) => s.repeatMode)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat)

  const isLarge = size === "large"

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat

  const repeatLabel = {
    off: "Repeat: Off",
    all: "Repeat: All",
    one: "Repeat: One",
  }

  const buttonVariants = {
    hover: { scale: 1.1 },
    tap: { scale: 0.9 },
  }

  const playButtonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 sm:gap-2">
        {showExtras && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleShuffle}
                  className={cn(
                    "relative transition-colors duration-200",
                    isLarge ? "h-10 w-10" : "h-9 w-9",
                    shuffleMode && "text-primary",
                  )}
                >
                  <Shuffle className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
                  {shuffleMode && (
                    <motion.span
                      layoutId="shuffle-indicator"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    />
                  )}
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {shuffleMode ? "Shuffle: On" : "Shuffle: Off"}
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevSong}
                className={cn("transition-colors duration-200", isLarge ? "h-12 w-12" : "h-9 w-9")}
              >
                <SkipBack className={isLarge ? "h-5 w-5" : "h-4 w-4"} fill="currentColor" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Previous
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={playButtonVariants} whileHover="hover" whileTap="tap">
              <Button
                size="icon"
                onClick={handlePlayPause}
                className={cn(
                  "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200",
                  isLarge ? "h-14 w-14 rounded-full" : "h-10 w-10 rounded-full",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isPlaying ? "pause" : "play"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-center"
                  >
                    {isPlaying ? (
                      <Pause className={isLarge ? "h-6 w-6" : "h-4 w-4"} fill="currentColor" />
                    ) : (
                      <Play
                        className={cn(isLarge ? "h-6 w-6" : "h-4 w-4", "ml-0.5")}
                        fill="currentColor"
                      />
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isPlaying ? "Pause" : "Play"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNextSong(false)}
                className={cn("transition-colors duration-200", isLarge ? "h-12 w-12" : "h-9 w-9")}
              >
                <SkipForward className={isLarge ? "h-5 w-5" : "h-4 w-4"} fill="currentColor" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Next
          </TooltipContent>
        </Tooltip>

        {showExtras && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleRepeat}
                  className={cn(
                    "relative transition-colors duration-200",
                    isLarge ? "h-10 w-10" : "h-9 w-9",
                    repeatMode !== "off" && "text-primary",
                  )}
                >
                  <RepeatIcon className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
                  {repeatMode !== "off" && (
                    <motion.span
                      layoutId="repeat-indicator"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    />
                  )}
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {repeatLabel[repeatMode]}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
})

export const VolumeControl = memo(({ showVolume = false }) => {
  const handleVolumeChange = usePlayerStore((s) => s.handleVolumeChange)
  const volume = usePlayerStore((s) => s.volume)
  const [isMuted, setIsMuted] = useState(false)
  const [prevVolume, setPrevVolume] = useState(1)

  const toggleMute = useCallback(() => {
    if (isMuted) {
      handleVolumeChange(prevVolume)
      setIsMuted(false)
    } else {
      setPrevVolume(volume)
      handleVolumeChange(0)
      setIsMuted(true)
    }
  }, [isMuted, volume, prevVolume, handleVolumeChange])

  if (!showVolume) return null

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 group">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 transition-colors duration-200"
                onClick={toggleMute}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isMuted || volume === 0 ? "muted" : "unmuted"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-center"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isMuted || volume === 0 ? "Unmute" : "Mute"}
          </TooltipContent>
        </Tooltip>
        <div className="w-0 overflow-hidden group-hover:w-20 transition-all duration-300">
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            className="w-20 cursor-pointer [&_[role=slider]]:bg-primary [&_[role=slider]]:border-0"
            onValueChange={([value]) => {
              handleVolumeChange(value)
              if (value > 0) setIsMuted(false)
            }}
          />
        </div>
      </div>
    </TooltipProvider>
  )
})

export const ProgressBarMusic = memo(({ isTimeVisible = false }) => {
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek)

  return (
    <div className="space-y-1">
      <Slider
        value={[currentTime]}
        min={0}
        max={duration || 1}
        step={0.1}
        onValueChange={([value]) => handleTimeSeek(value)}
        className="h-1 cursor-pointer [&_[role=slider]]:h-3 [&_[role=slider]]:w-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:opacity-0 hover:[&_[role=slider]]:opacity-100 [&_[role=slider]]:transition-opacity"
      />
      {isTimeVisible && (
        <div className="flex justify-between px-1 mt-2">
          <p className="text-muted-foreground text-xs tabular-nums">{formatTime(currentTime)}</p>
          <p className="text-muted-foreground text-xs tabular-nums">{formatTime(duration)}</p>
        </div>
      )}
    </div>
  )
})

export const ensureHttpsForDownloadUrls = (song) => {
  if (!song || typeof song !== "object") return song

  const updatedDownloadUrls = Array.isArray(song.download_url)
    ? song.download_url.map((item) => {
        if (!item || typeof item !== "object") return item
        return {
          ...item,
          link:
            item.link && typeof item.link === "string"
              ? item.link.startsWith("http://")
                ? item.link.replace("http://", "https://")
                : item.link
              : item.link,
        }
      })
    : song.download_url

  const updatedArtworkUrls = Array.isArray(song.image)
    ? song.image.map((item) => {
        if (!item || typeof item !== "object") return item
        return {
          ...item,
          link:
            item.link && typeof item.link === "string"
              ? item.link.startsWith("http://")
                ? item.link.replace("http://", "https://")
                : item.link
              : item.link,
        }
      })
    : song.image

  return {
    ...song,
    download_url: updatedDownloadUrls,
    image: updatedArtworkUrls,
  }
}

export const addToHistory = async (songData, playedTime, trackingType) => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/history/add`,
      { songData, playedTime, trackingType },
      { withCredentials: true },
    )

    if (response.status === 200) {
    }
  } catch (error) {
    console.error("Error adding to history:", error)
  }
}
