import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  AlbumCard,
  ArtistCard,
  PlaylistCard,
  SongCard,
} from "@/Pages/Music/Cards";
import axios from "axios";
import { Loader2, Music2 } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LoadingState } from "./Common";

// Custom hook for intersection observer
const useIntersectionObserver = (options = {}, skipObserver = false) => {
  const [isIntersecting, setIsIntersecting] = useState(skipObserver);
  const targetRef = useRef(null);

  useEffect(() => {
    if (skipObserver) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
        ...options,
      },
    );

    const currentTarget = targetRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [options, skipObserver]);

  return [targetRef, isIntersecting];
};

// Optimized components with memoization
const LazySection = React.memo(
  ({
    title,
    children,
    className,
    priority = false,
    placeholderHeight = "h-48",
  }) => {
    const [ref, isVisible] = useIntersectionObserver({}, priority);
    const [shouldRender, setShouldRender] = useState(priority);

    useEffect(() => {
      if (isVisible && !shouldRender) {
        setShouldRender(true);
      }
    }, [isVisible, shouldRender]);

    return (
      <section ref={ref} className={cn("space-y-6", className)}>
        <div className="flex items-center justify-between px-4 md:px-0">
          <h2 className="text-2xl font-semibold tracking-tight hover:text-primary transition-colors">
            {title}
          </h2>
        </div>
        {shouldRender ? (
          children
        ) : (
          <div
            className={cn(
              "animate-pulse bg-muted/50 rounded-lg",
              placeholderHeight,
            )}
          />
        )}
      </section>
    );
  },
);

const ScrollableSection = React.memo(({ children }) => (
  <ScrollArea className="w-full whitespace-nowrap">
    <div className="flex space-x-4 pb-4">{children}</div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
));

const ErrorState = React.memo(({ error, onRetry }) => (
  <Card className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-background/50 backdrop-blur-sm">
    <Music2 className="w-16 h-16 text-muted-foreground mb-4" />
    <p className="text-lg text-destructive text-center font-medium mb-2">
      {error}
    </p>
    <p className="text-sm text-muted-foreground mb-6">
      Please check your connection and try again
    </p>
    <Button onClick={onRetry} variant="default" className="gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Try Again
    </Button>
  </Card>
));

const CardGrid = React.memo(({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {children}
  </div>
));

const HomePage = () => {
  const [homePageData, setHomePageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [reccLoading, setReccLoading] = useState(true);

  // Optimized data fetching with caching
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/modules?lang=hindi&mini=true`,
        {
          headers: {
            "Cache-Control": "max-age=3600",
          },
        },
      );

      if (response.status === 200) {
        const topAllData = response.data?.data;
        setHomePageData({
          trending: topAllData.trending?.data || [],
          playlists: topAllData.playlists?.data || [],
          albums: topAllData?.albums.data || [],
          charts: topAllData?.charts.data || [],
          artists: topAllData?.artist_recos?.data || [],
        });
      }
    } catch (error) {
      setError("Failed to load content. Please try again later.");
      console.error("Error fetching homepage data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getRecommendations = useCallback(async () => {
    try {
      setReccLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/music/recommendations`,
        {
          withCredentials: true,
          headers: {
            "Cache-Control": "max-age=3600",
          },
        },
      );

      if (response.status === 200) {
        setRecommendations(response.data.songs);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setReccLoading(false);
    }
  }, []);

  // Optimized data loading with Promise.all
  useEffect(() => {
    Promise.all([fetchData(), getRecommendations()]);
  }, [fetchData, getRecommendations]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={fetchData} />;
  if (!homePageData) return null;

  return (
    <div className="relative space-y-8 pb-20">
      <div className="px-4 md:px-6 space-y-8">
        {recommendations.length > 0 && (
          <LazySection
            title="Mostly You Listen"
            className="pt-6"
            priority={true}
          >
            <CardGrid>
              {recommendations.map((song) => (
                <SongCard
                  key={song.songId}
                  song={song.songData}
                  className="transform transition-transform hover:scale-105"
                />
              ))}
            </CardGrid>
          </LazySection>
        )}

        <LazySection title="Trending Now" className="pt-6" priority={true}>
          <CardGrid>
            {homePageData.trending.slice(0, 12).map((song) => (
              <SongCard
                key={song.id}
                song={song}
                className="transform transition-transform hover:scale-105"
              />
            ))}
          </CardGrid>
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
      </div>
    </div>
  );
};

export default React.memo(HomePage);
