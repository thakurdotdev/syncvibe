import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SheetTitle } from "@/components/ui/sheet"
import he from "he"
import { Music } from "lucide-react"
import { memo, useMemo } from "react"
import { MusicControls, ProgressBarMusic } from "../Common"

const NowPlayingTab = memo(({ currentSong, isDesktop = false }) => {
  const songImage = useMemo(() => currentSong?.image?.[2]?.link, [currentSong])

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  )

  if (isDesktop) {
    return (
      <div className="w-full h-full flex items-center justify-center px-8 py-12 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-3xl scale-125"
          style={{ backgroundImage: `url(${songImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/50" />

        <div className="relative z-10 flex flex-col items-center gap-12 w-full">
          <div
            className="relative group shrink-0"
            style={{ width: "min(400px, 45vh)", height: "min(400px, 45vh)" }}
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 via-transparent to-primary/20 opacity-60 blur-2xl scale-110 group-hover:opacity-80 transition-opacity duration-300" />
            <Avatar className="w-full h-full rounded-2xl shadow-2xl relative z-10 ring-1 ring-white/20">
              <AvatarImage src={songImage} alt={currentSong.name} className="object-cover" />
              <AvatarFallback className="text-6xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Music className="w-24 h-24 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            {currentSong?.genre && (
              <div className="absolute top-4 left-4 z-20">
                <Badge
                  variant="secondary"
                  className="text-xs bg-black/40 backdrop-blur-sm border border-white/20 text-white"
                >
                  {currentSong.genre}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-6 text-center">
            <div>
              <SheetTitle className="text-2xl xl:text-3xl font-bold mb-3 line-clamp-2">
                {he.decode(currentSong.name)}
              </SheetTitle>
              <p className="text-lg text-muted-foreground line-clamp-1">{he.decode(artistName)}</p>
              {currentSong?.album?.name && (
                <p className="text-sm text-muted-foreground/60 mt-2">
                  {he.decode(currentSong.album.name)}
                </p>
              )}
            </div>
            <ProgressBarMusic isTimeVisible={true} />

            <div className="flex justify-center">
              <MusicControls size="large" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 max-w-2xl mx-auto gap-10 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

      <div className="flex justify-center relative z-10">
        <div className="w-full h-96 relative group">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-50 blur-xl scale-105 group-hover:opacity-70 transition-opacity duration-300" />
          <Avatar className="w-full h-full rounded-2xl shadow-2xl relative z-10 ring-1 ring-white/10">
            <AvatarImage src={songImage} alt={currentSong.name} className="object-cover" />
            <AvatarFallback className="text-4xl sm:text-6xl bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm">
              <Music className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>

          {currentSong?.genre && (
            <div className="absolute top-3 left-3 z-20">
              <Badge
                variant="secondary"
                className="text-xs bg-white/20 backdrop-blur-sm border border-white/20 text-foreground"
              >
                {currentSong.genre}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0 pr-4">
          <SheetTitle className="text-xl sm:text-2xl lg:text-3xl mb-1 line-clamp-2">
            {he.decode(currentSong.name)}
          </SheetTitle>
          <p className="text-sm sm:text-base text-muted-foreground line-clamp-1">
            {he.decode(artistName)}
          </p>
          {currentSong?.album?.name && (
            <p className="text-xs sm:text-sm text-muted-foreground/70 mt-1">
              {he.decode(currentSong.album.name)}
            </p>
          )}
        </div>
      </div>

      <div>
        <ProgressBarMusic isTimeVisible={true} />
      </div>

      <div className="space-y-6 relative z-10">
        <div className="flex justify-center">
          <MusicControls size="large" />
        </div>
      </div>
    </div>
  )
})

NowPlayingTab.displayName = "NowPlayingTab"
export default NowPlayingTab
