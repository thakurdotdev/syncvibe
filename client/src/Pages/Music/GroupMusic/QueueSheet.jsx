import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useGroupMusic } from "@/Context/GroupMusicContext"
import { useGroupSessionStore } from "@/stores/groupMusic/sessionStore"
import { fetchSongRecommendations } from "@/api/music/songs"
import { ListMusic, Search, SkipForward, X } from "lucide-react"
import { memo, useCallback, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import SearchResults from "./QueueSheet/SearchResults"
import QueueList from "./QueueSheet/QueueList"
import Recommendations from "./QueueSheet/Recommendations"

const QueueSheet = () => {
  const {
    isQueueOpen,
    setIsQueueOpen,
    queue,
    currentQueueIndex,
    currentQueueItem,
    upcomingQueue,
    removeFromQueue,
    reorderQueue,
    skipSong,
    currentGroup,
    searchResults,
    searchQuery,
    setSearchQuery,
    isSearchLoading,
    debouncedSearch,
    playNow,
    addToQueue,
  } = useGroupMusic()
  const { user } = useGroupMusic()

  const inputRef = useRef(null)
  const [recommendations, setRecommendations] = useState([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsSourceName, setRecsSourceName] = useState("")

  const isSearching = searchQuery.length > 0

  const handleSearchChange = useCallback(
    (e) => {
      const val = e.target.value
      setSearchQuery(val)
      if (val.trim()) {
        useGroupSessionStore.setState({ searchResults: [], isSearchLoading: true })
      } else {
        useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
      }
      debouncedSearch(val)
    },
    [setSearchQuery, debouncedSearch],
  )

  const handleClearSearch = useCallback(() => {
    setSearchQuery("")
    useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
    inputRef.current?.focus()
  }, [setSearchQuery])

  const handleClose = useCallback((open) => {
    if (!open) {
      setSearchQuery("")
      useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
      setIsQueueOpen(false)
    }
  }, [setSearchQuery, setIsQueueOpen])

  const fetchRecs = useCallback(async (songId) => {
    if (!songId) return
    setRecsLoading(true)
    setRecommendations([])
    const song = queue.find((q) => q.song?.id === songId)
    setRecsSourceName(song?.song?.name || "")
    try {
      const data = await fetchSongRecommendations(songId)
      const existingIds = new Set(queue.map((q) => q.song?.id))
      const filtered = (data || []).filter((s) => !existingIds.has(s.id))
      setRecommendations(filtered.slice(0, 15))
    } catch {
      toast.error("Failed to fetch recommendations")
    } finally {
      setRecsLoading(false)
    }
  }, [queue])

  const handleAddToQueueWithRecs = useCallback(
    (song) => {
      addToQueue(song)
      fetchRecs(song.id)
    },
    [addToQueue, fetchRecs],
  )

  const handleAddRecToQueue = useCallback(
    (song) => {
      addToQueue(song)
    },
    [addToQueue],
  )

  const handleAddAllRecs = useCallback(() => {
    if (!recommendations.length) return
    const maxQueueSize = currentGroup?.settings?.maxQueueSize || 3
    const availableSlots = Math.max(0, maxQueueSize - queue.length)

    if (availableSlots === 0) {
      addToQueue(recommendations[0])
      return
    }

    const toAdd = recommendations.slice(0, availableSlots)
    toAdd.forEach((song) => addToQueue(song))

    if (toAdd.length < recommendations.length) {
      toast.success(`Added ${toAdd.length} of ${recommendations.length} songs (queue limit reached)`)
    } else {
      toast.success(`Added ${toAdd.length} songs to queue`)
    }
    setRecommendations((prev) => prev.filter((s) => !toAdd.find((a) => a.id === s.id)))
  }, [recommendations, addToQueue, queue.length, currentGroup?.settings?.maxQueueSize])

  return (
    <Sheet open={isQueueOpen} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ListMusic className="h-4 w-4 text-primary" />
              </div>
              <SheetTitle className="text-lg">Queue</SheetTitle>
              {queue.length > 0 && (
                <Badge variant="secondary" className="text-xs">{queue.length}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentQueueItem && upcomingQueue.length > 0 && (
                <Button variant="outline" size="sm" onClick={skipSong} className="gap-1.5 cursor-pointer">
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleClose(false)}
                className="h-8 w-8 rounded-full cursor-pointer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="sr-only">View queue and search for songs</SheetDescription>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search songs to add..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 pr-9 h-10 rounded-full bg-accent/30 border-border/50 text-sm"
            />
            {isSearching && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearSearch}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {isSearching ? (
              <SearchResults
                searchQuery={searchQuery}
                searchResults={searchResults}
                isSearchLoading={isSearchLoading}
                onPlayNow={playNow}
                onAddToQueue={handleAddToQueueWithRecs}
              />
            ) : (
              <QueueList
                queue={queue}
                currentQueueIndex={currentQueueIndex}
                currentQueueItem={currentQueueItem}
                upcomingQueue={upcomingQueue}
                removeFromQueue={removeFromQueue}
                reorderQueue={reorderQueue}
                onFetchRecs={fetchRecs}
                user={user}
                currentGroup={currentGroup}
              >
                <Recommendations
                  recommendations={recommendations}
                  isLoading={recsLoading}
                  sourceName={recsSourceName}
                  onAddToQueue={handleAddRecToQueue}
                  onAddAll={handleAddAllRecs}
                />
              </QueueList>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default memo(QueueSheet)
