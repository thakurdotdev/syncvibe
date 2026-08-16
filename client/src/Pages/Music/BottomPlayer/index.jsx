import { memo, useEffect, useRef, useState } from "react"

import { useSongRecommendationsQuery } from "@/hooks/queries/useSongQueries"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import { useAppModeStore } from "@/stores/appModeStore"
import { useGroupPlaybackStore } from "@/stores/groupMusic/playbackStore"
import AddToPlaylist from "../AddToPlaylist"
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
  const mode = useAppModeStore((s) => s.mode)
  const hasMobileNav = isMobile && mode === "music"

  const isMinimized = usePlayerStore((s) => s.isMinimized)
  const setIsMinimized = usePlayerStore((s) => s.setIsMinimized)
  const isClosed = usePlayerStore((s) => s.isClosed)
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

  if (!currentSong || isClosed) return null

  const songImage =
    currentSong?.image?.[2]?.link ||
    currentSong?.image?.[1]?.link ||
    "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png"

  return (
    <>
      {/* Floating Liquid Glass Pill Player */}
      <div
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out",
          "w-[calc(100%-1rem)] xs:w-[calc(100%-1.5rem)] sm:w-auto sm:min-w-[540px] md:min-w-[600px] max-w-xl md:max-w-2xl",
          hasMobileNav ? "bottom-[72px]" : "bottom-4 sm:bottom-6",
          isMinimized
            ? "translate-y-28 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100",
        )}
      >
        {/* Soft centered ambient artwork glow */}
        <div className="absolute inset-0 -z-10 rounded-full opacity-30 blur-3xl overflow-hidden pointer-events-none transition-opacity duration-700">
          <img
            src={songImage}
            alt=""
            className="w-full h-full object-cover scale-150 saturate-200"
          />
        </div>

        {/* Liquid Glass Pill Capsule */}
        <div className="relative w-full rounded-full bg-[#10121a]/75 dark:bg-black/65 backdrop-blur-2xl backdrop-saturate-150 border border-white/15 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.22),0_20px_48px_-8px_rgba(0,0,0,0.7)] px-3.5 sm:px-5 py-2.5 sm:py-3">
          {/* Top subtle specular reflection shine */}
          <div className="absolute top-0 inset-x-8 sm:inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none rounded-full" />

          {/* Main Layout: Left Track Block | Right Controls */}
          <div className="flex items-center justify-between gap-2.5 sm:gap-6">
            <SongInfo currentSong={currentSong} onOpenSheet={() => setIsSheetOpen(true)} />
            <PlayerControls />
          </div>
        </div>
      </div>

      {/* Minimized Draggable Floating Bubble */}
      <MinimizedPlayer
        isMinimized={isMinimized}
        onMaximize={() => setIsMinimized(false)}
        currentSong={currentSong}
        isMobile={isMobile}
      />

      {/* Full-Screen Player Sheet */}
      <PlayerSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        currentSong={currentSong}
        loading={loading}
        recommendations={recommendations}
        onOpenModal={() => setIsModalOpen(true)}
      />

      {/* Add To Playlist Dialog */}
      <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={currentSong} />
    </>
  )
}

export default memo(BottomPlayer)
