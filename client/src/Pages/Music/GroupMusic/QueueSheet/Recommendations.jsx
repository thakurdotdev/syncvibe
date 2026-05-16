import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ListPlus, Loader2, Music, Sparkles } from "lucide-react"
import { memo } from "react"
import { motion } from "framer-motion"
import SongItem from "./SongItem"

const Recommendations = memo(
  ({
    recommendations,
    isLoading,
    sourceName,
    onPlayNow,
    onPlayNext,
    onAddToQueue,
    onAddAll,
    onSaveToPlaylist,
  }) => {
    const hasRecommendations = recommendations?.length > 0

    return (
      <motion.div
        key="recommendations"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="px-2 py-3"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-6">
            <div className="relative">
              {/* Magic sparkles surrounding the loader */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 90, 180, 270, 360],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-8 border border-dashed border-primary/20 rounded-full"
              />

              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                    x: Math.cos(i * 120 * Math.PI / 180) * 30,
                    y: Math.sin(i * 120 * Math.PI / 180) * 30,
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="h-3 w-3 text-primary shadow-lg shadow-primary/20" />
                </motion.div>
              ))}

              <div className="relative p-4 rounded-3xl bg-primary/5 border border-primary/10 shadow-inner">
                <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
                <motion.div
                  className="absolute inset-0 rounded-3xl bg-primary/10"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </div>

            <div className="text-center space-y-2 max-w-[240px]">
              <motion.p
                className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_auto]"
                animate={{ backgroundPosition: ["0% center", "200% center"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                Curating your next vibe...
              </motion.p>
              {sourceName && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-muted-foreground/60 font-medium px-4 py-1 rounded-full bg-accent/30 inline-block truncate max-w-full"
                >
                  Analyzing <span className="text-primary/70 italic">"{sourceName}"</span>
                </motion.p>
              )}
            </div>
          </div>
        ) : !hasRecommendations ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <div className="p-4 rounded-2xl bg-accent/40">
              <Music className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-sm font-medium">No recommendations yet</p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Play a song to get tailored recommendations
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 mb-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Recommended
                  </p>
                </div>
                {sourceName && (
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5 truncate max-w-[180px]">
                    Inspired by {sourceName}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddAll}
                className="h-8 px-3 text-xs gap-2 text-primary hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
              >
                <ListPlus className="h-4 w-4" />
                Add All
              </Button>
            </div>

            <div className="space-y-0.5">
              {recommendations.map((song) => (
                <SongItem
                  key={song.id}
                  song={song}
                  onPlayNow={onPlayNow}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                  onSaveToPlaylist={onSaveToPlaylist}
                />
              ))}
            </div>
          </>
        )}
      </motion.div>
    )
  },
)

export default Recommendations
