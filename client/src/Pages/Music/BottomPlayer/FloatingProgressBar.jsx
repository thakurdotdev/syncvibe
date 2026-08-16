import { memo, useCallback, useEffect, useRef, useState } from "react"
import { usePlayerStore } from "@/stores/playerStore"
import { formatTime } from "../Common"
import { cn } from "@/lib/utils"

const FloatingProgressBar = memo(() => {
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const handleTimeSeek = usePlayerStore((s) => s.handleTimeSeek)

  const [hoverTime, setHoverTime] = useState(null)
  const [hoverX, setHoverX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef(null)

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  const calculateTimeFromEvent = useCallback(
    (e) => {
      if (!trackRef.current || !duration) return 0
      const rect = trackRef.current.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      const pct = x / rect.width
      return { time: pct * duration, x }
    },
    [duration],
  )

  const handlePointerDown = (e) => {
    e.stopPropagation()
    setIsDragging(true)
    const result = calculateTimeFromEvent(e)
    if (result) {
      setHoverTime(result.time)
      setHoverX(result.x)
      handleTimeSeek(result.time)
    }
  }

  const handlePointerMove = (e) => {
    const result = calculateTimeFromEvent(e)
    if (result) {
      setHoverTime(result.time)
      setHoverX(result.x)
      if (isDragging) {
        handleTimeSeek(result.time)
      }
    }
  }

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverTime(null)
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const onPointerMove = (e) => {
      const result = calculateTimeFromEvent(e)
      if (result) {
        setHoverTime(result.time)
        setHoverX(result.x)
        handleTimeSeek(result.time)
      }
    }

    const onPointerUp = () => {
      setIsDragging(false)
      setHoverTime(null)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [isDragging, calculateTimeFromEvent, handleTimeSeek])

  const showTooltip = (hoverTime !== null || isDragging) && duration > 0
  const displayTime = isDragging ? currentTime : hoverTime

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Track progress"
      aria-valuemin={0}
      aria-valuemax={duration || 1}
      aria-valuenow={currentTime}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") handleTimeSeek(Math.min(duration, currentTime + 5))
        if (e.key === "ArrowLeft") handleTimeSeek(Math.max(0, currentTime - 5))
      }}
      className="absolute bottom-0 left-3 right-3 sm:left-4 sm:right-4 h-3 flex items-center cursor-pointer group/bar z-30 select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Floating timestamp tooltip */}
      {showTooltip && (
        <div
          className="absolute z-40 -top-6.5 pointer-events-none -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#0a0c12]/95 backdrop-blur-md border border-white/20 text-[10px] font-mono font-medium text-white shadow-xl tabular-nums animate-in fade-in zoom-in-95 duration-150"
          style={{ left: `${hoverX}px` }}
        >
          {formatTime(displayTime)}
        </div>
      )}

      {/* Inset Rounded Track */}
      <div className="w-full h-[2px] group-hover/bar:h-[3.5px] bg-white/12 group-hover/bar:bg-white/20 rounded-full transition-all duration-200 overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-white/90 via-primary to-primary rounded-full transition-[width] duration-75 ease-linear relative"
          style={{ width: `${progressPct}%` }}
        >
          <div className="absolute top-0 right-0 bottom-0 w-3 bg-white/50 blur-[1px] rounded-full" />
        </div>
      </div>

      {/* Scrubber Knob on Hover */}
      <div
        className={cn(
          "absolute -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] transition-all duration-150 pointer-events-none",
          showTooltip ? "opacity-100 scale-100" : "opacity-0 scale-50",
        )}
        style={{ left: `${(progressPct / 100) * (trackRef.current?.clientWidth || 0)}px` }}
      />
    </div>
  )
})

FloatingProgressBar.displayName = "FloatingProgressBar"
export default FloatingProgressBar
