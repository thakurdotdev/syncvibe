import { Loader2, Music, Search } from "lucide-react"
import { memo } from "react"
import { motion } from "framer-motion"
import SongItem from "./SongItem"

const SearchResults = memo(({ searchQuery, searchResults, isSearchLoading, onPlayNow, onAddToQueue }) => {
  const hasResults = searchResults?.length > 0

  return (
    <motion.div
      key="search"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="px-2 py-3"
    >
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
        Search Results {hasResults && `(${searchResults.length})`}
      </p>

      {isSearchLoading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Searching...</p>
        </div>
      ) : !searchQuery ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Search className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Start typing to search</p>
        </div>
      ) : !hasResults ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Music className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No songs found</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {searchResults.map((song) => (
            <SongItem
              key={song.id}
              song={song}
              onPlayNow={onPlayNow}
              onAddToQueue={onAddToQueue}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
})

export default SearchResults
