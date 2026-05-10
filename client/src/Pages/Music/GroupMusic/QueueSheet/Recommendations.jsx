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
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex-none w-[130px] sm:w-[140px] rounded-xl overflow-hidden group/card",
        "bg-accent/30 border border-border/30 hover:border-primary/30",
        "hover:shadow-lg hover:shadow-primary/5 transition-all duration-300",
        added && "opacity-40 pointer-events-none",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        <img
          src={song.image?.[1]?.link || song.image?.[2]?.link}
          alt={song.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
        <button
          onClick={handleAdd}
          className={cn(
            "absolute bottom-2 right-2 p-1.5 rounded-full transition-all duration-200 cursor-pointer",
            "shadow-lg backdrop-blur-sm",
            added
              ? "bg-emerald-500 text-white scale-100"
              : "bg-primary text-primary-foreground hover:scale-110 active:scale-95",
          )}
        >
          {added ? (
            <span className="text-[10px] font-bold px-0.5">✓</span>
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-medium truncate leading-tight">{song.name}</p>
        <p className="text-[11px] text-muted-foreground/70 truncate leading-tight mt-0.5">
          {song.artist_map?.primary_artists?.[0]?.name || song.artist_map?.artists?.[0]?.name || "Unknown"}
        </p>
      </div>
    </motion.div>
  )
})

const Recommendations = memo(({ recommendations, isLoading, sourceName, onAddToQueue, onAddAll }) => {
  const [collapsed, setCollapsed] = useState(false)

  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  if (!isLoading && (!recommendations || recommendations.length === 0)) return null

  return (
    <div className="mt-5 pb-2">
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={toggle}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors cursor-pointer"
        >
          <div className="p-1 rounded-md bg-primary/10">
            <Sparkles className="h-3 w-3 text-primary" />
          </div>
          <span className="text-muted-foreground">Recommended</span>
          {sourceName && (
            <span className="normal-case tracking-normal text-muted-foreground/40 max-w-[100px] sm:max-w-[140px] truncate text-[11px] font-normal">
              — {sourceName}
            </span>
          )}
          {collapsed ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
        </button>

        {!collapsed && recommendations?.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddAll}
            className="h-7 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
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
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-10 gap-2.5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <Loader2 className="h-5 w-5 animate-spin text-primary relative" />
                </div>
                <span className="text-sm text-muted-foreground font-medium">Finding similar songs...</span>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <div className="flex gap-2.5 pb-3 px-1">
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
