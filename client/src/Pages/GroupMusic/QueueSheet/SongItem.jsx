import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Bookmark, ListPlus, MoreVertical, Play, SkipForward } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"

const SongItem = memo(
  ({ song, onPlayNow, onAddToQueue, onPlayNext, onSaveToPlaylist, compact = false }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    const handlePlayNow = useCallback(() => {
      onPlayNow(song)
      setIsMenuOpen(false)
    }, [song, onPlayNow])

    const handleAddToQueue = useCallback(() => {
      onAddToQueue(song)
      setIsMenuOpen(false)
    }, [song, onAddToQueue])

    const handlePlayNext = useCallback(() => {
      onPlayNext?.(song)
      setIsMenuOpen(false)
    }, [song, onPlayNext])

    const handleSave = useCallback(() => {
      onSaveToPlaylist?.(song)
      setIsMenuOpen(false)
    }, [song, onSaveToPlaylist])

    const artistName = useMemo(
      () => song.artist_map?.primary_artists?.[0]?.name || "Unknown Artist",
      [song.artist_map?.primary_artists],
    )

    const duration = useMemo(() => {
      if (!song.duration) return null
      const mins = Math.floor(song.duration / 60)
      const secs = String(song.duration % 60).padStart(2, "0")
      return `${mins}:${secs}`
    }, [song.duration])

    return (
      <div
        className={cn(
          "group flex items-center gap-3 rounded-xl w-full",
          "liquid-hover-row",
          compact ? "p-1.5" : "px-2.5 py-2",
        )}
      >
        <div
          onClick={handlePlayNow}
          className={cn(
            "relative rounded-xl overflow-hidden shrink-0 cursor-pointer",
            "ring-1 ring-border/30",
            compact ? "h-9 w-9" : "h-11 w-11",
          )}
        >
          <img
            src={song.image?.[1]?.link}
            alt={song.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div
            className={cn(
              "absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
            )}
          >
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlayNow}>
          <p className="font-medium truncate text-sm group-hover:text-primary transition-colors duration-200">
            {song.name}
          </p>
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{artistName}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {!compact && duration && (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums font-mono mr-1">
              {duration}
            </span>
          )}

          <button
            onClick={handleAddToQueue}
            className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground/70 hover:text-primary hover:bg-accent/50 cursor-pointer transition-all duration-200 press-scale"
            title="Add to queue"
          >
            <ListPlus className="h-4 w-4" />
          </button>

          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 cursor-pointer transition-all duration-200">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-2xl border-white/[0.08] bg-background/95 backdrop-blur-xl"
            >
              <DropdownMenuItem
                onClick={handlePlayNow}
                className="gap-2.5 cursor-pointer rounded-xl"
              >
                <Play className="h-4 w-4" />
                Play Now
              </DropdownMenuItem>
              {onPlayNext && (
                <DropdownMenuItem
                  onClick={handlePlayNext}
                  className="gap-2.5 cursor-pointer rounded-xl"
                >
                  <SkipForward className="h-4 w-4" />
                  Play Next
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleAddToQueue}
                className="gap-2.5 cursor-pointer rounded-xl"
              >
                <ListPlus className="h-4 w-4" />
                Add to Queue
              </DropdownMenuItem>
              {onSaveToPlaylist && (
                <>
                  <DropdownMenuSeparator className="bg-border/30" />
                  <DropdownMenuItem
                    onClick={handleSave}
                    className="gap-2.5 cursor-pointer rounded-xl"
                  >
                    <Bookmark className="h-4 w-4" />
                    Save to Playlist
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  },
)

export default SongItem
