import { memo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  AudioLines,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Radio,
  Search,
} from "lucide-react"

const Equalizer = memo(() => (
  <div className="flex items-end gap-[3px] h-5">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className="w-[3px] bg-primary rounded-full animate-wave"
        style={{
          animationDelay: `${i * 0.15}s`,
          height: "100%",
          transformOrigin: "bottom",
        }}
      />
    ))}
  </div>
))

const AddedByBadge = memo(({ queueItem }) => {
  if (!queueItem?.addedBy) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50 ml-2">
      <span className="text-border">•</span>
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
  isSyncing,
  syncCountdown,
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
  const controlsDisabled = isLoading || isSyncing

  const handleSkip = useCallback(() => {
    if (onSkip) onSkip()
  }, [onSkip])

  if (!currentSong) {
    return (
      <div className="rounded-2xl border border-border/40 bg-accent/20 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 md:py-16 px-4"
        >
          <div className="relative mb-6">
            <div className="p-5 rounded-full bg-accent/50">
              <AudioLines className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full border border-muted-foreground/10"
            />
          </div>
          <p className="text-base font-medium text-muted-foreground/70">No song playing</p>
          <p className="text-sm text-muted-foreground/40 mt-1">Search for songs to start listening</p>
          <Button
            onClick={onSearchOpen}
            className="mt-6 rounded-full px-6 gap-2"
            variant="outline"
            size="sm"
          >
            <Search className="h-3.5 w-3.5" />
            Find a Song
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-accent/20 overflow-hidden">
      <div className="p-3 md:p-5">
        <div className="flex gap-3 md:gap-5">
          <motion.div
            key={currentSong.id}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="shrink-0"
          >
            <div
              className={cn(
                "relative h-28 w-28 md:h-40 md:w-40 rounded-xl overflow-hidden",
                "shadow-lg",
                isPlaying && !isSyncing && "ring-1 ring-primary/20",
              )}
            >
              <img
                src={currentSong.image?.[2]?.link}
                alt={currentSong.name}
                className="h-full w-full object-cover"
              />
              <AnimatePresence>
                {isPlaying && !isSyncing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-center pb-2.5"
                  >
                    <Equalizer />
                  </motion.div>
                )}
                {isSyncing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5"
                  >
                    <Radio className="h-5 w-5 text-primary animate-pulse" />
                    <span className="text-[10px] font-medium text-white/80">Syncing</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
            <div className="space-y-0.5">
              <motion.h3
                key={currentSong.id + "-title"}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-base md:text-xl font-semibold line-clamp-1 leading-tight"
              >
                {currentSong.name}
              </motion.h3>
              <p className="text-xs md:text-sm text-muted-foreground/60 line-clamp-1 flex items-center">
                <span>{currentSong.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"}</span>
                <AddedByBadge queueItem={currentQueueItem} />
              </p>
              {currentSong.album && (
                <p className="text-[11px] md:text-xs text-muted-foreground/40 line-clamp-1 hidden md:block mt-0.5">
                  {currentSong.album}
                </p>
              )}
              <AnimatePresence>
                {isSyncing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-accent/60 border border-border/40"
                  >
                    <Radio className="h-3 w-3 text-primary animate-pulse shrink-0" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Syncing all devices{syncCountdown > 0 ? ` — ${syncCountdown}s` : "…"}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1 mt-2 md:mt-0">
              <Slider
                onValueChange={onSeek}
                value={[currentTime]}
                max={duration || 100}
                step={1}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground/50 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1 md:mt-0">
              <div className="flex items-center gap-0.5 md:gap-1">
                <Button
                  size="icon"
                  onClick={() => onPlayPause()}
                  disabled={controlsDisabled}
                  className={cn(
                    "h-10 w-10 md:h-11 md:w-11 rounded-full",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 hover:scale-[1.03]",
                    "transition-all duration-200",
                  )}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="h-4.5 w-4.5 md:h-5 md:w-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-4.5 w-4.5 md:h-5 md:w-5" />
                  ) : (
                    <Play className="h-4.5 w-4.5 md:h-5 md:w-5 ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={controlsDisabled}
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onQueueOpen}
                  className="gap-1.5 rounded-full h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ListMusic className="h-3.5 w-3.5" />
                  Queue
                  {queueCount > 0 && (
                    <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-normal">
                      {queueCount}
                    </Badge>
                  )}
                </Button>

                <div className="flex items-center gap-1.5 w-24 ml-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onVolumeChange(isMuted ? [0.5] : [0])}
                  >
                    {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
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
      </div>
    </div>
  )
}

export default memo(NowPlayingCard)
