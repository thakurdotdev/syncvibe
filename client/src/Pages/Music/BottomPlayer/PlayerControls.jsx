import { motion } from "framer-motion"
import { ChevronDown, ListMusic } from "lucide-react"
import { memo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import { MusicControls, VolumeControl } from "../Common"
import SleepTimerModal from "../SleepTimer"

const PlayerControls = memo(({ onMinimize, onOpenModal, isMobile }) => {
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong)

  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [handlePlayPause, handleNextSong, handlePrevSong])

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <MusicControls showExtras={!isMobile} />

      <div className="hidden sm:flex items-center gap-1">
        <VolumeControl showVolume={true} />
      </div>

      <SleepTimerModal />

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            onOpenModal()
          }}
          className="hidden sm:flex h-9 w-9"
        >
          <ListMusic size={18} />
        </Button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" size="icon" className={cn("h-9 w-9 ")} onClick={onMinimize}>
          <ChevronDown size={18} />
        </Button>
      </motion.div>
    </div>
  )
})

PlayerControls.displayName = "PlayerControls"
export default PlayerControls
