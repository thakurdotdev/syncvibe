import { AnimatePresence, motion } from "framer-motion"
import he from "he"
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  History as HistoryIcon,
  Music2,
  Play,
  RotateCcw,
  Search,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useHistoryQuery } from "@/hooks/queries/useHistoryQuery"
import { SongCard } from "./Cards"
import { usePlayerStore } from "@/stores/playerStore"

const SORT_OPTIONS = [
  { value: "lastPlayedAt", label: "Recently Played" },
  { value: "playedCount", label: "Most Played" },
  { value: "songName", label: "Name" },
]

const SORT_ORDER_OPTIONS = [
  { value: "DESC", label: "Newest First" },
  { value: "ASC", label: "Oldest First" },
]

const PAGE_SIZE_OPTIONS = [12, 28, 52]

const HistorySkeleton = ({ pageSize = 28 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
    {Array.from({ length: pageSize }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: i * 0.03 }}
        className="rounded-xl border border-border/50 bg-card p-3"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md shrink-0" />
        </div>
      </motion.div>
    ))}
  </div>
)

const EmptyState = ({ hasSearch }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center min-h-[45vh] px-6"
  >
    <div className="p-6 rounded-2xl bg-muted/50 border border-border/50">
      <HistoryIcon className="w-12 h-12 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold mt-6">
      {hasSearch ? "No songs found" : "No listening history"}
    </h3>
    <p className="text-muted-foreground text-center mt-2 max-w-xs text-sm">
      {hasSearch ? "Try adjusting your search or filters" : "Songs you listen to will appear here"}
    </p>
  </motion.div>
)

const ErrorState = ({ error, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center min-h-[45vh] px-6"
  >
    <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20">
      <Music2 className="w-12 h-12 text-destructive" />
    </div>
    <h3 className="text-lg font-semibold mt-6">Failed to load</h3>
    <p className="text-muted-foreground text-center mt-2 max-w-xs text-sm">{error}</p>
    <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 gap-2">
      <RotateCcw className="w-4 h-4" />
      Retry
    </Button>
  </motion.div>
)

const Pagination = ({ currentPage, totalPages, onPageChange, disabled }) => {
  const pages = useMemo(() => {
    const result = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) result.push(i)
    return result
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center gap-1 mt-8"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="h-9 w-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages[0] > 1 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={disabled}
            className="h-9 min-w-9 text-sm"
          >
            1
          </Button>
          {pages[0] > 2 && <span className="text-muted-foreground px-1">···</span>}
        </>
      )}

      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "ghost"}
          size="sm"
          onClick={() => onPageChange(page)}
          disabled={disabled}
          className="h-9 min-w-9 text-sm"
        >
          {page}
        </Button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="text-muted-foreground px-1">···</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled}
            className="h-9 min-w-9 text-sm"
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="h-9 w-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </motion.div>
  )
}

