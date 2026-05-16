import { Loader2, Music, Search } from "lucide-react"
import { memo } from "react"
import { motion } from "framer-motion"
import SongItem from "./SongItem"

const SearchResults = memo(({ searchQuery, searchResults, isSearchLoading, onPlayNow, onAddToQueue, onPlayNext, onSaveToPlaylist }) => {
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
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Searching...</p>
        </div>
      ) : !searchQuery ? (
        <div className="flex flex-col items-center justify-center h-52 gap-3">
          <div className="p-4 rounded-2xl bg-accent/40">
            <Search className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground text-sm">Start typing to search</p>
        </div>
      ) : !hasResults ? (
        <div className="flex flex-col items-center justify-center h-52 gap-3">
          <div className="p-4 rounded-2xl bg-accent/40">
            <Music className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-sm font-medium">No songs found</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Try a different search term</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-2 mb-2">
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
})

export default SearchResults
