/** biome-ignore-all lint/a11y/useButtonType: <explanation> */

import { ChevronDownIcon, Disc3, ListMusic, MoreHorizontal, User, X } from "lucide-react"
import { memo, useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { usePlayerStore } from "@/stores/playerStore"
import NowPlayingTab from "./NowPlayingTab"
import QueueTab from "./QueueTab"

const PlayerSheet = memo(({ isOpen, onClose, currentSong, onOpenModal }) => {
  const [queueOpen, setQueueOpen] = useState(false)
  const playlistLength = usePlayerStore((s) => s.playlist.length)
  const navigate = useNavigate()

  const handleGoToAlbum = useCallback(
    (e) => {
      e.stopPropagation()
      if (currentSong?.album_id) {
        navigate(`/music/album/${currentSong.album_id}`, { state: currentSong.album_id })
        onClose()
      }
    },
    [currentSong?.album_id, navigate, onClose],
  )

  const handleGoToArtist = useCallback(
    (e) => {
      e.stopPropagation()
      if (currentSong?.artist_map?.primary_artists?.[0]?.id) {
        navigate(`/music/artist/${currentSong.artist_map.primary_artists[0].id}`, {
          state: currentSong.artist_map.primary_artists[0].id,
        })
        onClose()
      }
    },
    [currentSong?.artist_map?.primary_artists, navigate, onClose],
  )

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-full w-full p-0 overflow-hidden border-0 bg-black"
      >
        {/* Full-screen Now Playing - all screen sizes */}
        <div className="h-full w-full relative">
          <NowPlayingTab currentSong={currentSong} onOpenModal={onOpenModal} isDesktop />

          {/* Floating controls overlay */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 bg-white/10 hover:bg-white/20 rounded-full transition-colors duration-300"
            >
              <ChevronDownIcon className="h-5 w-5 text-white" />
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQueueOpen(true)}
                className="h-10 w-10 bg-white/10 hover:bg-white/20 rounded-full transition-colors duration-300 relative"
              >
                <ListMusic className="h-5 w-5 text-white" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-white/25 text-[10px] text-white font-semibold flex items-center justify-center px-1">
                  {playlistLength}
                </span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 bg-white/10 hover:bg-white/20 rounded-full transition-colors duration-300"
                  >
                    <MoreHorizontal className="h-5 w-5 text-white" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-[#111] border-white/10"
                >
                  <DropdownMenuItem onClick={onOpenModal} className="cursor-pointer">
                    <ListMusic className="mr-2 h-4 w-4" />
                    Add to Playlist
                  </DropdownMenuItem>

                  {currentSong?.album_id && (
                    <DropdownMenuItem onClick={handleGoToAlbum} className="cursor-pointer text-sm">
                      <Disc3 className="w-3.5 h-3.5 mr-2" />
                      Go to Album
                    </DropdownMenuItem>
                  )}
                  {currentSong?.artist_map?.primary_artists?.[0] && (
                    <DropdownMenuItem onClick={handleGoToArtist} className="cursor-pointer text-sm">
                      <User className="w-3.5 h-3.5 mr-2" />
                      Go to Artist
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Queue slide-over panel */}
          <div
            className={`absolute inset-0 z-40 transition-all duration-500 ease-out ${queueOpen ? "pointer-events-auto" : "pointer-events-none"}`}
          >
            <div
              className={`absolute inset-0 bg-black/70 transition-opacity duration-500 ${queueOpen ? "opacity-100" : "opacity-0"}`}
              onClick={() => setQueueOpen(false)}
            />
            <div
              className={`absolute top-0 right-0 bottom-0 w-full sm:w-[420px] bg-[#0a0a0a]/95 transition-transform duration-500 ease-out flex flex-col ${queueOpen ? "translate-x-0" : "translate-x-full"}`}
            >
              <div className="h-16 px-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <ListMusic className="w-5 h-5 text-white/60" />
                  <span className="text-lg font-semibold text-white/90">Queue</span>
                  <Badge
                    variant="secondary"
                    className="h-5 text-xs bg-white/10 text-white/60 border-0"
                  >
                    {playlistLength}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQueueOpen(false)}
                  className="h-9 w-9 bg-white/10 hover:bg-white/20 rounded-full transition-colors duration-300"
                >
                  <X className="h-4 w-4 text-white" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <QueueTab />
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})

PlayerSheet.displayName = "PlayerSheet"
export default PlayerSheet
