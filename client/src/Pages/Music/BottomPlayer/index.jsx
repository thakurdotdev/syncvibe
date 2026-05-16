import { memo, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useSongRecommendationsQuery } from "@/hooks/queries/useSongQueries"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import { useAppModeStore } from "@/stores/appModeStore"
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
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations)

  const isMobile = useIsMobile()
  const appMode = useAppModeStore((s) => s.mode)
  const hasMobileNav = isMobile && appMode === "music"
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem("bottom-player-minimized")
    return saved ? JSON.parse(saved) : false
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const lastFetchedForId = useRef(null)

  const currentIndex = playlist.findIndex((song) => song.id === currentSong?.id)
  const needsRecommendations = currentIndex === -1 || currentIndex >= playlist.length - 2
  const shouldFetch =
    autoFetchRecommendations &&
    !!currentSong?.id &&
    needsRecommendations &&
    lastFetchedForId.current !== currentSong?.id

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

  useEffect(() => {
    localStorage.setItem("bottom-player-minimized", JSON.stringify(isMinimized))
  }, [isMinimized])


  if (!currentSong) return null

  const songImage = currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link

  return (
    <>
      <Card
        className={cn(
          "fixed left-0 w-full border-0 bg-background/90 backdrop-blur-xl z-50 transition-all duration-300 ease-out overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.1)]",
          hasMobileNav ? "bottom-14" : "bottom-0",
          isMinimized
            ? "translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100",
        )}
      >
        {/* Ambient Background Layer */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-20">
          <img
            src={songImage}
            alt=""
            className="w-full h-full object-cover blur-3xl scale-150 transition-all duration-1000"
          />
        </div>

        <CardContent className="p-0 relative">
          <div className="absolute top-0 left-0 right-0">
            <ProgressBarMusic />
          </div>

          <div className="flex items-center justify-between px-4 py-3 pt-4">
            <SongInfo currentSong={currentSong} onOpenSheet={() => setIsSheetOpen(true)} />
            <PlayerControls
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
