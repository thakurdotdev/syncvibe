import { motion } from "framer-motion"
import {
  ChevronRight,
  Clock,
  Disc3,
  ListMusic,
  Music2,
  RotateCcw,
  TrendingUp,
  Users,
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useHomepageModulesQuery,
  useRecommendationsQuery,
} from "@/hooks/queries/useHomepageQueries"
import { cn } from "@/lib/utils"
import { AlbumCard, ArtistCard, NewSongCard, PlaylistCard } from "@/Pages/Music/Cards"

const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const Section = ({ title, icon: Icon, children, className, link, linkText }) => (
  <motion.section
    className={cn("space-y-3", className)}
    variants={sectionVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.4, ease: "easeOut" }}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {link && (
        <Link to={link}>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            {linkText || "See all"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </div>
    {children}
  </motion.section>
)

const ScrollableRow = ({ children }) => (
  <ScrollArea className="w-full">
    <div className="flex gap-2 pb-4">{children}</div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
)

const CardSkeleton = ({ type = "song" }) => {
  if (type === "artist") {
    return (
      <div className="w-[150px] p-3 space-y-3">
        <Skeleton className="w-full aspect-square rounded-full" />
        <div className="space-y-1.5 text-center">
          <Skeleton className="h-4 w-4/5 mx-auto" />
          <Skeleton className="h-3 w-3/5 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-[150px] p-2 space-y-2">
      <Skeleton className="w-full aspect-square rounded-lg" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  )
}

const SectionSkeleton = ({ type = "song", count = 12 }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="h-5 w-32" />
    </div>
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-4">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} type={type} />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
)

const HomepageSkeleton = () => (
  <div className="px-4 md:px-6 py-6 space-y-6">
    <SectionSkeleton type="song" />
    <SectionSkeleton type="song" />
    <SectionSkeleton type="song" />
    <SectionSkeleton type="song" />
    <SectionSkeleton type="artist" />
  </div>
)

const ErrorState = ({ error, onRetry }) => (
  <motion.div
    className="flex flex-col items-center justify-center min-h-[50vh] px-6"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
  >
    <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 mb-6">
      <Music2 className="w-12 h-12 text-destructive" />
    </div>
    <h3 className="text-lg font-semibold">Something went wrong</h3>
    <p className="text-muted-foreground text-sm mt-1 mb-4">{error}</p>
    <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
      <RotateCcw className="w-4 h-4" />
      Try again
    </Button>
  </motion.div>
)

const HomePage = () => {
  const { data: homePageData, isLoading, isError, error, refetch } = useHomepageModulesQuery()
  const { data: recommendations, isLoading: reccLoading } = useRecommendationsQuery()

  if (isLoading) return <HomepageSkeleton />
  if (isError) return <ErrorState error={error?.message || "Failed to load"} onRetry={refetch} />
  if (!homePageData) return null

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 md:px-6 py-6 space-y-6">
        {reccLoading ? (
          <SectionSkeleton type="song" />
        ) : (
          recommendations?.recentlyPlayed?.length > 0 && (
            <Section title="Recently Played" icon={Clock} link="/music/history" linkText="History">
              <ScrollableRow>
                {recommendations.recentlyPlayed.map((song) => (
                  <NewSongCard key={song.id} song={song} />
                ))}
              </ScrollableRow>
            </Section>
          )
        )}

        {reccLoading ? (
          <SectionSkeleton type="song" />
        ) : (
          recommendations?.songs?.length > 0 && (
            <Section title="For You" icon={Music2}>
              <ScrollableRow>
                {recommendations.songs.map((song) => (
                  <NewSongCard key={song.id} song={song} />
                ))}
              </ScrollableRow>
            </Section>
          )
        )}

        {homePageData.trending?.length > 0 && (
          <Section title="Trending Now" icon={TrendingUp}>
            <ScrollableRow>
              {homePageData.trending.map((song) => (
                <NewSongCard key={song.id} song={song} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.playlists?.length > 0 && (
          <Section title="Top Playlists" icon={ListMusic}>
            <ScrollableRow>
              {homePageData.playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.charts?.length > 0 && (
          <Section title="Top Charts" icon={TrendingUp}>
            <ScrollableRow>
              {homePageData.charts.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.artists?.length > 0 && (
          <Section title="Top Artists" icon={Users}>
            <ScrollableRow>
              {homePageData.artists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.albums?.length > 0 && (
          <Section title="Top Albums" icon={Disc3}>
            <ScrollableRow>
              {homePageData.albums.map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </ScrollableRow>
          </Section>
        )}

        {homePageData.bhakti?.length > 0 && (
          <Section title="Discover" icon={Music2}>
            <ScrollableRow>
              {homePageData.bhakti.map((song) => (
                <NewSongCard key={song.id} song={song} />
              ))}
            </ScrollableRow>
          </Section>
        )}
      </div>
    </div>
  )
}

export default HomePage
