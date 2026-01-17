import { memo, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import {
  AudioLines,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
} from "lucide-react"

const HOVER_TRANSITION = "transition-all duration-300 ease-out"

// Memoized Equalizer
const Equalizer = memo(() => (
  <div className="flex items-end gap-0.5 h-4">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className="w-1 bg-white rounded-full animate-wave"
        style={{
          animationDelay: `${i * 0.15}s`,
          height: "100%",
          transformOrigin: "bottom",
        }}
      />
    ))}
  </div>
))

// Memoized AddedBy Badge - Inline style
const AddedByBadge = memo(({ queueItem }) => {
  if (!queueItem?.addedBy) return null

  return (
    <span className="inline-flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground/60">
      <span className="mx-1">•</span>
      <Avatar className="h-3.5 w-3.5">
        <AvatarImage src={queueItem.addedBy.profilePic} />
        <AvatarFallback className="text-[6px]">
          {queueItem.addedBy.userName?.charAt(0)?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span>{queueItem.addedBy.userName}</span>
    </span>
  )
})

const NowPlayingCard = ({
  currentSong,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  volume,
  formatTime,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSearchOpen,
  onQueueOpen,
  onSkip,
  currentQueueItem,
  queueCount = 0,
}) => {
  const isMuted = volume === 0

  const handleSkip = useCallback(() => {
    if (onSkip) onSkip()
  }, [onSkip])

  return (
    <div
      className={cn(
        "rounded-2xl p-4 md:p-6 overflow-hidden relative",
        "bg-gradient-to-br from-accent/40 via-accent/20 to-transparent",
        "border border-border/50",
        "shadow-xl",
        HOVER_TRANSITION,
      )}
    >
      {currentSong ? (
        <div className="flex flex-row gap-4 md:gap-6">
          {/* Album Art */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="relative flex justify-center md:justify-start"
          >
            <div
              className={cn(
                "relative h-36 w-32 md:h-44 md:w-44 rounded-xl overflow-hidden",
                "shadow-2xl shrink-0",
                isPlaying && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
              )}
            >
              <img
                src={currentSong.image?.[2]?.link}
                alt={currentSong.name}
                className="h-full w-full object-cover"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end justify-center pb-3">
                  <Equalizer />
                </div>
              )}
            </div>
          </motion.div>

          {/* Song Info & Controls */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            {/* Song Details */}
            <div className="space-y-0.5 text-left">
              <h3 className="text-lg md:text-2xl font-bold line-clamp-1">{currentSong.name}</h3>
              <p className="text-sm md:text-base text-muted-foreground line-clamp-1 flex items-center justify-start flex-wrap">
                <span>
                  {currentSong.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}
                </span>
                <AddedByBadge queueItem={currentQueueItem} />
              </p>
              {currentSong.album && (
                <p className="text-xs md:text-sm text-muted-foreground/70 line-clamp-1 hidden md:block">
                  {currentSong.album}
                </p>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5 mt-3 md:mt-4">
              <Slider
                onValueChange={onSeek}
                value={[currentTime]}
                max={duration || 100}
                step={1}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center md:justify-between mt-3 md:mt-4">
              <div className="flex items-center gap-1 md:gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-accent"
                      >
                        <SkipBack className="h-4 w-4 md:h-5 md:w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        onClick={() => onPlayPause()}
                        disabled={isLoading}
                        className={cn(
                          "h-12 w-12 md:h-14 md:w-14 rounded-full",
                          "bg-primary text-primary-foreground",
                          "hover:bg-primary/90 hover:scale-105",
                          "shadow-lg shadow-primary/25",
                          HOVER_TRANSITION,
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="h-5 w-5 md:h-6 md:w-6" />
                        ) : (
                          <Play className="h-5 w-5 md:h-6 md:w-6 ml-0.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSkip}
                        className="h-9 w-9 md:h-10 md:w-10 rounded-full hover:bg-accent"
                      >
                        <SkipForward className="h-4 w-4 md:h-5 md:w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Right Side - Queue Button & Volume */}
              <div className="hidden md:flex items-center gap-3">
                {/* Queue Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onQueueOpen}
                        className="gap-1.5 rounded-full"
                      >
                        <ListMusic className="h-4 w-4" />
                        Queue
                        {queueCount > 0 && (
                          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                            {queueCount}
                          </Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View queue</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Volume Control */}
                <div className="flex items-center gap-2 w-28">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => onVolumeChange(isMuted ? [0.5] : [0])}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Slider
                    value={[volume]}
                    max={1}
                    step={0.01}
                    onValueChange={onVolumeChange}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Empty State
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="relative inline-block">
            <AudioLines className="h-20 w-20 mx-auto text-primary/30" />
            <div className="absolute inset-0 animate-ping">
              <AudioLines className="h-20 w-20 mx-auto text-primary/10" />
            </div>
          </div>
          <p className="text-xl font-medium mt-4">No song playing</p>
          <p className="text-muted-foreground mt-1">Search and select a song to start the party</p>
          <Button onClick={onSearchOpen} className="mt-6 rounded-full px-8 shadow-lg" size="lg">
            Find a Song
          </Button>
        </motion.div>
      )}
    </div>
  )
}

export default memo(NowPlayingCard)