export const ResumeSession = () => {
  const currentSong = usePlayerStore((s) => s.currentSong)
  const isClosed = usePlayerStore((s) => s.isClosed)
  const playSong = usePlayerStore((s) => s.playSong)
  const stopSong = usePlayerStore((s) => s.stopSong)
  const currentTime = usePlayerStore((s) => s.currentTime) || 0
  const duration = usePlayerStore((s) => s.duration) || parseFloat(currentSong?.duration) || 0

  if (!isClosed || !currentSong) return null

  const songImage = currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  const formatTime = (time) => {
    if (isNaN(time) || time <= 0) return "0:00"
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => playSong(currentSong)}
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-4 sm:p-5 pb-5 sm:pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 w-full group/resume transition-all duration-300 backdrop-blur-md cursor-pointer"
    >
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <img
          src={songImage}
          alt=""
          className="w-full h-full object-cover blur-3xl opacity-[0.08] scale-150 transition-all duration-700 group-hover/resume:opacity-[0.12]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background/50" />
      </div>

      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden shadow-2xl border border-white/10 group-hover/resume:scale-[1.02] transition-transform duration-300">
          <img
            src={songImage}
            alt={currentSong.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/resume:opacity-100 transition-opacity duration-300 cursor-pointer" onClick={(e) => { e.stopPropagation(); playSong(currentSong); }}>
            <Play fill="white" className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="min-w-0 pr-4">
          <h3 className="text-sm sm:text-base font-bold text-foreground truncate max-w-[200px] sm:max-w-[400px]">
            {he.decode(currentSong.name || currentSong.title || "")}
          </h3>
          <p className="text-xs text-muted-foreground truncate font-medium mt-0.5 flex flex-wrap items-center gap-2">
            <span>
              {currentSong.artist_map?.artists?.map((a) => a.name).join(", ") || currentSong.primaryArtists || currentSong.artist || "Unknown Artist"}
            </span>
            {currentTime > 0 && (
              <>
                <span className="text-muted-foreground/30">•</span>
                <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                  Paused at {formatTime(currentTime)}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="shrink-0 w-full sm:w-auto flex items-center gap-2">
        <Button
          onClick={(e) => {
            e.stopPropagation()
            playSong(currentSong)
          }}
          className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 h-10 rounded-full shadow-lg shadow-primary/15 cursor-pointer active:scale-95 transition-all duration-200"
        >
          <Play fill="currentColor" className="w-3.5 h-3.5" />
          Resume
        </Button>
      </div>

      {progressPercent > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </motion.div>
  )
}

const HistoryPage = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState("lastPlayedAt")
  const [sortOrder, setSortOrder] = useState("DESC")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(28)
  const [showFilters, setShowFilters] = useState(false)
  const isSearchActive = debouncedSearch && debouncedSearch.length >= 3

  useEffect(() => {
    const q = (searchQuery ?? "").trim()

    const timer = setTimeout(() => {
      if (q.length >= 3) {
        setDebouncedSearch(q)
      } else {
        setDebouncedSearch("")
      }
      setCurrentPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data, isLoading, isError, error, refetch } = useHistoryQuery({
    page: currentPage,
    limit: pageSize,
    sortBy,
    sortOrder,
    searchQuery: isSearchActive ? debouncedSearch : "",
  })

  const songs = data?.songs ?? []
  const totalCount = data?.count ?? 0
  const totalPages = data?.totalPages ?? 1

  const handleClearSearch = () => {
    setSearchQuery("")
    setDebouncedSearch("")
  }

  const handleResetFilters = () => {
    setSortBy("lastPlayedAt")
    setSortOrder("DESC")
    setPageSize(28)
    setCurrentPage(1)
  }

  const hasActiveFilters = sortBy !== "lastPlayedAt" || sortOrder !== "DESC" || pageSize !== 28

  return (
    <div className="min-h-screen pb-32">
      <div className="border-b border-border/50 bg-card/30">
        <div className="px-4 md:px-6 py-6 space-y-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <HistoryIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                    Listening History
                  </h1>
                  {!isLoading && (
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-sm text-muted-foreground">
                        {totalCount.toLocaleString()} songs
                      </span>
                      {totalPages > 1 && (
                        <>
                          <span className="text-muted-foreground/50">•</span>
                          <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant={showFilters ? "secondary" : "outline-solid"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </Button>
            </div>

            <ResumeSession />

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search songs, artists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 bg-background"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={handleClearSearch}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SORT_ORDER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(v) => setPageSize(Number(v))}
                      >
                        <SelectTrigger className="h-9 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size} songs
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetFilters}
                        disabled={!hasActiveFilters}
                        className="w-full h-9 gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6 space-y-6">
        {isLoading ? (
          <HistorySkeleton pageSize={pageSize} />
        ) : isError ? (
          <ErrorState error={error?.message || "Failed to load history"} onRetry={refetch} />
        ) : songs.length === 0 ? (
          <EmptyState hasSearch={!!debouncedSearch} />
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3"
            >
              {songs.map((song, index) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.2 }}
                >
                  <SongCard song={song} />
                </motion.div>
              ))}
            </motion.div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              disabled={isLoading}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
