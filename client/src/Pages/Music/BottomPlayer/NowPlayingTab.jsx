import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SheetTitle } from "@/components/ui/sheet";
import he from "he";
import {
  Download,
  ExternalLink,
  Info,
  ListMusic,
  MoreHorizontal,
  Music,
  Share2,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";
import { MusicControls, ProgressBarMusic } from "../Common";

const NowPlayingTab = memo(({ currentSong, onOpenModal }) => {
  const [showDetails, setShowDetails] = useState(false);

  const songImage = useMemo(
    () =>
      currentSong?.image?.[2]?.link ||
      "https://res.cloudinary.com/dr7lkelwl/image/upload/c_thumb,h_200,w_200/f_auto/v1731395454/j6r5zemodfexdxid4gcx.png",
    [currentSong],
  );

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((artist) => artist.name)
        .join(", ") || "",
    [currentSong],
  );

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: he.decode(currentSong.name),
        text: `Listen to ${he.decode(currentSong.name)} by ${he.decode(
          artistName,
        )}`,
        url: window.location.href,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  const handleDownload = async () => {
    const songLink = currentSong?.download_url?.[4]?.link;

    if (!songLink) {
      toast.error("Download link not available");
      return;
    }

    try {
      toast.loading("Preparing download...");

      // Fetch the audio file
      const response = await fetch(songLink);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the file as a blob
      const blob = await response.blob();

      // Create object URL
      const url = window.URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `${he.decode(currentSong.name)} - ${he.decode(
        artistName,
      )}.mp3`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the object URL
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success("Download completed");
    } catch (error) {
      console.error("Download failed:", error);
      toast.dismiss();

      // Fallback: open in new tab if download fails
      toast.error("Direct download failed. Opening in new tab...");
      window.open(songLink, "_blank");
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 max-w-2xl mx-auto gap-10 relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent pointer-events-none" />

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

        {/* Action Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 hover:bg-white/10 backdrop-blur-sm transition-all duration-200 border border-transparent hover:border-white/10"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl"
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
            <DropdownMenuItem
              onClick={handleDownload}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDetails(true)}
              className="cursor-pointer"
            >
              <Info className="mr-2 h-4 w-4" />
              Song Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Album Art */}
      <div className="flex justify-center mb-5 relative z-10">
        <div className="h-80 w-full lg:h-96 relative group">
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

      {/* Song Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Song Details</DialogTitle>
            <DialogDescription>
              Information about the current track
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Avatar className="h-16 w-16 rounded-lg">
                <AvatarImage src={songImage} alt={currentSong.name} />
                <AvatarFallback>MU</AvatarFallback>
              </Avatar>
              <div className="space-y-1 flex-1 min-w-0">
                <h4 className="text-sm font-semibold line-clamp-2">
                  {he.decode(currentSong.name)}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {he.decode(artistName)}
                </p>
                {currentSong?.album?.name && (
                  <p className="text-xs text-muted-foreground">
                    Album: {he.decode(currentSong.album.name)}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              {currentSong?.year && (
                <div>
                  <span className="text-muted-foreground">Year:</span>
                  <p className="font-medium">{currentSong.year}</p>
                </div>
              )}
              {currentSong?.duration && (
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">
                    {Math.floor(currentSong.duration / 60)}:
                    {String(currentSong.duration % 60).padStart(2, "0")}
                  </p>
                </div>
              )}
              {currentSong?.language && (
                <div>
                  <span className="text-muted-foreground">Language:</span>
                  <p className="font-medium">{currentSong.language}</p>
                </div>
              )}
              {currentSong?.quality && (
                <div>
                  <span className="text-muted-foreground">Quality:</span>
                  <p className="font-medium">{currentSong.quality}</p>
                </div>
              )}
            </div>

            {currentSong?.url && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(currentSong.url, "_blank")}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Platform
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

NowPlayingTab.displayName = "NowPlayingTab";
export default NowPlayingTab;
