import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  AudioLines,
  Headphones,
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
import { useGroupSessionStore } from "@/stores/groupMusic/sessionStore"

const REACTION_EMOJIS = ["🔥", "❤️", "👏", "😍", "🎵"]

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

const FloatingReaction = memo(({ emoji, id, userName }) => {
  const config = useMemo(() => ({
    x: Math.random() * 80 + 10,
    drift: (Math.random() - 0.5) * 40,
    rotate: (Math.random() - 0.5) * 30,
    scale: 0.9 + Math.random() * 0.6,
    duration: 2 + Math.random() * 0.8,
  }), [])

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 0.3, rotate: 0 }}
      animate={{
        opacity: [1, 1, 0],
        y: -120,
        x: config.drift,
        scale: [0.3, config.scale, config.scale * 0.8],
        rotate: config.rotate,
      }}
      transition={{ duration: config.duration, ease: "easeOut" }}
      className="absolute bottom-4 pointer-events-none select-none flex flex-col items-center gap-1"
      style={{ left: `${config.x}%`, transform: "translateX(-50%)" }}
      onAnimationComplete={() => {
        useGroupSessionStore.setState((state) => ({
          floatingReactions: state.floatingReactions.filter((r) => r.id !== id),
        }))
      }}
    >
      <span className="text-3xl md:text-4xl drop-shadow-lg">{emoji}</span>
      {userName && (
        <span className="text-[9px] font-medium text-white/70 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-full whitespace-nowrap">
          {userName}
        </span>
      )}
    </motion.div>
  )
})

const FloatingReactionsOverlay = memo(() => {
  const reactions = useGroupSessionStore((s) => s.floatingReactions)
  if (!reactions.length) return null

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
      <AnimatePresence>
        {reactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} id={r.id} userName={r.userName} />
        ))}
      </AnimatePresence>
    </div>
  )
})

const VibingAvatars = memo(({ members }) => {
  if (!members?.length) return null
  const shown = members.slice(0, 4)
  const extra = members.length - shown.length

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <Avatar key={m.userId} className="h-6 w-6 ring-[1.5px] ring-background">
            <AvatarImage src={m.profilePic} />
            <AvatarFallback className="text-[9px] bg-accent font-medium">
              {m.userName?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {extra > 0 && (
          <div className="h-6 w-6 rounded-full bg-accent ring-[1.5px] ring-background flex items-center justify-center">
            <span className="text-[9px] font-medium text-muted-foreground">+{extra}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Headphones className="h-3 w-3 text-muted-foreground/40" />
        <span className="text-[11px] text-muted-foreground/50 font-medium">
          {members.length} listening
        </span>
      </div>
    </div>
  )
})

const UpNextHint = memo(({ nextSong, onQueueOpen }) => {
  if (!nextSong) return null

  return (
    <motion.button
      key={nextSong.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25 }}
      onClick={onQueueOpen}
      className="flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer"
    >
      <span className="text-[10px] font-semibold text-muted-foreground/35 uppercase tracking-widest shrink-0">
        Next
      </span>
      <div className="h-5 w-5 rounded overflow-hidden shrink-0 ring-1 ring-border/20">
        <img
          src={nextSong.image?.[0]?.link || nextSong.image?.[1]?.link}
          alt={nextSong.name}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="text-[11px] text-muted-foreground/60 truncate max-w-[100px] md:max-w-[160px]">
        {nextSong.name}
      </span>
      <SkipForward className="h-2.5 w-2.5 text-muted-foreground/25 shrink-0" />
    </motion.button>
  )
})

const ReactionBar = memo(({ onReact }) => {
  const cooldownRef = useRef({})
  const [tapped, setTapped] = useState(null)

  const handleTap = useCallback((emoji) => {
    const now = Date.now()
    if (cooldownRef.current[emoji] && now - cooldownRef.current[emoji] < 500) return
    cooldownRef.current[emoji] = now
    onReact(emoji)
    setTapped(emoji)
    setTimeout(() => setTapped(null), 300)
  }, [onReact])

  return (
    <div className="flex items-center gap-0.5">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleTap(emoji)}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent/60 transition-all cursor-pointer text-base",
            tapped === emoji ? "scale-125" : "active:scale-90",
          )}
          style={{ transition: "transform 0.15s ease" }}
        >
          {emoji}
        </button>
      ))}
    </div>
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
  upcomingQueue = [],
  queueCount = 0,
  groupMembers = [],
  sendReaction,
}) => {
  const isMuted = volume === 0
  const controlsDisabled = isLoading || isSyncing
  const nextSong = useMemo(() => upcomingQueue[0]?.song || null, [upcomingQueue])
  const progress = useMemo(() => (duration > 0 ? currentTime / duration : 0), [currentTime, duration])

  const handleSkip = useCallback(() => {
    if (onSkip) onSkip()
  }, [onSkip])

  const handleReact = useCallback((emoji) => {
    if (sendReaction) sendReaction(emoji)
  }, [sendReaction])

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
            className="mt-6 rounded-full px-6 gap-2 cursor-pointer"
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
    <div className="rounded-2xl border border-border/30 bg-accent/10 backdrop-blur-sm overflow-hidden relative">
      <FloatingReactionsOverlay />

      <AnimatePresence>
        <motion.div
          key={"glow-" + currentSong.id}
          initial={{ opacity: 0.6, scale: 0.5 }}
          animate={{ opacity: 0, scale: 2.5 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
        >
          <div className="w-32 h-32 rounded-full bg-primary/15 blur-2xl" />
        </motion.div>

        <motion.div
          key={"shimmer-" + currentSong.id}
          initial={{ x: "-100%", opacity: 1 }}
          animate={{ x: "200%", opacity: 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
          className="absolute inset-0 z-30 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, transparent 70%)",
          }}
        />
      </AnimatePresence>

      <div className="p-4 md:p-6">
        <div className="flex gap-3 md:gap-5">
          <motion.div
            key={currentSong.id}
            initial={{ scale: 0.88, opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0"
          >
            <div className="relative h-28 w-28 md:h-48 md:w-48">
              <div
                className={cn(
                  "relative h-full w-full rounded-xl overflow-hidden",
                  "transition-shadow duration-700",
                  isPlaying && !isSyncing
                    ? "shadow-[0_0_25px_-5px_hsl(var(--primary)/0.3)] md:shadow-[0_0_40px_-5px_hsl(var(--primary)/0.25)]"
                    : "shadow-lg",
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
            </div>
          </motion.div>

          <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
            <div className="space-y-0.5">
              <motion.h3
                key={currentSong.id + "-title"}
                initial={{ opacity: 0, x: 16, filter: "blur(2px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                className="text-base md:text-2xl font-bold line-clamp-1 leading-tight"
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

            <div key={currentSong.id + "-seek"} className="space-y-1 mt-2 md:mt-0">
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
                    "h-11 w-11 md:h-12 md:w-12 rounded-full cursor-pointer",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 hover:scale-105",
                    "transition-all duration-200 shadow-md",
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
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>

                <div className="hidden md:flex ml-1">
                  <ReactionBar onReact={handleReact} />
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onQueueOpen}
                  className="gap-1.5 rounded-full h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
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

            <div className="flex md:hidden mt-2">
              <ReactionBar onReact={handleReact} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-t border-border/10">
        <VibingAvatars members={groupMembers} />
        <AnimatePresence mode="wait">
          <UpNextHint nextSong={nextSong} onQueueOpen={onQueueOpen} />
        </AnimatePresence>
      </div>
    </div>
  )
}

export default memo(NowPlayingCard)
