import { memo, useEffect, useRef, useState } from "react"

import { useSongRecommendationsQuery } from "@/hooks/queries/useSongQueries"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import { useAppModeStore } from "@/stores/appModeStore"
import { useGroupPlaybackStore } from "@/stores/groupMusic/playbackStore"
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
  const isSoloPlaying = usePlayerStore((s) => s.isPlaying)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const isGroupPlaying = useGroupPlaybackStore((s) => s.isPlaying)

  useEffect(() => {
    if (isGroupPlaying && isSoloPlaying) {
      handlePlayPause()
    }
  }, [isGroupPlaying, isSoloPlaying, handlePlayPause])

  const isMobile = useIsMobile()
  const appMode = useAppModeStore((s) => s.mode)
  const hasMobileNav = isMobile && appMode === "music"
  const isMinimized = usePlayerStore((s) => s.isMinimized)
  const setIsMinimized = usePlayerStore((s) => s.setIsMinimized)
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

  if (!currentSong) return null

  const songImage = currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link

  return (
    <>
      <div
        className={cn(
          "fixed left-0 w-full transition-all duration-300 ease-out z-50",
          hasMobileNav ? "bottom-0" : "bottom-0",
          isMinimized
            ? "translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100",
        )}
      >
        <div className="absolute -top-1 left-0 right-0 z-50">
          <ProgressBarMusic />
        </div>

        <div
          className="w-full border-t border-x-0 border-b-0 liquid-glass overflow-hidden"
          style={{
            borderRadius: 0,
          }}
        >
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute -left-16 -top-16 w-80 h-80 rounded-full opacity-60 blur-3xl">
              <img
                src={songImage}
                alt=""
                className="w-full h-full object-cover scale-150 transition-all duration-1000"
              />
            </div>
            <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full opacity-60 blur-3xl">
              <img
                src={songImage}
                alt=""
                className="w-full h-full object-cover scale-150 transition-all duration-1000"
              />
            </div>
            <div className="absolute inset-0 bg-black/15" />
          </div>

          <div className={cn("p-0 relative pt-1.5", hasMobileNav && "pb-14")}>
            <div className="flex items-center justify-between px-4 py-3">
              <SongInfo currentSong={currentSong} onOpenSheet={() => setIsSheetOpen(true)} />
              <PlayerControls
                onMinimize={() => setIsMinimized(true)}
                onOpenModal={() => setIsModalOpen(true)}
                isMobile={isMobile}
              />
            </div>
          </div>
        </div>
      </div>

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
