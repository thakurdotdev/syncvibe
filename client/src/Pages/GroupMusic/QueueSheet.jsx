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
import { cn } from "@/lib/utils"
import { Library, ListMusic, Search, SkipForward, Sparkles, X } from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import SearchResults from "./QueueSheet/SearchResults"
import QueueList from "./QueueSheet/QueueList"
import Recommendations from "./QueueSheet/Recommendations"
import PlaylistBrowser from "./QueueSheet/PlaylistBrowser"
import AddToPlaylist from "@/Pages/Music/AddToPlaylist"

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
    playNext,
    addToQueue,
    addPlaylistToQueue,
  } = useGroupMusic()

  const inputRef = useRef(null)
  const lastRecsSongIdRef = useRef(null)
  const [recommendations, setRecommendations] = useState([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsSourceName, setRecsSourceName] = useState("")
  const [activeTab, setActiveTab] = useState("search")
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveDialogSong, setSaveDialogSong] = useState(null)

  const isSearching = searchQuery.length > 0

  const handleSearchChange = useCallback(
    (e) => {
      const val = e.target.value
      setSearchQuery(val)
      if (val.trim()) {
        useGroupSessionStore.setState({ searchResults: [], isSearchLoading: true })
        setActiveTab("search")
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

  const handleClose = useCallback(
    (open) => {
      if (!open) {
        setSearchQuery("")
        useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
        setIsQueueOpen(false)
        setActiveTab("search")
      }
    },
    [setSearchQuery, setIsQueueOpen],
  )

  const handleSaveToPlaylist = useCallback((song) => {
    setSaveDialogSong(song)
    setSaveDialogOpen(true)
  }, [])

  const fetchRecs = useCallback(
    async (songId) => {
      if (!songId) return
      lastRecsSongIdRef.current = songId
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
    },
    [queue],
  )

  useEffect(() => {
    const currentSongId = currentQueueItem?.song?.id
    if (currentSongId && currentSongId !== lastRecsSongIdRef.current) {
      fetchRecs(currentSongId)
    }
  }, [currentQueueItem?.song?.id])

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
      toast.success(
        `Added ${toAdd.length} of ${recommendations.length} songs (queue limit reached)`,
      )
    } else {
      toast.success(`Added ${toAdd.length} songs to queue`)
    }
    setRecommendations((prev) => prev.filter((s) => !toAdd.find((a) => a.id === s.id)))
  }, [recommendations, addToQueue, queue.length, currentGroup?.settings?.maxQueueSize])

  const handlePlaylistAddAll = useCallback(
    (songs) => {
      addPlaylistToQueue(songs)
    },
    [addPlaylistToQueue],
  )

  const showTabs = isSearching || activeTab === "playlists"

  return (
    <>
      <Sheet open={isQueueOpen} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col border-l border-border/30 liquid-sheet">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl liquid-badge">
                  <ListMusic className="h-4 w-4 text-primary" />
                </div>
                <SheetTitle className="text-lg font-bold tracking-tight">Queue</SheetTitle>
                {queue.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 h-5 font-mono liquid-badge rounded-full flex items-center justify-center text-muted-foreground">
                    {queue.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {currentQueueItem && upcomingQueue.length > 0 && (
                  <button
                    onClick={skipSong}
                    className="liquid-btn h-8 rounded-xl gap-1.5 cursor-pointer flex items-center px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip
                  </button>
                )}
                <button
                  onClick={() => handleClose(false)}
                  className="liquid-btn h-8 w-8 rounded-full cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <SheetDescription className="sr-only">View queue and search for songs</SheetDescription>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <input
                ref={inputRef}
                placeholder="Search songs to add..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-9 h-10 rounded-xl liquid-input text-sm placeholder:text-muted-foreground/40 outline-none text-foreground"
              />
              {isSearching && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1">
              {[
                { id: "search", icon: Search, label: "Search" },
                { id: "playlists", icon: Library, label: "My Playlists" },
                { id: "recommendations", icon: Sparkles, label: "Recommendations" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    if (tab.id !== "search") {
                      setSearchQuery("")
                      useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer relative",
                    activeTab === tab.id
                      ? "liquid-tab-active text-foreground"
                      : "liquid-tab text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon
                    className={cn(
                      "h-3 w-3",
                      tab.id === "recommendations" && recsLoading && "animate-pulse",
                    )}
                  />
                  {tab.label}
                  {tab.id === "recommendations" &&
                    recommendations.length > 0 &&
                    activeTab !== "recommendations" && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                    )}
                </button>
              ))}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="wait">
              {activeTab === "playlists" && !isSearching ? (
                <PlaylistBrowser
                  onPlayNow={playNow}
                  onPlayNext={playNext}
                  onAddToQueue={handleAddToQueueWithRecs}
                  onAddAll={handlePlaylistAddAll}
                />
              ) : activeTab === "recommendations" && !isSearching ? (
                <Recommendations
                  recommendations={recommendations}
                  isLoading={recsLoading}
                  sourceName={recsSourceName}
                  onPlayNow={playNow}
                  onPlayNext={playNext}
                  onAddToQueue={handleAddRecToQueue}
                  onAddAll={handleAddAllRecs}
                  onSaveToPlaylist={handleSaveToPlaylist}
                />
              ) : isSearching ? (
                <SearchResults
                  searchQuery={searchQuery}
                  searchResults={searchResults}
                  isSearchLoading={isSearchLoading}
                  onPlayNow={playNow}
                  onAddToQueue={handleAddToQueueWithRecs}
                  onPlayNext={playNext}
                  onSaveToPlaylist={handleSaveToPlaylist}
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
                  onSaveToPlaylist={handleSaveToPlaylist}
                  user={null}
                  currentGroup={currentGroup}
                />
              )}
            </AnimatePresence>
          </div>
        </SheetContent>
      </Sheet>

      <AddToPlaylist
        dialogOpen={saveDialogOpen}
        setDialogOpen={setSaveDialogOpen}
        song={saveDialogSong}
      />
    </>
  )
}

export default memo(QueueSheet)
