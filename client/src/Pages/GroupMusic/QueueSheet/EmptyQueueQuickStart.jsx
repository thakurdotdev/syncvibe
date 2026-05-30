import { cn } from "@/lib/utils"
import { Play, Plus, History, Sparkles, ChevronDown } from "lucide-react"
import { memo, useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { fetchGroupHistory } from "@/api/music/history"
import { toast } from "sonner"

const EmptyQueueQuickStart = memo(({ userId, onAddToQueue, playNow }) => {
  const [historyItems, setHistoryItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (!userId) return
    let isMounted = true
    setIsLoading(true)
    fetchGroupHistory(userId)
      .then((data) => {
        if (isMounted) setHistoryItems(data || [])
      })
      .catch((err) => {
        console.error("Failed to load group history for quickstart", err)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [userId])

  const handleResumeVibe = useCallback(
    (e) => {
      e.stopPropagation()
      if (!historyItems.length) return
      const songsToEnqueue = historyItems
        .map((item) => item.songData)
        .filter(Boolean)
      
      if (songsToEnqueue.length > 0) {
        songsToEnqueue.slice(0, 5).forEach((song) => onAddToQueue(song))
        toast.success("Loaded last session's vibe into the queue!")
      }
    },
    [historyItems, onAddToQueue]
  )

  if (isLoading || !historyItems.length) return null

  const displaySongs = historyItems
    .map((item) => item.songData)
    .filter(Boolean)
    .slice(0, 3)

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="rounded-2xl border border-border bg-card text-card-foreground overflow-hidden transition-all duration-300 shadow-xs"
    >
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-accent/40 active:bg-accent/60 transition-all duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <History className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-left">
              <h3 className="text-xs font-semibold tracking-wide">
                Last Session Vibe
              </h3>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {displaySongs.map((s) => s.name).join(", ")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <motion.div whileTap={{ scale: 0.96, transition: { duration: 0.1 } }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResumeVibe}
                className="h-8 text-[11px] font-semibold flex items-center gap-1 shrink-0 px-3 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                Resume
              </Button>
            </motion.div>
            
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-300",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4 pt-1 border-t border-border bg-accent/10">
        <div className="grid grid-cols-3 gap-2.5 mt-2">
          {displaySongs.map((song) => {
            const artist = song.artist_map?.primary_artists?.[0]?.name || "Artist"
            return (
              <div
                key={song.id}
                className="group relative flex flex-col p-2 rounded-xl bg-card hover:bg-accent transition-all duration-200 text-left min-w-0 border border-border"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden ring-1 ring-border/20 shrink-0">
                  <img
                    src={song.image?.[1]?.link || "/placeholder-album.png"}
                    alt={song.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        playNow(song)
                      }}
                      className="h-7 w-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Play className="h-3 w-3 fill-black text-black ml-0.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToQueue(song)
                      }}
                      className="h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 min-w-0">
                  <p className="text-[11px] font-semibold truncate group-hover:text-primary transition-colors">
                    {song.name}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {artist}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})

export default EmptyQueueQuickStart
