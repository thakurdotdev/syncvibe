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
        "group flex items-center gap-3 rounded-xl w-full",
        "hover:bg-accent/60 active:bg-accent/80 transition-all duration-200",
        compact ? "p-1.5" : "px-2.5 py-2",
      )}
    >
      <div
        onClick={handlePlayNow}
        className={cn(
          "relative rounded-lg overflow-hidden shrink-0 cursor-pointer shadow-sm",
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
            "absolute inset-0 bg-black/50 flex items-center justify-center",
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
        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{artistName}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {!compact && duration && (
          <span className="text-[11px] text-muted-foreground/60 tabular-nums font-mono mr-1">{duration}</span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleAddToQueue}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors duration-200"
          title="Add to queue"
        >
          <ListPlus className="h-4 w-4" />
        </Button>

        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground cursor-pointer">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            <DropdownMenuItem onClick={handlePlayNow} className="gap-2.5 cursor-pointer rounded-lg">
              <Play className="h-4 w-4" />
              Play Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddToQueue} className="gap-2.5 cursor-pointer rounded-lg">
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
