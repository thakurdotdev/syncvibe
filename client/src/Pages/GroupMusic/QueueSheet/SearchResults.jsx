import { Loader2, Music, Search } from "lucide-react"
import { memo } from "react"
import { motion } from "framer-motion"
import SongItem from "./SongItem"

const SongSkeleton = memo(() => (
  <div className="flex items-center gap-3 px-2.5 py-2">
    <div className="skeleton-block h-11 w-11 shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="skeleton-line h-3.5 w-3/4" />
      <div className="skeleton-line h-2.5 w-1/2" />
    </div>
    <div className="skeleton-line h-3 w-8 shrink-0" />
  </div>
))

const SearchResults = memo(
  ({
    searchQuery,
    searchResults,
    isSearchLoading,
    onPlayNow,
    onAddToQueue,
    onPlayNext,
    onSaveToPlaylist,
  }) => {
    const hasResults = searchResults?.length > 0

    return (
      <motion.div
        key="search"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="px-2 py-3"
      >
        {isSearchLoading ? (
          <div className="space-y-1">
            {[0, 1, 2, 3].map((i) => (
              <SongSkeleton key={i} />
            ))}
          </div>
        ) : !searchQuery ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <div className="p-4 rounded-2xl liquid-badge">
              <Search className="h-8 w-8 text-muted-foreground/25" />
            </div>
            <p className="text-muted-foreground/60 text-sm">Start typing to search</p>
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <div className="p-4 rounded-2xl liquid-badge">
              <Music className="h-8 w-8 text-muted-foreground/25" />
            </div>
            <div className="text-center">
              <p className="text-muted-foreground/70 text-sm font-medium">No songs found</p>
              <p className="text-muted-foreground/50 text-xs mt-1">Try a different search term</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider px-2 mb-2">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-0.5">
              {searchResults.map((song, i) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i < 5 ? i * 0.03 : 0 }}
                >
                  <SongItem
                    song={song}
                    onPlayNow={onPlayNow}
                    onAddToQueue={onAddToQueue}
                    onPlayNext={onPlayNext}
                    onSaveToPlaylist={onSaveToPlaylist}
                  />
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    )
  },
)

export default SearchResults
