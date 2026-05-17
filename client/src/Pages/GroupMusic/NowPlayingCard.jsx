import { memo, useCallback, useMemo, useRef, useState } from "react"
import { Slider } from "@/components/ui/slider"
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
  ChevronRight,
} from "lucide-react"
import { useGroupSessionStore } from "@/stores/groupMusic/sessionStore"

const REACTIONS = ["🔥", "❤️", "👏", "😍", "🎵"]

const FloatingReaction = memo(({ emoji, id }) => {
  const cfg = useMemo(() => ({
    x: Math.random() * 70 + 15,
    drift: (Math.random() - 0.5) * 30,
    scale: 0.9 + Math.random() * 0.5,
    dur: 2 + Math.random() * 0.6,
  }), [])

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 0.3 }}
      animate={{ opacity: [1, 1, 0], y: -100, x: cfg.drift, scale: [0.3, cfg.scale, cfg.scale * 0.7] }}
      transition={{ duration: cfg.dur, ease: "easeOut" }}
      className="absolute bottom-4 pointer-events-none select-none"
      style={{ left: `${cfg.x}%`, transform: "translateX(-50%)" }}
      onAnimationComplete={() => {
        useGroupSessionStore.setState((s) => ({
          floatingReactions: s.floatingReactions.filter((r) => r.id !== id),
        }))
      }}
    >
      <span className="text-2xl drop-shadow-lg">{emoji}</span>
    </motion.div>
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
  const disabled = isLoading || isSyncing
  const nextSong = useMemo(() => upcomingQueue[0]?.song || null, [upcomingQueue])
  const artist = currentSong?.artist_map?.primary_artists?.[0]?.name || "Unknown Artist"
  const addedBy = currentQueueItem?.addedBy
  const reactions = useGroupSessionStore((s) => s.floatingReactions)
  const cooldownRef = useRef({})
  const [tapped, setTapped] = useState(null)

  const handleReact = useCallback((emoji) => {
    const now = Date.now()
    if (cooldownRef.current[emoji] && now - cooldownRef.current[emoji] < 500) return
    cooldownRef.current[emoji] = now
    sendReaction?.(emoji)
    setTapped(emoji)
    setTimeout(() => setTapped(null), 300)
  }, [sendReaction])

  if (!currentSong) {
    return (
      <div className="rounded-2xl liquid-panel overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 md:py-20 px-4">
          <div className="p-5 rounded-full liquid-badge mb-5">
            <AudioLines className="h-9 w-9 text-muted-foreground/30" />
          </div>
          <p className="text-base font-semibold text-muted-foreground/70">No song playing</p>
          <p className="text-sm text-muted-foreground/50 mt-1">Search for songs to get started</p>
          <button
            onClick={onSearchOpen}
            className="mt-5 liquid-btn rounded-full px-6 py-2.5 gap-2 cursor-pointer flex items-center text-sm font-medium"
          >
            <Search className="h-3.5 w-3.5" />
            Find a Song
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl liquid-panel overflow-hidden relative">
      {reactions.length > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
          <AnimatePresence>
            {reactions.map((r) => <FloatingReaction key={r.id} {...r} />)}
          </AnimatePresence>
        </div>
      )}

      {/* ═══ MOBILE ═══ */}
      <div className="md:hidden p-4 space-y-3">
        {/* Song info row */}
        <div className="flex gap-3">
          <div
            className={cn(
              "shrink-0 h-[72px] w-[72px] rounded-xl overflow-hidden relative ring-1 ring-border/30",
              isPlaying && !isSyncing && "shadow-lg shadow-primary/10",
            )}
          >
            <img src={currentSong.image?.[2]?.link} alt="" className="h-full w-full object-cover" />
            {isPlaying && !isSyncing && (
              <div className="absolute bottom-0 inset-x-0 h-5 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-1">
                <div className="flex items-end gap-[2px] h-2.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="w-[2px] bg-white/80 rounded-full animate-wave" style={{ animationDelay: `${i * 0.15}s`, height: "100%", transformOrigin: "bottom" }} />
                  ))}
                </div>
              </div>
            )}
            {isSyncing && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-sm font-bold line-clamp-2 leading-snug">{currentSong.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{artist}</p>
            {addedBy && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 flex items-center gap-1">
                <Avatar className="h-3 w-3"><AvatarImage src={addedBy.profilePic} /><AvatarFallback className="text-[5px] bg-accent">{addedBy.userName?.[0]}</AvatarFallback></Avatar>
                {addedBy.userName}
              </p>
            )}
          </div>
        </div>

        {/* Seek bar */}
        <div className="space-y-0.5">
          <Slider onValueChange={onSeek} value={[currentTime]} max={duration || 100} step={1} className="cursor-pointer" />
          <div className="flex justify-between text-[10px] text-muted-foreground/50 tabular-nums font-mono px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPlayPause()}
              disabled={disabled}
              className="h-10 w-10 rounded-full liquid-panel-elevated flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
            >
              {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              onClick={() => onSkip?.()}
              disabled={disabled}
              className="h-8 w-8 rounded-full liquid-btn flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => handleReact(e)} className={cn("h-7 w-7 flex items-center justify-center rounded-full cursor-pointer text-sm transition-transform duration-150", tapped === e ? "scale-125 bg-accent" : "hover:bg-accent/50 active:scale-90")}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between pt-2 border-t border-border/15">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              {groupMembers.slice(0, 3).map((m) => (
                <Avatar key={m.userId} className="h-4 w-4 ring-1 ring-border/40"><AvatarImage src={m.profilePic} /><AvatarFallback className="text-[6px] bg-accent">{m.userName?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/50">{groupMembers.length} listening</span>
          </div>
          {nextSong && (
            <button onClick={onQueueOpen} className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer">
              <span className="uppercase tracking-wider font-semibold">Next</span>
              <span className="text-muted-foreground/60 truncate max-w-20">{nextSong.name}</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ═══ DESKTOP ═══ */}
      <div className="hidden md:block">
        {/* Zone 1: Art + Info */}
        <div className="flex gap-5 p-5 lg:p-6 pb-0 lg:pb-0">
          <div
            className={cn(
              "shrink-0 h-32 w-32 lg:h-36 lg:w-36 rounded-2xl overflow-hidden relative ring-1 ring-border/30",
              isPlaying && !isSyncing && "shadow-xl shadow-primary/10",
            )}
          >
            <img src={currentSong.image?.[2]?.link} alt="" className="h-full w-full object-cover" />
            <AnimatePresence>
              {isPlaying && !isSyncing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-2">
                  <div className="flex items-end gap-[3px] h-3.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="w-[3px] bg-white/80 rounded-full animate-wave" style={{ animationDelay: `${i * 0.15}s`, height: "100%", transformOrigin: "bottom" }} />
                    ))}
                  </div>
                </motion.div>
              )}
              {isSyncing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-1">
                  <Radio className="h-5 w-5 text-primary animate-pulse" />
                  <span className="text-[10px] font-medium text-white/80">Syncing</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="text-2xl lg:text-3xl font-bold tracking-tight line-clamp-1">{currentSong.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground line-clamp-1">{artist}</p>
              {addedBy && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
                  · <Avatar className="h-3.5 w-3.5"><AvatarImage src={addedBy.profilePic} /><AvatarFallback className="text-[6px] bg-accent">{addedBy.userName?.[0]}</AvatarFallback></Avatar>
                  {addedBy.userName}
                </span>
              )}
            </div>
            {currentSong.album && <p className="text-xs text-muted-foreground/50 mt-0.5 line-clamp-1">{currentSong.album}</p>}
            {isSyncing && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg liquid-badge mt-2 w-fit">
                <Radio className="h-3 w-3 text-primary animate-pulse" />
                <span className="text-[11px] font-medium text-muted-foreground">Syncing{syncCountdown > 0 ? ` ${syncCountdown}s` : "…"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Zone 2: Seek bar */}
        <div className="px-5 lg:px-6 pt-4 space-y-0.5">
          <Slider onValueChange={onSeek} value={[currentTime]} max={duration || 100} step={1} className="cursor-pointer" />
          <div className="flex justify-between text-xs text-muted-foreground/50 tabular-nums font-mono px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Zone 3: Controls */}
        <div className="flex items-center justify-between px-5 lg:px-6 pt-3 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPlayPause()}
              disabled={disabled}
              className="h-11 w-11 rounded-full liquid-panel-elevated flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
            >
              {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>
            <button
              onClick={() => onSkip?.()}
              disabled={disabled}
              className="h-9 w-9 rounded-full liquid-btn flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="h-5 w-px bg-border/20 mx-1" />

            <div className="flex items-center gap-0.5">
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => handleReact(e)} className={cn("h-8 w-8 flex items-center justify-center rounded-full cursor-pointer text-base transition-transform duration-150", tapped === e ? "scale-125 bg-accent" : "hover:bg-accent/50 active:scale-90")}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onQueueOpen}
              className="liquid-btn gap-1.5 rounded-full h-8 px-3.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center font-medium"
            >
              <ListMusic className="h-3.5 w-3.5" />
              Queue
              {queueCount > 0 && (
                <span className="h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground flex items-center justify-center">{queueCount}</span>
              )}
            </button>
            <div className="flex items-center gap-1 w-24">
              <button className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer" onClick={() => onVolumeChange(isMuted ? [0.5] : [0])}>
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <Slider value={[volume]} max={1} step={0.01} onValueChange={onVolumeChange} className="flex-1" />
            </div>
          </div>
        </div>

        {/* Zone 4: Footer */}
        <div className="flex items-center justify-between px-5 lg:px-6 py-2.5 border-t border-border/15">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {groupMembers.slice(0, 4).map((m) => (
                <Avatar key={m.userId} className="h-5 w-5 ring-[1.5px] ring-border/40"><AvatarImage src={m.profilePic} /><AvatarFallback className="text-[8px] bg-accent">{m.userName?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
              ))}
              {groupMembers.length > 4 && (
                <div className="h-5 w-5 rounded-full liquid-badge ring-[1.5px] ring-border/40 flex items-center justify-center">
                  <span className="text-[8px] font-medium text-muted-foreground">+{groupMembers.length - 4}</span>
                </div>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground/50 font-medium flex items-center gap-1">
              <Headphones className="h-3 w-3" />
              {groupMembers.length} listening
            </span>
          </div>
          {nextSong && (
            <button onClick={onQueueOpen} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
              <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Next</span>
              <div className="h-5 w-5 rounded-md overflow-hidden ring-1 ring-border/30">
                <img src={nextSong.image?.[0]?.link} alt="" className="h-full w-full object-cover" />
              </div>
              <span className="text-[11px] text-muted-foreground/60 truncate max-w-28">{nextSong.name}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(NowPlayingCard)
