import { memo, useState, useEffect, useRef, useCallback } from "react"
import ReactDOM from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  X,
  Volume2,
  Play,
  Square,
  Send,
  Sparkles,
  Loader2,
  RefreshCw,
  Music2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchSoundFeed, searchSounds, QUICK_SOUND_PRESETS } from "@/api/soundEffects"
import { soundEffectsManager } from "@/lib/soundEffectsManager"

const SoundItemCard = memo(({ sound, isPlaying, onTogglePlay, onSend }) => {
  return (
    <div
      className={cn(
        "group relative flex items-center justify-between gap-2 p-2 rounded-xl transition-colors duration-150",
        "border backdrop-blur-sm",
        isPlaying
          ? "bg-primary/10 border-primary/30 ring-1 ring-primary/30"
          : "bg-muted/30 border-border/15 hover:bg-muted/60 hover:border-border/30",
      )}
    >
      {/* Preview Play/Stop Button */}
      <button
        type="button"
        onClick={() => onTogglePlay(sound)}
        title={isPlaying ? "Stop preview" : "Preview sound"}
        className={cn(
          "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors duration-150 border-0",
          isPlaying
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
            : "bg-background/80 hover:bg-background text-foreground hover:scale-105 shadow-xs",
        )}
      >
        {isPlaying ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
        )}
      </button>

      {/* Sound Title & Equalizer */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onTogglePlay(sound)}
        title={sound.name}
      >
        <p className="text-[12.5px] font-medium text-foreground truncate leading-tight group-hover:text-primary transition-colors">
          {sound.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 h-3.5">
          {isPlaying ? (
            <div className="flex items-center gap-[2px] h-3">
              <span className="w-[2px] rounded-full bg-primary animate-sound-wave-1" />
              <span className="w-[2px] rounded-full bg-primary animate-sound-wave-2" />
              <span className="w-[2px] rounded-full bg-primary animate-sound-wave-3" />
              <span className="text-[9.5px] text-primary font-medium ml-1">Playing</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/45">Tap to preview</span>
          )}
        </div>
      </div>

      {/* Send to Chat Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSend(sound)
        }}
        title={`Send "${sound.name}" to group`}
        className={cn(
          "shrink-0 h-8 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all duration-200 border-0 text-[11px] font-medium",
          "bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground hover:scale-105 active:scale-95",
        )}
      >
        <Send className="h-3 w-3" />
        <span className="hidden sm:inline">Send</span>
      </button>
    </div>
  )
})

const SoundPicker = ({ anchorRef, toggleRef, onSelect, onClose }) => {
  const [query, setQuery] = useState("")
  const [sounds, setSounds] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const [pos, setPos] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState(null)

  const pickerRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Position calculation relative to anchor
  useEffect(() => {
    if (!anchorRef?.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
      width: rect.width,
    })
  }, [anchorRef])

  // Stop any playing preview when unmounting
  useEffect(() => {
    return () => {
      soundEffectsManager.stopPreview()
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        (!toggleRef?.current || !toggleRef.current.contains(e.target))
      ) {
        soundEffectsManager.stopPreview()
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose, toggleRef])

  // Escape key listener
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        soundEffectsManager.stopPreview()
        onClose()
      }
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [onClose])

  // Fetch sounds (initial or search)
  const loadSounds = useCallback(async (searchQuery, pageNum = 1, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    if (pageNum === 1) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      let res
      if (searchQuery?.trim()) {
        res = await searchSounds(searchQuery.trim(), pageNum, signal)
      } else {
        res = await fetchSoundFeed(pageNum, signal)
      }

      const newItems = res.data || []
      setSounds((prev) => (append ? [...prev, ...newItems] : newItems))
      setHasMore(newItems.length > 0)
      setPage(pageNum)
    } catch (err) {
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        console.error("Failed to load sound effects:", err)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadSounds("", 1, false)
  }, [loadSounds])

  // Handle Search Input Change
  const handleSearchChange = useCallback(
    (value) => {
      setQuery(value)
      setSelectedPreset(null)
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

      searchTimeoutRef.current = setTimeout(() => {
        loadSounds(value, 1, false)
      }, 350)
    },
    [loadSounds],
  )

  // Handle Preset Click
  const handlePresetClick = useCallback(
    (preset) => {
      if (selectedPreset === preset.id) {
        setSelectedPreset(null)
        setQuery("")
        loadSounds("", 1, false)
        return
      }
      setSelectedPreset(preset.id)
      setQuery(preset.query)
      loadSounds(preset.query, 1, false)
    },
    [selectedPreset, loadSounds],
  )

  // Toggle Sound Preview
  const handleTogglePlay = useCallback(
    (sound) => {
      if (playingId === sound.id) {
        soundEffectsManager.stopPreview()
        setPlayingId(null)
        return
      }

      setPlayingId(sound.id)
      soundEffectsManager.playPreview(
        sound.url,
        () => setPlayingId(null),
        () => setPlayingId(null),
      )
    },
    [playingId],
  )

  // Handle Send to Group
  const handleSendSound = useCallback(
    (sound) => {
      soundEffectsManager.stopPreview()
      setPlayingId(null)
      onSelect(sound)
    },
    [onSelect],
  )

  // Load More Pages
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    loadSounds(query, page + 1, true)
  }, [loadingMore, hasMore, query, page, loadSounds])

  if (!pos) return null

  return ReactDOM.createPortal(
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed flex flex-col rounded-2xl overflow-hidden border border-border/30 shadow-2xl backdrop-blur-xl"
      style={{
        bottom: pos.bottom,
        left: pos.left,
        width: pos.width,
        height: 440,
        zIndex: 9999,
        background: "hsl(var(--background) / 0.98)",
        boxShadow: "0 -8px 40px -8px rgba(0,0,0,0.5), 0 0 0 1px hsl(var(--border) / 0.15)",
      }}
    >
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border/15">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Volume2 className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Sound Effects Soundboard
            </h3>
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Live
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-6 w-6 rounded-md flex items-center justify-center cursor-pointer border-0 bg-transparent text-muted-foreground/50 hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search sound effects (e.g. bruh, vine boom)..."
            className="w-full rounded-xl h-9 pl-8 pr-8 text-xs outline-none transition-all duration-200"
            style={{
              background: "hsl(var(--muted) / 0.5)",
              border: "1px solid hsl(var(--border) / 0.3)",
              color: "hsl(var(--foreground))",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setSelectedPreset(null)
                loadSounds("", 1, false)
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded flex items-center justify-center cursor-pointer border-0 bg-transparent text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Quick Reaction Chips */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pt-2 pb-0.5">
          <button
            type="button"
            onClick={() => {
              setSelectedPreset(null)
              setQuery("")
              loadSounds("", 1, false)
            }}
            className={cn(
              "shrink-0 text-[10.5px] px-2.5 py-1 rounded-full font-medium transition-all duration-200 cursor-pointer border",
              !selectedPreset && !query
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/30 text-muted-foreground/70 hover:text-foreground border-border/20 hover:bg-muted/60",
            )}
          >
            🔥 Trending
          </button>
          {QUICK_SOUND_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={cn(
                "shrink-0 text-[10.5px] px-2.5 py-1 rounded-full font-medium transition-all duration-200 cursor-pointer border whitespace-nowrap",
                selectedPreset === preset.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground/70 hover:text-foreground border-border/20 hover:bg-muted/60",
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sounds Grid / List Area */}
      <div className="flex-1 overflow-y-auto chat-scroll-area p-2.5 min-h-0 space-y-1.5">
        {loading ? (
          <div className="sound-picker-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-xl animate-pulse"
                style={{ background: "hsl(var(--muted) / 0.3)" }}
              />
            ))}
          </div>
        ) : sounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-10 text-center">
            <Music2 className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/60 font-medium">
              {query ? `No sound effects found for "${query}"` : "No sounds available"}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setSelectedPreset(null)
                loadSounds("", 1, false)
              }}
              className="text-[11px] text-primary hover:underline font-medium cursor-pointer bg-transparent border-0 mt-1"
            >
              Reset search
            </button>
          </div>
        ) : (
          <>
            <div className="sound-picker-grid">
              {sounds.map((sound) => (
                <SoundItemCard
                  key={sound.id}
                  sound={sound}
                  isPlaying={playingId === sound.id}
                  onTogglePlay={handleTogglePlay}
                  onSend={handleSendSound}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2 pb-1">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-xs font-medium text-muted-foreground/70 hover:text-foreground bg-muted/40 hover:bg-muted/70 px-4 py-1.5 rounded-full border border-border/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      <span>Load More Sounds</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border/10">
        <span className="text-[9px] text-muted-foreground/35 tracking-wider uppercase">
          Powered by MyInstants
        </span>
        <span className="text-[9px] text-muted-foreground/35">
          {sounds.length > 0 ? `${sounds.length} sounds` : ""}
        </span>
      </div>
    </motion.div>,
    document.body,
  )
}

export default memo(SoundPicker)
