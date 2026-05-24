import { Loader2, Music, Search } from "lucide-react"
import { memo } from "react"
import { motion } from "framer-motion"
import SongItem from "./SongItem"

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
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.3], opacity: [0.2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full border border-border/30"
                style={{ margin: "-8px" }}
              />
              <div className="p-3 rounded-full liquid-badge">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            </div>
            <p className="text-muted-foreground/70 text-sm font-medium">Searching...</p>
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
              {searchResults.map((song) => (
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

export default SearchResults
