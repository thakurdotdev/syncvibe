import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from "@/Pages/Music/Cards"
import axios from "axios"
import { Loader2, Music2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

const LazySection = ({ title, children, className }) => {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between px-4 md:px-0">
        <h2 className="text-lg md:text-2xl font-semibold tracking-tight hover:text-primary transition-colors">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

const ScrollableSection = ({ children }) => (
  <ScrollArea className="w-full whitespace-nowrap">
    <div className="flex space-x-4 pb-4">{children}</div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
)

// Skeleton for NewSongCard - matches 150px width card with image, title, artist, badge, menu
const SongCardSkeleton = () => (
  <Card className="w-[150px] p-1 border border-transparent">
    <div className="space-y-4 p-1">
      <Skeleton className="w-full aspect-square rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-3 w-[70%]" />
        <div className="flex justify-between items-center mt-2">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  </Card>
)

// Skeleton for PlaylistCard - matches 150px width with image, title, subtitle
const PlaylistCardSkeleton = () => (
  <Card className="w-[150px] p-1 border border-transparent">
    <div className="space-y-4 p-1">
      <Skeleton className="w-full aspect-square rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[60%]" />
      </div>
    </div>
  </Card>
)

// Skeleton for ArtistCard - matches 150px width with circular image, name, description
const ArtistCardSkeleton = () => (
  <Card className="w-[150px] p-4 border border-transparent">
    <div className="space-y-4">
      <Skeleton className="w-[128px] h-[128px] rounded-full mx-auto" />
      <div className="text-center space-y-1">
        <Skeleton className="h-4 w-[80%] mx-auto" />
        <Skeleton className="h-3 w-[60%] mx-auto" />
      </div>
    </div>
  </Card>
)

// Section skeleton with title and scrollable card skeletons
const SectionSkeleton = ({ cardType = "song", cardCount = 10, className }) => {
  const skeletons = Array.from({ length: cardCount })

  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between px-4 md:px-0">
        <Skeleton className="h-6 md:h-8 w-40" />
      </div>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex space-x-4 pb-4">
          {cardType === "playlist" && skeletons.map((_, i) => <PlaylistCardSkeleton key={i} />)}
          {cardType === "artist" && skeletons.map((_, i) => <ArtistCardSkeleton key={i} />)}
          {cardType === "song" && skeletons.map((_, i) => <SongCardSkeleton key={i} />)}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  )
}

// Full page skeleton for initial load
const HomepageSkeleton = () => (
  <div className="relative space-y-8 pb-20">
    <div className="px-4 md:px-6 space-y-4">
      <SectionSkeleton cardType="song" className="pt-6" />
      <SectionSkeleton cardType="song" className="pt-6" />
      <SectionSkeleton cardType="song" />
      <SectionSkeleton cardType="playlist" />
      <SectionSkeleton cardType="playlist" />
      <SectionSkeleton cardType="artist" />
      <SectionSkeleton cardType="song" />
    </div>
  </div>
)

const ErrorState = ({ error, onRetry }) => (
  <Card className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-background/50 backdrop-blur-sm">
    <Music2 className="w-16 h-16 text-muted-foreground mb-4" />
    <p className="text-lg text-destructive text-center font-medium mb-2">{error}</p>
    <p className="text-sm text-muted-foreground mb-6">Please check your connection and try again</p>
    <Button onClick={onRetry} variant="default" className="gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Try Again
    </Button>
  </Card>
)

const HomePage = () => {
  const [homePageData, setHomePageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recommendations, setRecommendations] = useState({
    songs: [],
    recentlyPlayed: [],
  })
  const [reccLoading, setReccLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/modules?lang=hindi&mini=true`,
      )

      if (response.status === 200) {
        const topAllData = response.data?.data

        setHomePageData({
          trending: topAllData.trending?.data || [],
          playlists: topAllData.playlists?.data || [],
          albums: topAllData?.albums.data || [],
          charts: topAllData?.charts.data || [],
          artists: topAllData?.artist_recos?.data || [],
          bhakti: topAllData?.promo8?.data || [],
        })
      }
    } catch (error) {
      setError("Failed to load content. Please try again later.")
      console.error("Error fetching homepage data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const getRecommendations = useCallback(async () => {
    try {
      setReccLoading(true)
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/music/recommendations`,
        {
          withCredentials: true,
        },
      )

      if (response.status === 200) {
        const { songs, recentlyPlayed } = response.data.data

        setRecommendations({
          songs: songs || [],
          recentlyPlayed: recentlyPlayed || [],
        })
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error)
    } finally {
      setReccLoading(false)
    }
  }, [])

  useEffect(() => {
    getRecommendations()
  }, [getRecommendations])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <HomepageSkeleton />
  if (error) return <ErrorState error={error} onRetry={fetchData} />
  if (!homePageData) return null

  return (
    <div className="relative space-y-8 pb-20">
      <div className="px-4 md:px-6 space-y-4">
        {reccLoading ? (
          <SectionSkeleton cardType="song" className="pt-6" />
        ) : (
          recommendations.recentlyPlayed.length > 0 && (
            <LazySection title="Recently Played" className="pt-6" priority={true}>
              <ScrollableSection>
                {recommendations.recentlyPlayed.map((song) => (
                  <NewSongCard
                    key={song.id}
                    song={song}
                    className="transform transition-transform hover:scale-105"
                  />
                ))}
              </ScrollableSection>
            </LazySection>
          )
        )}

        {reccLoading ? (
          <SectionSkeleton cardType="song" className="pt-6" />
        ) : (
          recommendations.songs.length > 0 && (
            <LazySection title="Mostly You Listen" className="pt-6" priority={true}>
              <ScrollableSection>
                {recommendations.songs.map((song) => (
                  <NewSongCard
                    key={song.id}
                    song={song}
                    className="transform transition-transform hover:scale-105"
                  />
                ))}
              </ScrollableSection>
            </LazySection>
          )
        )}

        <LazySection title="Trending Now" priority={true}>
          <ScrollableSection>
            {homePageData.trending.map((song) => (
              <NewSongCard
                key={song.id}
                song={song}
                className="transform transition-transform hover:scale-105"
              />
            ))}
          </ScrollableSection>
        </LazySection>

        <LazySection title="Top Playlists">
          <ScrollableSection>
            {homePageData.playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                className="min-w-[200px] transform transition-transform hover:scale-105"
              />
            ))}
          </ScrollableSection>
        </LazySection>

        <LazySection title="Top Charts">
          <ScrollableSection>
            {homePageData.charts.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                className="min-w-[200px] transform transition-transform hover:scale-105"
              />
            ))}
          </ScrollableSection>
        </LazySection>

        {homePageData.artists.length > 0 && (
          <LazySection title="Top Artists">
            <ScrollableSection>
              {homePageData.artists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  className="min-w-[150px] transform transition-transform hover:scale-105"
                />
              ))}
            </ScrollableSection>
          </LazySection>
        )}

        <LazySection title="Top Albums">
          <ScrollableSection>
            {homePageData.albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                className="min-w-[200px] transform transition-transform hover:scale-105"
              />
            ))}
          </ScrollableSection>
        </LazySection>

        {homePageData.bhakti.length > 0 && (
          <LazySection title="Random">
            <ScrollableSection>
              {homePageData.bhakti.map((song) => (
                <NewSongCard
                  key={song.id}
                  song={song}
                  className="transform transition-transform hover:scale-105"
                />
              ))}
            </ScrollableSection>
          </LazySection>
        )}
      </div>
    </div>
  )
}

export default HomePage
