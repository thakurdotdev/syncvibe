import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Mic, X } from "lucide-react"
import { memo, useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { useBackendSearchQuery } from "@/hooks/queries/useSongQueries"
import { useVoiceCommandExecutor } from "@/hooks/useVoiceCommandExecutor"
import { useVoiceControl } from "@/hooks/useVoiceControl"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"

const AudioWave = memo(() => (
  <div className="flex items-center gap-0.5 h-4">
    {[0, 0.1, 0.2, 0.3, 0.2].map((delay, i) => (
      <motion.div
        key={i}
        className="w-0.5 bg-white rounded-full"
        animate={{ height: ["8px", "16px", "8px"] }}
        transition={{ duration: 0.6, repeat: Infinity, delay }}
      />
    ))}
  </div>
))

const FloatingVoiceControl = memo(() => {
  const currentSong = usePlayerStore((s) => s.currentSong)
  const setCurrentSong = usePlayerStore((s) => s.setCurrentSong)
  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const { executeCommand } = useVoiceCommandExecutor()

  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const { data: searchResults, isLoading: searchLoading } = useBackendSearchQuery(searchQuery, {
    enabled: !!searchQuery && isSearching,
  })

  useEffect(() => {
    if (searchResults?.songs?.length > 0 && isSearching) {
      const songs = searchResults.songs.slice(0, 5)
      setPlaylist(songs)
      setCurrentSong(songs[0])
      toast.success(`Playing "${songs[0].name || songs[0].title}"`, { duration: 2000 })
      setSearchQuery("")
      setIsSearching(false)
    } else if (searchResults && searchResults.songs?.length === 0 && isSearching) {
      toast.error(`No songs found for "${searchQuery}"`, { duration: 2000 })
      setSearchQuery("")
      setIsSearching(false)
    }
  }, [searchResults, isSearching, setPlaylist, setCurrentSong, searchQuery])

  const handleCommand = useCallback(
    (intent) => {
      if (!intent) return

      if (intent.action === "search" && intent.query) {
        setSearchQuery(intent.query)
        setIsSearching(true)
        return
      }

      const result = executeCommand(intent)
      if (result.success) {
        toast.success(result.message, { duration: 2000 })
      } else {
        toast.error(result.message || "Command not recognized", { duration: 2000 })
      }
    },
    [executeCommand],
  )

  const { isListening, isSupported, transcript, error, startListening, stopListening } =
    useVoiceControl({ onCommand: handleCommand })

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  if (!isSupported || !currentSong) return null

  const showSearching = isSearching && searchLoading

  const content = (
    <div className="fixed bottom-20 right-4 z-[9999] flex flex-col items-end gap-2">
      <AnimatePresence>
        {(isListening || showSearching) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-background/95 backdrop-blur-md border border-border rounded-xl px-4 py-3 shadow-xl min-w-[180px]"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                {showSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <AudioWave />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {showSearching ? "Searching..." : "Listening..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {showSearching ? searchQuery : "Say a command"}
                </p>
              </div>
            </div>
            {transcript && !showSearching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-muted/50 rounded-lg px-3 py-2"
              >
                <p className="text-sm text-foreground">"{transcript}"</p>
              </motion.div>
            )}
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleClick}
        disabled={showSearching}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors",
          isListening || showSearching
            ? "bg-primary text-primary-foreground"
            : "bg-background/95 backdrop-blur-md border border-border text-foreground hover:bg-accent",
        )}
      >
        {(isListening || showSearching) && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
          </>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isListening ? "listening" : showSearching ? "searching" : "idle"}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {showSearching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isListening ? (
              <X className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )

  return createPortal(content, document.body)
})

AudioWave.displayName = "AudioWave"
FloatingVoiceControl.displayName = "FloatingVoiceControl"
export default FloatingVoiceControl
