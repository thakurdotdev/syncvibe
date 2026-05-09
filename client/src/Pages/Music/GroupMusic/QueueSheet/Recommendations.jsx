import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, ListPlus, Loader2, Plus, Sparkles } from "lucide-react"
import { memo, useCallback, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

const RecCard = memo(({ song, onAdd }) => {
  const [added, setAdded] = useState(false)

  const handleAdd = useCallback((e) => {
    e.stopPropagation()
    if (added) return
    onAdd(song)
    setAdded(true)
  }, [song, onAdd, added])

  return (
    <div
      className={cn(
        "flex-none w-32 sm:w-36 rounded-xl border border-border/40 bg-accent/20",
        "hover:bg-accent/50 transition-all overflow-hidden group",
        added && "opacity-50 pointer-events-none",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <img
          src={song.image?.[1]?.link || song.image?.[2]?.link}
          alt={song.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <button
          onClick={handleAdd}
          className={cn(
            "absolute bottom-1.5 right-1.5 p-1.5 rounded-full transition-all cursor-pointer",
            "bg-primary text-primary-foreground shadow-md",
            "hover:scale-110 active:scale-95",
            added && "bg-emerald-500",
          )}
        >
          {added ? (
            <span className="text-[10px] font-bold px-0.5">✓</span>
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium truncate leading-tight">{song.name}</p>
        <p className="text-[11px] text-muted-foreground truncate leading-tight">
          {song.artist_map?.primary_artists?.[0]?.name || song.artist_map?.artists?.[0]?.name || "Unknown"}
        </p>
      </div>
    </div>
  )
})

const Recommendations = memo(({ recommendations, isLoading, sourceName, onAddToQueue, onAddAll }) => {
  const [collapsed, setCollapsed] = useState(false)

  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  if (!isLoading && (!recommendations || recommendations.length === 0)) return null

  return (
    <div className="mt-4 pb-2">
      <div className="flex items-center justify-between mb-2.5">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Recommended</span>
          {sourceName && (
            <span className="normal-case tracking-normal text-muted-foreground/50 max-w-[100px] sm:max-w-[140px] truncate">
              — {sourceName}
            </span>
          )}
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>

        {!collapsed && recommendations?.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddAll}
            className="h-7 text-xs gap-1 text-primary hover:text-primary cursor-pointer"
          >
            <ListPlus className="h-3.5 w-3.5" />
            Add All
          </Button>
        )}
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Finding similar songs...</span>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div className="flex gap-2.5 pb-3">
                  {recommendations.map((song) => (
                    <RecCard key={song.id} song={song} onAdd={onAddToQueue} />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export default Recommendations

