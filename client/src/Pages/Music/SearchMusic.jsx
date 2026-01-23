import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { SongCard } from "./Cards"
import { useBackendSearchQuery } from "@/hooks/queries/useSongQueries"

const SearchMusic = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const query = location.state || ""
  const [searchQuery, setSearchQuery] = useState(query)
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    if (query) {
      setDebouncedQuery(query)
      navigate(location.pathname, { state: "" })
    }
  }, [query, navigate, location.pathname])

  const { data: searchResults, isLoading } = useBackendSearchQuery(debouncedQuery)

  const handleSearchClick = () => {
    if (searchQuery.trim()) {
      setDebouncedQuery(searchQuery)
    }
  }

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value)
  }

  return (
    <div className="mx-auto p-6">
      <div className="relative max-w-2xl mx-auto mb-8 flex gap-2">
        <Button onClick={() => navigate("/music")} variant="ghost" className="rounded-full">
          <ArrowLeft />
        </Button>
        <Input
          value={searchQuery}
          onChange={handleInputChange}
          type="text"
          placeholder="Search for songs..."
          className="pl-4 pr-10 py-2 rounded-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearchClick()
            }
          }}
        />
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
          onClick={handleSearchClick}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      <div className="min-h-[200px]">
        {isLoading && (
          <div className="flex items-center justify-center mt-20">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
        {searchResults && !isLoading && (
          <div>
            {searchResults.songs?.length > 0 ? (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold">Search Results</h2>
                  <span className="text-sm text-muted-foreground">
                    {searchResults.count} songs found
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.songs.map((song, index) => (
                    <div key={song?.id || index} className="min-w-[200px]">
                      <SongCard song={song} />
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div className="text-center text-muted-foreground mt-20">
                No songs found for "{debouncedQuery}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchMusic
