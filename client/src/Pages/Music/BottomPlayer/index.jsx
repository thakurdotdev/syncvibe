import { memo, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useSongRecommendationsQuery } from "@/hooks/queries/useSongQueries"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import AddToPlaylist from "../AddToPlaylist"
import { ProgressBarMusic } from "../Common"
import MinimizedPlayer from "./MinimizedPlayer"
import PlayerControls from "./PlayerControls"
import PlayerSheet from "./PlayerSheet"
import SongInfo from "./SongInfo"

const BottomPlayer = () => {
  const currentSong = usePlayerStore((s) => s.currentSong)
  const playlist = usePlayerStore((s) => s.playlist)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  const isMobile = useIsMobile()
  const [isMinimized, setIsMinimized] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const lastFetchedForId = useRef(null)

  const currentIndex = playlist.findIndex((song) => song.id === currentSong?.id)
  const needsRecommendations = currentIndex === -1 || currentIndex >= playlist.length - 2
  const shouldFetch =
    !!currentSong?.id && needsRecommendations && lastFetchedForId.current !== currentSong?.id

  const { data: recommendations = [], isLoading: loading } = useSongRecommendationsQuery(
    currentSong?.id,
    { enabled: shouldFetch },
  )

  useEffect(() => {
    if (recommendations.length > 0 && shouldFetch) {
      lastFetchedForId.current = currentSong?.id
      addToQueue(recommendations)
    }
  }, [recommendations, shouldFetch, currentSong?.id, addToQueue])

  if (!currentSong) return null

  return (
    <>
      <Card
        className={cn(
          "fixed bottom-0 left-0 w-full bg-background/80 backdrop-blur-md border-t z-50 transition-all duration-500",
          isMinimized ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <CardContent className="p-0">
          <div className="absolute -top-1 left-0 w-full">
            <ProgressBarMusic />
          </div>

          <div className="flex items-center justify-between p-4 pt-5">
            <SongInfo currentSong={currentSong} onOpenSheet={() => setIsSheetOpen(true)} />

            <PlayerControls
              isMinimized={isMinimized}
              onMinimize={() => setIsMinimized(true)}
              onOpenModal={() => setIsModalOpen(true)}
              isMobile={isMobile}
            />
          </div>
        </CardContent>
      </Card>

      <MinimizedPlayer
        isMinimized={isMinimized}
        onMaximize={() => setIsMinimized(false)}
        currentSong={currentSong}
        isMobile={isMobile}
      />

      <PlayerSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentSong={currentSong}
        loading={loading}
        recommendations={recommendations}
        onOpenModal={() => setIsModalOpen(true)}
      />

      <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={currentSong} />
    </>
  )
}

export default memo(BottomPlayer)
