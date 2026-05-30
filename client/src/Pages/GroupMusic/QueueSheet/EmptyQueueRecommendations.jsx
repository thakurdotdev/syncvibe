import { Sparkles } from "lucide-react"
import { memo } from "react"
import SongItem from "./SongItem"

const SongSkeletonCompact = memo(() => (
  <div className="flex items-center gap-3 p-1.5">
    <div className="skeleton-block h-9 w-9 shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="skeleton-line h-3 w-3/5" />
      <div className="skeleton-line h-2.5 w-2/5" />
    </div>
  </div>
))

const EmptyQueueRecommendations = memo(
  ({
    recommendations,
    isLoading,
    sourceName,
    onAddToQueue,
    playNow,
    playNext,
    onSaveToPlaylist,
    hideHeader = false,
  }) => {
    const hasRecommendations = recommendations?.length > 0

    return (
      <div className="space-y-3">
        {!hideHeader && (
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <h3 className="text-xs font-semibold text-muted-foreground/75 uppercase tracking-wider">
              {sourceName ? `Recommended: ${sourceName}` : "Recommended for You"}
            </h3>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-0.5">
            {[0, 1, 2].map((i) => (
              <SongSkeletonCompact key={i} />
            ))}
          </div>
        ) : !hasRecommendations ? (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground/40 font-medium">
              No recommendations available
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {recommendations.slice(0, 5).map((song) => (
              <SongItem
                key={song.id}
                song={song}
                onPlayNow={playNow}
                onAddToQueue={onAddToQueue}
                onPlayNext={playNext}
                onSaveToPlaylist={onSaveToPlaylist}
                compact={true}
              />
            ))}
          </div>
        )}
      </div>
    )
  },
)

export default EmptyQueueRecommendations
