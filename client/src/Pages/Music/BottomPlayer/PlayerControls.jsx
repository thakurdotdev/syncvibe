import { AnimatePresence, motion } from "framer-motion"
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react"
import { memo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { usePlayerStore } from "@/stores/playerStore"
import { useGroupSessionStore } from "@/stores/groupMusic/sessionStore"

const PlayerControls = memo(() => {
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const closePlayer = usePlayerStore((s) => s.closePlayer)
  const isGroupActive = useGroupSessionStore((s) => !!s.currentGroup)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isGroupActive) return

      if (
        e.key === " " &&
        document.activeElement &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
      ) {
        e.preventDefault()
        handlePlayPause()
      }
      if (e.key === "ArrowRight") handleNextSong()
      if (e.key === "ArrowLeft") handlePrevSong()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isGroupActive, handlePlayPause, handleNextSong, handlePrevSong])

  const btnAnim = { hover: { scale: 1.1 }, tap: { scale: 0.92 } }
  const playAnim = { hover: { scale: 1.06 }, tap: { scale: 0.94 } }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {/* Previous Track */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={btnAnim} whileHover="hover" whileTap="tap">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevSong}
                className="h-7 w-7 sm:h-8.5 sm:w-8.5 text-white/75 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                aria-label="Previous"
              >
                <SkipBack className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Previous
          </TooltipContent>
        </Tooltip>

        {/* Primary Play / Pause Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={playAnim} whileHover="hover" whileTap="tap">
              <Button
                size="icon"
                onClick={handlePlayPause}
                className="h-9.5 w-9.5 sm:h-12 sm:w-12 rounded-full bg-white text-black hover:bg-white/95 shadow-[0_4px_18px_rgba(255,255,255,0.25)] transition-all flex items-center justify-center cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isPlaying ? "pause" : "play"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="flex items-center justify-center"
                  >
                    {isPlaying ? (
                      <Pause className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5" fill="currentColor" />
                    ) : (
                      <Play className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5 ml-0.5" fill="currentColor" />
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

        {/* Next Track */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={btnAnim} whileHover="hover" whileTap="tap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleNextSong(false)}
                className="h-7 w-7 sm:h-8.5 sm:w-8.5 text-white/75 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                aria-label="Next"
              >
                <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="currentColor" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Next
          </TooltipContent>
        </Tooltip>

        {/* Close Action */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div variants={btnAnim} whileHover="hover" whileTap="tap">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  closePlayer()
                }}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Close
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
})

PlayerControls.displayName = "PlayerControls"
export default PlayerControls
