/** biome-ignore-all lint/a11y/useButtonType: <explanation> */

import he from "he"
import { ChevronDownIcon, Download, ListMusic, MoreHorizontal, Music, Share2 } from "lucide-react"
import { Activity, memo, useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { usePlayerStore } from "@/stores/playerStore"

import NowPlayingTab from "./NowPlayingTab"
import QueueTab from "./QueueTab"

const PlayerSheet = memo(({ isOpen, onClose, currentSong, onOpenModal }) => {
  const [activeTab, setActiveTab] = useState("current")
  const playlistLength = usePlayerStore((s) => s.playlist.length)

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  )

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: he.decode(currentSong.name),
        text: `Listen to ${he.decode(currentSong.name)} by ${he.decode(artistName)}`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success("Link copied to clipboard")
    }
  }

  const handleDownload = async () => {
    const songLink = currentSong?.download_url?.[4]?.link

    if (!songLink) {
      toast.error("Download link not available")
      return
    }

    try {
      toast.loading("Preparing download...")
      const response = await fetch(songLink)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${he.decode(currentSong.name)} - ${he.decode(artistName)}.mp3`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success("Download completed")
    } catch (error) {
      console.error("Download failed:", error)
      toast.dismiss()
      toast.error("Direct download failed. Opening in new tab...")
      window.open(songLink, "_blank")
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-full w-full p-0 overflow-hidden bg-gradient-to-br from-background/95 via-background/90 to-background/95 backdrop-blur-xl border-t border-white/10 shadow-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-white/[0.04] pointer-events-none" />

        {/* Desktop: Side-by-side layout */}
        <div className="hidden lg:flex h-full w-full max-w-6xl mx-auto relative z-10">
          {/* Now Playing Section */}
          <div className="flex-1 flex flex-col border-r border-white/10 relative">
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
              <h2 className="text-lg font-semibold">Now Playing</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-background/95 backdrop-blur-xl border-white/10"
                >
                  <DropdownMenuItem onClick={onOpenModal} className="cursor-pointer">
                    <ListMusic className="mr-2 h-4 w-4" />
                    Add to Playlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Song
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <NowPlayingTab currentSong={currentSong} onOpenModal={onOpenModal} isDesktop={true} />
          </div>

          {/* Queue Section */}
          <div className="w-[420px] flex flex-col bg-white/[0.02]">
            <div className="h-14 px-4 flex items-center gap-2 border-b border-white/10 bg-white/[0.03] shrink-0 justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-primary" />
                <span className="text-base font-medium">Queue</span>
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 text-xs bg-primary/15 text-primary border-primary/20"
                >
                  {playlistLength}
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full"
              >
                <ChevronDownIcon className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <QueueTab />
            </div>
          </div>
        </div>

        {/* Mobile/Tablet: Tab-based layout */}
        <div className="lg:hidden h-full flex flex-col w-full max-w-[500px] mx-auto relative z-10">
          <SheetHeader className="px-3 pb-0 border-b border-white/10 bg-gradient-to-r from-white/[0.05] to-transparent">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 shrink-0 hover:bg-white/10"
              >
                <ChevronDownIcon className="h-5 w-5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 hover:bg-white/10"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-background/95 backdrop-blur-xl border-white/10"
                >
                  <DropdownMenuItem onClick={onOpenModal} className="cursor-pointer">
                    <ListMusic className="mr-2 h-4 w-4" />
                    Add to Playlist
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Song
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload} className="cursor-pointer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex justify-center pb-4">
              <div className="grid grid-cols-2 w-full bg-white/[0.08] rounded-lg p-1 border border-white/10">
                <button
                  onClick={() => setActiveTab("current")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "current"
                      ? "bg-primary/20 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span className="hidden sm:inline">Now Playing</span>
                  <span className="sm:hidden">Current</span>
                </button>
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "queue"
                      ? "bg-primary/20 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ListMusic className="w-4 h-4" />
                  <span>Queue</span>
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 text-xs bg-primary/15 text-primary border-primary/20"
                  >
                    {playlistLength}
                  </Badge>
                </button>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden relative">
            <Activity mode={activeTab === "current" ? "visible" : "hidden"}>
              <div className="absolute inset-0 overflow-y-auto">
                <NowPlayingTab currentSong={currentSong} onOpenModal={onOpenModal} />
              </div>
            </Activity>

            <Activity mode={activeTab === "queue" ? "visible" : "hidden"}>
              <div className="absolute inset-0 overflow-y-auto">
                <QueueTab />
              </div>
            </Activity>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})

PlayerSheet.displayName = "PlayerSheet"
export default PlayerSheet
