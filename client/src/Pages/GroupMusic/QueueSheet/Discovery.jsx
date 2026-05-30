import { cn } from "@/lib/utils"
import { Sparkles, RefreshCw } from "lucide-react"
import { memo } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import EmptyQueueQuickStart from "./EmptyQueueQuickStart"
import EmptyQueueRecommendations from "./EmptyQueueRecommendations"

const Discovery = memo(
  ({
    userId,
    recommendations,
    recsLoading,
    recsSourceName,
    onAddToQueue,
    playNow,
    playNext,
    onSaveToPlaylist,
    onRefresh,
    queue,
  }) => {
    return (
      <motion.div
        key="discovery"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="px-4 py-5 space-y-6"
      >
        {/* Section 1: Quick Start / Resume last session (shows horizontal cards) */}
        <EmptyQueueQuickStart
          userId={userId}
          onAddToQueue={onAddToQueue}
          playNow={playNow}
        />

        {/* Section 2: Recommendations / Trending list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <h3 className="text-xs font-semibold text-muted-foreground/75 uppercase tracking-wider">
                {recsSourceName ? `Suggestions: ${recsSourceName}` : "Recommended for You"}
              </h3>
            </div>
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={recsLoading}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer disabled:opacity-50"
                title="Refresh recommendations"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", recsLoading && "animate-spin")} />
              </Button>
            )}
          </div>

          <EmptyQueueRecommendations
            recommendations={recommendations}
            isLoading={recsLoading}
            sourceName={null} // Title is handled by Discovery header
            onAddToQueue={onAddToQueue}
            playNow={playNow}
            playNext={playNext}
            onSaveToPlaylist={onSaveToPlaylist}
            hideHeader={true}
          />
        </div>
      </motion.div>
    )
  },
)

export default Discovery
