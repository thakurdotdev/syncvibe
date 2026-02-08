import { useDraggable } from "@dnd-kit/core"
import he from "he"
import { Pause, Play } from "lucide-react"
import { memo, useMemo } from "react"
import { usePlayerStore } from "@/stores/playerStore"

const ProgressRing = memo(({ progress, size = 44, strokeWidth = 2.5 }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <svg className="progress-ring absolute inset-0" width={size} height={size}>
      <circle
        className="text-white/10"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        className="progress-ring-circle text-primary"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
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
  <div className="flex items-center gap-0.5 h-4">
    <div className="audio-bar" style={{ animationDelay: "0s" }} />
    <div className="audio-bar" style={{ animationDelay: "0.2s" }} />
    <div className="audio-bar" style={{ animationDelay: "0.4s" }} />
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
      "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png",
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
    zIndex: 9999,
    cursor: isDragging ? "grabbing" : "grab",
  }

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={style} className="select-none">
      <div
        className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#1a1a1a] border border-white/8 transition-transform ${
          isDragging ? "scale-105" : ""
        }`}
      >
        <div
          className="relative w-11 h-11 shrink-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            if (!isDragging) handlePlayPause()
          }}
        >
          <ProgressRing progress={progress} size={44} strokeWidth={2.5} />
          <div className="absolute inset-[3px] rounded-full overflow-hidden">
            <img
              src={songImage}
              alt=""
              className={`w-full h-full object-cover ${isPlaying ? "rotate-animation" : ""}`}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity">
            {isPlaying ? (
              <Pause size={14} className="text-white" fill="currentColor" />
            ) : (
              <Play size={14} className="text-white ml-0.5" fill="currentColor" />
            )}
          </div>
        </div>

        <div
          onClick={(e) => {
            e.stopPropagation()
            if (!isDragging) onMaximize()
          }}
          className="flex items-center gap-2 cursor-pointer"
        >
          {isPlaying && <AudioWaveVisual />}
          <span className="text-sm text-white font-medium max-w-[80px] truncate">
            {he.decode(currentSong?.name || "")}
          </span>
        </div>
      </div>
    </div>
  )
})

ProgressRing.displayName = "ProgressRing"
AudioWaveVisual.displayName = "AudioWaveVisual"
DraggableButton.displayName = "DraggableButton"
export default DraggableButton
