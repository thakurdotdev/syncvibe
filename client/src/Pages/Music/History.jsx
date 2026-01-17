import axios from "axios"
import {
  ChevronLeft,
  ChevronRight,
  History as HistoryIcon,
  Loader2,
  Music2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { SongCard } from "./Cards"

const SORT_OPTIONS = [
  { value: "lastPlayedAt", label: "Recently Played" },
  { value: "playedCount", label: "Most Played" },
  { value: "songName", label: "Name" },
]

const SORT_ORDER_OPTIONS = [
  { value: "DESC", label: "Descending" },
  { value: "ASC", label: "Ascending" },
]

const PAGE_SIZE_OPTIONS = [9, 21, 51]

const HistorySkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
    {Array.from({ length: 18 }).map((_, i) => (
      <Card key={i} className="p-0">
        <div className="p-1">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-3 w-[60%]" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
          </div>
        </div>
      </Card>
    ))}
  </div>
)

const EmptyState = ({ hasSearch }) => (
  <Card className="flex flex-col items-center justify-center min-h-[40vh] p-8 bg-background/50 backdrop-blur-sm">
    <HistoryIcon className="w-16 h-16 text-muted-foreground mb-4" />
    <p className="text-lg text-muted-foreground text-center font-medium mb-2">
      {hasSearch ? "No songs found" : "No listening history yet"}
    </p>
    <p className="text-sm text-muted-foreground text-center">
      {hasSearch
        ? "Try adjusting your search or filters"
        : "Start listening to music and your history will appear here"}
    </p>
  </Card>
)

const ErrorState = ({ error, onRetry }) => (
  <Card className="flex flex-col items-center justify-center min-h-[40vh] p-8 bg-background/50 backdrop-blur-sm">
    <Music2 className="w-16 h-16 text-muted-foreground mb-4" />
    <p className="text-lg text-destructive text-center font-medium mb-2">{error}</p>
    <p className="text-sm text-muted-foreground mb-6">Please check your connection and try again</p>
    <Button onClick={onRetry} variant="default" className="gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Try Again
    </Button>
  </Card>
)

const Pagination = ({ currentPage, totalPages, onPageChange, disabled }) => {
  const pages = useMemo(() => {
    const result = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)

    for (let i = start; i <= end; i++) {
      result.push(i)
    }
    return result
  }, [currentPage, totalPages])

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages[0] > 1 && (
        <>
          <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={disabled}>
            1
          </Button>
          {pages[0] > 2 && <span className="text-muted-foreground px-2">...</span>}
        </>
      )}
      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(page)}
          disabled={disabled}
        >
          {page}
        </Button>
      ))}
      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && (
            <span className="text-muted-foreground px-2">...</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled}
          >
            {totalPages}
          </Button>
        </>
      )}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

const HistoryPage = () => {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sortBy, setSortBy] = useState("createdat")
  const [sortOrder, setSortOrder] = useState("DESC")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(21)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder,
      })

      if (debouncedSearch.trim()) {
        params.append("searchQuery", debouncedSearch.trim())
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/music/latestHistory?${params}`,
        { withCredentials: true },
      )

      if (response.data?.status === "success") {
        const {
          songs: fetchedSongs,
          count,
          currentPage: page,
          totalPages: pages,
        } = response.data.data
        setSongs(fetchedSongs || [])
        setTotalCount(count || 0)
        setCurrentPage(page || 1)
        setTotalPages(pages || 1)
      }
    } catch (err) {
      console.error("Error fetching history:", err)
      setError("Failed to load history. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, sortBy, sortOrder, debouncedSearch])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleClearSearch = () => {
    setSearchQuery("")
    setDebouncedSearch("")
  }

  const handleResetFilters = () => {
    setSortBy("lastPlayedAt")
    setSortOrder("DESC")
    setPageSize(20)
    setCurrentPage(1)
  }

  const hasActiveFilters = sortBy !== "lastPlayedAt" || sortOrder !== "DESC" || pageSize !== 20

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 pb-32 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HistoryIcon className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Listening History</h1>
              {!loading && (
                <p className="text-sm text-muted-foreground">
                  {totalCount} {totalCount === 1 ? "song" : "songs"} in history
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-accent")}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search your history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Order</label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Per Page</label>
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger>
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

              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" onClick={handleResetFilters} className="w-full">
                    Reset Filters
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchHistory} />
      ) : songs.length === 0 ? (
        <EmptyState hasSearch={!!debouncedSearch} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
          />
        </>
      )}
    </div>
  )
}

export default HistoryPage
