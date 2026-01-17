import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AlbumCard, ArtistCard, PlaylistCard, SongCard } from "./Cards"

const SearchMusic = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const query = location.state || ""
  const [searchQuery, setSearchQuery] = useState(query)
  const [searchResults, setSearchResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (query) {
      fetchData(query)
      navigate(location.pathname, { state: "" })
    }
  }, [query])

  // Fetch Data from API
  const fetchData = useCallback(async (query) => {
    try {
      if (!query.trim()) {
        setSearchResults(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)

      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/search?q=${query}`)

      if (response.status === 200) {
        setSearchResults(response.data?.data)
      }
    } catch (error) {
      console.error("Error fetching search data:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSearchClick = () => {
    if (searchQuery.trim()) {
      fetchData(searchQuery)
    }
  }

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // Results Section Component
  const ResultsSection = ({ title, items, renderItem }) => {
    if (!items?.data?.length) return null

    return (
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {items.data.map((item, index) => (
            <div key={item.id || index} className="min-w-[200px]">
              {renderItem(item)}
            </div>
          ))}
        </div>
      </section>
    )
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
          placeholder="Search for songs, albums, artists, playlists..."
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
        {/* Main content */}
        {searchResults && !isLoading && (
          <div>
            {/* Top Result */}
            {searchResults.top_query?.data?.length > 0 && (
              <section className="mb-8 max-w-[30%]">
                <h2 className="text-2xl font-semibold mb-4">Top Result</h2>
                {searchResults.top_query?.data.map((result) => {
                  const Component = {
                    song: SongCard,
                    artist: ArtistCard,
                    album: AlbumCard,
                  }[result.type]

                  if (!Component) return null

                  return <Component {...{ [result.type]: result }} />
                })}
              </section>
            )}

            {/* Other sections */}
            <ResultsSection
              title="Top Songs"
              items={searchResults.songs}
              renderItem={(song) => <SongCard song={song} />}
            />
            <ResultsSection
              title="Top Artists"
              items={searchResults.artists}
              renderItem={(artist) => <ArtistCard artist={artist} />}
            />
            <ResultsSection
              title="Top Albums"
              items={searchResults.albums}
              renderItem={(album) => <AlbumCard album={album} />}
            />
            <ResultsSection
              title="Top Playlists"
              items={searchResults.playlists}
              renderItem={(playlist) => <PlaylistCard playlist={playlist} />}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default SearchMusic
