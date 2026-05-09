import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ListPlus, MoreVertical, Play } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"

const SongItem = memo(({ song, onPlayNow, onAddToQueue, compact = false }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handlePlayNow = useCallback(() => {
    onPlayNow(song)
    setIsMenuOpen(false)
  }, [song, onPlayNow])

  const handleAddToQueue = useCallback(() => {
    onAddToQueue(song)
    setIsMenuOpen(false)
  }, [song, onAddToQueue])

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
        "group flex items-center gap-2.5 rounded-xl w-full",
        "hover:bg-accent/50 transition-colors duration-150",
        compact ? "p-1.5" : "px-2 py-2",
      )}
    >
      <div
        onClick={handlePlayNow}
        className={cn(
          "relative rounded-lg overflow-hidden shrink-0 cursor-pointer",
          compact ? "h-9 w-9" : "h-10 w-10",
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
            "absolute inset-0 bg-black/60 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
          )}
        >
          <Play className="h-3.5 w-3.5 text-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlayNow}>
        <p className="font-medium truncate text-sm group-hover:text-primary transition-colors">
          {song.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{artistName}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {!compact && duration && (
          <span className="text-xs text-muted-foreground tabular-nums">{duration}</span>
        )}

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground cursor-pointer">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handlePlayNow} className="gap-2 cursor-pointer">
              <Play className="h-4 w-4" />
              Play Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddToQueue} className="gap-2 cursor-pointer">
              <ListPlus className="h-4 w-4" />
              Add to Queue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

export default SongItem
