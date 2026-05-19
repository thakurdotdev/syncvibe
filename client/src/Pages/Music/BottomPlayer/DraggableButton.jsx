import { useDraggable } from "@dnd-kit/core"
import he from "he"
import { Pause, Play, Maximize2 } from "lucide-react"
import { memo, useMemo } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { cn } from "@/lib/utils"

const ProgressRing = memo(({ progress, size = 44, strokeWidth = 2.5 }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
      <circle
        className="text-muted-foreground/10"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className="text-primary transition-all duration-500 ease-out"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  )
})

const AudioWaveVisual = memo(() => (
  <div className="flex items-center gap-0.5 h-3">
    {[0, 0.2, 0.4].map((delay) => (
      <div
        key={delay}
        className="w-0.5 h-full bg-primary animate-music-bar"
        style={{ animationDelay: `${delay}s` }}
      />
    ))}
  </div>
))

const DraggableButton = memo(({ position, onMaximize, currentSong, isDragging }) => {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "minimized-player",
  })

  const songImage = useMemo(
    () =>
      currentSong?.image?.[2]?.link ||
      currentSong?.image?.[1]?.link ||
      "https://res.cloudinary.com/dr7lkelwl/image/upload/v1731395454/j6r5zemodfexdxid4gcx.png",
    [currentSong],
  )

  const progress = useMemo(() => {
    if (!duration) return 0
    return (currentTime / duration) * 100
  }, [currentTime, duration])

  const style = {
    position: "fixed",
    top: transform ? position.y + transform.y : position.y,
    left: transform ? position.x + transform.x : position.x,
    touchAction: "none",
    zIndex: 10,
  }

  const artists = useMemo(() => {
    const artistData = currentSong?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((artist) => artist.name)
      .join(", ") ||
      currentSong?.primaryArtists ||
      currentSong?.artist

    return artistData ? he.decode(artistData) : "Unknown Artist"
  }, [currentSong])

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="select-none group"
    >
      <div
        className={cn(
          "liquid-glass flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full transition-all duration-500 overflow-hidden relative",
          isDragging ? "scale-110 cursor-grabbing brightness-110" : "cursor-grab hover:scale-105 hover:brightness-110",
        )}
      >
        {/* Dynamic Ambient Background */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <img
            src={songImage}
            alt=""
            className="w-full h-full object-cover blur-2xl opacity-40 scale-150 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        <div
          className="relative w-9 h-9 shrink-0 shadow-lg"
          onClick={(e) => {
            e.stopPropagation()
            if (!isDragging) handlePlayPause()
          }}
        >
          <ProgressRing progress={progress} size={36} strokeWidth={2} />
          <div className="absolute inset-[2px] rounded-full overflow-hidden border border-border/30">
            <img
              src={songImage}
              alt=""
              className="w-full h-full object-cover"
              style={{
                animation: isPlaying ? "album-spin 10s linear infinite" : "none",
              }}
              draggable={false}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {isPlaying ? (
              <Pause size={12} className="text-white fill-white" />
            ) : (
              <Play size={12} className="text-white fill-white ml-0.5" />
            )}
          </div>
        </div>

        <div
          onClick={(e) => {
            e.stopPropagation()
            if (!isDragging) onMaximize()
          }}
          className="flex flex-col min-w-0 max-w-[120px] cursor-pointer"
        >
          <span className="text-[12.5px] text-foreground font-bold truncate leading-tight">
            {he.decode(currentSong?.name || "Unknown")}
          </span>
          <span className="text-[10.5px] text-muted-foreground truncate font-semibold">
            {artists}
          </span>
        </div>
      </div>

      {/* Dynamic Glow */}
      <div className="absolute -inset-4 pointer-events-none -z-20 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <img
          src={songImage}
          alt=""
          className="w-full h-full object-cover blur-3xl opacity-30 scale-150"
        />
      </div>
    </div>
  )
})

DraggableButton.displayName = "DraggableButton"
export default DraggableButton
