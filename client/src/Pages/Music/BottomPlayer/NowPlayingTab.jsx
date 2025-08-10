import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SheetTitle } from "@/components/ui/sheet";
import he from "he";
import { Music } from "lucide-react";
import { memo, useMemo } from "react";
import { MusicControls, ProgressBarMusic } from "../Common";

const NowPlayingTab = memo(({ currentSong }) => {
  const songImage = useMemo(() => currentSong?.image?.[2]?.link, [currentSong]);

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  );

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 max-w-2xl mx-auto gap-10 relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

      {/* Album Art */}
      <div className="flex justify-center relative z-10">
        <div className="w-full h-96 relative group">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-50 blur-xl scale-105 group-hover:opacity-70 transition-opacity duration-300" />
          <Avatar className="w-full h-full rounded-2xl shadow-2xl relative z-10 ring-1 ring-white/10">
            <AvatarImage
              src={songImage}
              alt={currentSong.name}
              className="object-cover"
            />
            <AvatarFallback className="text-4xl sm:text-6xl bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm">
              <Music className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>

          {/* Genre badges if available */}
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

      {/* Header with Title and Menu */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0 pr-4">
          <SheetTitle className="text-xl sm:text-2xl lg:text-3xl mb-1 line-clamp-2 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
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

      {/* Progress Bar */}
      <div className="">
        <ProgressBarMusic isTimeVisible={true} />
      </div>

      {/* Controls Section */}
      <div className="space-y-6 relative z-10">
        {/* Main Music Controls */}
        <div className="flex justify-center">
          <MusicControls size="large" />
        </div>
      </div>
    </div>
  );
});

NowPlayingTab.displayName = "NowPlayingTab";
export default NowPlayingTab;
