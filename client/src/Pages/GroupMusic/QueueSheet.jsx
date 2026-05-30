import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useGroupMusic } from "@/Context/GroupMusicContext"
import { useGroupSessionStore } from "@/stores/groupMusic/sessionStore"
import { useProfile } from "@/Context/Context"
import { fetchSongRecommendations } from "@/api/music/songs"
import { fetchGroupHistory, fetchHistory } from "@/api/music/history"
import { fetchHomepageModules } from "@/api/music/homepage"
import { cn } from "@/lib/utils"
import { Library, ListMusic, Search, SkipForward, Sparkles, X, Loader2 } from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import SearchResults from "./QueueSheet/SearchResults"
import QueueList from "./QueueSheet/QueueList"
import PlaylistBrowser from "./QueueSheet/PlaylistBrowser"
import Discovery from "./QueueSheet/Discovery"
import AddToPlaylist from "@/Pages/Music/AddToPlaylist"

const QueueSheet = () => {
  const { user } = useProfile()
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
  const queueRef = useRef(queue)
  const [recommendations, setRecommendations] = useState([])
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsSourceName, setRecsSourceName] = useState("")
  const [activeTab, setActiveTab] = useState("queue")
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveDialogSong, setSaveDialogSong] = useState(null)
  const [recsLockedSongId, setRecsLockedSongId] = useState(null)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  const isSearching = searchQuery.length > 0

  const handleSearchChange = useCallback(
    (e) => {
      const val = e.target.value
      setSearchQuery(val)
      if (val.trim()) {
        useGroupSessionStore.setState({ searchResults: [], isSearchLoading: true })
        setActiveTab("queue")
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
        setActiveTab("queue")
      }
    },
    [setSearchQuery, setIsQueueOpen],
  )

  const handleSaveToPlaylist = useCallback((song) => {
    setSaveDialogSong(song)
    setSaveDialogOpen(true)
  }, [])

  const fetchRecs = useCallback(
    async (songId, force = false) => {
      if (!songId) return
      if (!force && lastRecsSongIdRef.current === songId) return
      lastRecsSongIdRef.current = songId
      setRecsLoading(true)
      const currentQueue = queueRef.current || []
      const song = currentQueue.find((q) => q.song?.id === songId)
      setRecsSourceName(song?.song?.name || "")
      try {
        const data = await fetchSongRecommendations(songId)
        const existingIds = new Set(currentQueue.map((q) => q.song?.id))
        const filtered = (data || []).filter((s) => !existingIds.has(s.id))
        setRecommendations(filtered.slice(0, 15))
      } catch {
        toast.error("Failed to fetch recommendations")
      } finally {
        setRecsLoading(false)
      }
    },
    [],
  )

  const fetchSmartFallbackRecs = useCallback(
    async (force = false) => {
      if (!force && lastRecsSongIdRef.current === "fallback") return
      lastRecsSongIdRef.current = "fallback"
      setRecsLoading(true)
      
      try {
        if (user?.userid) {
          const groupHist = await fetchGroupHistory(user.userid)
          if (groupHist && groupHist.length > 0) {
            const lastSong = groupHist[groupHist.length - 1]?.songData
            if (lastSong?.id) {
              setRecsSourceName(`Last Session: ${lastSong.name}`)
              const data = await fetchSongRecommendations(lastSong.id)
              if (data && data.length > 0) {
                const currentQueue = queueRef.current || []
                const existingIds = new Set(currentQueue.map((q) => q.song?.id))
                const filtered = data.filter((s) => !existingIds.has(s.id))
                setRecommendations(filtered.slice(0, 15))
                return
              }
            }
          }
        }

        const musicHist = await fetchHistory({ limit: 5 })
        if (musicHist && musicHist.length > 0) {
          const lastSong = musicHist[0]?.songData || musicHist[0]
          if (lastSong?.id) {
            setRecsSourceName(`Music History: ${lastSong.name}`)
            const data = await fetchSongRecommendations(lastSong.id)
            if (data && data.length > 0) {
              const currentQueue = queueRef.current || []
              const existingIds = new Set(currentQueue.map((q) => q.song?.id))
              const filtered = data.filter((s) => !existingIds.has(s.id))
              setRecommendations(filtered.slice(0, 15))
              return
            }
          }
        }

        const modules = await fetchHomepageModules()
        if (modules?.trending && modules.trending.length > 0) {
          setRecsSourceName("Trending Now")
          const currentQueue = queueRef.current || []
          const existingIds = new Set(currentQueue.map((q) => q.song?.id))
          const filtered = modules.trending.filter((s) => !existingIds.has(s.id))
          setRecommendations(filtered.slice(0, 15))
        }
      } catch (err) {
        console.error("Failed to load fallback recommendations:", err)
      } finally {
        setRecsLoading(false)
      }
    },
    [user?.userid],
  )

  const handleManualFetchRecs = useCallback(
    (songId) => {
      if (!songId) return
      setRecsLockedSongId(songId)
      setActiveTab("discovery")
      fetchRecs(songId, true)
    },
    [fetchRecs],
  )

  useEffect(() => {
    if (queue.length === 0 && recsLockedSongId) {
      setRecsLockedSongId(null)
    }
  }, [queue.length, recsLockedSongId])

  useEffect(() => {
    if (recsLockedSongId) return

    const currentSongId = currentQueueItem?.song?.id
    if (currentSongId) {
      if (currentSongId !== lastRecsSongIdRef.current) {
        fetchRecs(currentSongId)
      }
    } else {
      fetchSmartFallbackRecs()
    }
  }, [currentQueueItem?.song?.id, recsLockedSongId, fetchRecs, fetchSmartFallbackRecs])

  const handleAddToQueueWithRecs = useCallback(
    (song) => {
      addToQueue(song)
      setRecommendations((prev) => prev.filter((s) => s.id !== song.id))
    },
    [addToQueue],
  )

  const handleAddRecToQueue = useCallback(
    (song) => {
      addToQueue(song)
      setRecommendations((prev) => prev.filter((s) => s.id !== song.id))
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

            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val)
                if (val !== "queue") {
                  setSearchQuery("")
                  useGroupSessionStore.setState({ searchResults: [], isSearchLoading: false })
                }
              }}
              className="w-full mt-1.5"
            >
              <TabsList className="grid w-full grid-cols-3 h-9 bg-accent/40 rounded-xl p-1">
                <TabsTrigger
                  value="queue"
                  className="flex items-center justify-center gap-1 px-1 py-1 text-[11px] font-medium rounded-lg transition-all cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  <ListMusic className="h-3.5 w-3.5" />
                  Queue
                </TabsTrigger>
                <TabsTrigger
                  value="playlists"
                  className="flex items-center justify-center gap-1 px-1 py-1 text-[11px] font-medium rounded-lg transition-all cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  <Library className="h-3.5 w-3.5" />
                  Playlists
                </TabsTrigger>
                <TabsTrigger
                  value="discovery"
                  className="flex items-center justify-center gap-1 px-1 py-1 text-[11px] font-medium rounded-lg transition-all cursor-pointer data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Recommended
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {activeTab === "playlists" && !isSearching ? (
                <PlaylistBrowser
                  onPlayNow={playNow}
                  onPlayNext={playNext}
                  onAddToQueue={handleAddToQueueWithRecs}
                  onAddAll={handlePlaylistAddAll}
                />
              ) : activeTab === "discovery" && !isSearching ? (
                <Discovery
                  userId={user?.userid}
                  recommendations={recommendations}
                  recsLoading={recsLoading}
                  recsSourceName={recsSourceName}
                  onAddToQueue={handleAddRecToQueue}
                  playNow={playNow}
                  playNext={playNext}
                  onSaveToPlaylist={handleSaveToPlaylist}
                  onRefresh={() => {
                    const currentSongId = currentQueueItem?.song?.id
                    if (currentSongId) {
                      fetchRecs(currentSongId, true)
                    } else {
                      fetchSmartFallbackRecs(true)
                    }
                  }}
                  queue={queue}
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
                  onFetchRecs={handleManualFetchRecs}
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
