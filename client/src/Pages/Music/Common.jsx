import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import ShareDrawer from "@/components/Posts/ShareDrawer";
import {
  usePlayer,
  usePlayerState,
  usePlayerTime,
} from "@/Context/PlayerContext";
import { cn } from "@/lib/utils";
import axios from "axios";
import { Share2 } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useRef } from "react";

export const formatTime = (time) => {
  if (!time) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
};

export const PlaylistActions = ({
  onPlayAll,
  onShuffle,
  disabled,
  showShare = true,
}) => {
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2">
        <Button onClick={onPlayAll} disabled={disabled} className="gap-2">
          <Play className="w-4 h-4" />
          Play All
        </Button>

        <Button
          variant="outline"
          onClick={onShuffle}
          disabled={disabled}
          className="gap-2"
        >
          <Shuffle className="w-4 h-4" />
          Shuffle
        </Button>

        {showShare && (
          <Button
            variant="outline"
            onClick={() => setIsShareDrawerOpen(true)}
            className="gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </div>
      {showShare && (
        <ShareDrawer
          isOpen={isShareDrawerOpen}
          onClose={() => setIsShareDrawerOpen(false)}
          shareLink={window.location.href}
        />
      )}
    </>
  );
};

export const LoadingState = ({ message, height }) => (
  <div
    className={`flex ${
      height ? height : "h-full"
    } items-center justify-center bg-background/50 backdrop-blur-sm`}
  >
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">
        {message || "Loading your music..."}
      </p>
    </div>
  </div>
);

export const MusicControls = memo(({ size = "default" }) => {
  const { handleNextSong, handlePrevSong, handlePlayPauseSong } = usePlayer();
  const { isPlaying } = usePlayerState();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrevSong}
        className={cn(
          "transition-all hover:scale-105",
          size === "large" ? "h-12 w-12" : "h-9 w-9",
        )}
      >
        <SkipBack className={size === "large" ? "h-6 w-6" : "h-4 w-4"} />
      </Button>
      <Button
        variant="default"
        size="icon"
        onClick={handlePlayPauseSong}
        className={cn(
          "transition-all hover:scale-105",
          size === "large" ? "h-14 w-14" : "h-10 w-10",
        )}
      >
        {isPlaying ? (
          <Pause className={size === "large" ? "h-6 w-6" : "h-4 w-4"} />
        ) : (
          <Play className={size === "large" ? "h-6 w-6" : "h-4 w-4"} />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNextSong}
        className={cn(
          "transition-all hover:scale-105",
          size === "large" ? "h-12 w-12" : "h-9 w-9",
        )}
      >
        <SkipForward className={size === "large" ? "h-6 w-6" : "h-4 w-4"} />
      </Button>
    </div>
  );
});

export const VolumeControl = memo(({ showVolume = false }) => {
  const { handleVolumeChange } = usePlayer();
  const { volume } = usePlayerState();
  const [isMuted, setIsMuted] = useState(false);
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      handleVolumeChange(newMuted ? 0 : 1);
      return newMuted;
    });
  }, [handleVolumeChange]);
  if (!showVolume) return null;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:scale-105"
        onClick={toggleMute}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </Button>
      <Slider
        value={[volume]}
        min={0}
        max={1}
        step={0.01}
        className="w-16"
        onValueChange={([value]) => handleVolumeChange(value)}
      />
    </div>
  );
});

export const ProgressBarMusic = memo(({ isTimeVisible = false }) => {
  const { currentTime, duration } = usePlayerTime() || {};
  const { handleTimeSeek } = usePlayer() || {};

  return (
    <div className="space-y-2">
      <Slider
        value={[currentTime]}
        min={0}
        max={duration}
        step={0.1}
        onValueChange={([value]) => handleTimeSeek(value)}
        className="h-1 cursor-pointer rounded-l-none"
      />
      {isTimeVisible && (
        <div className="flex justify-between">
          <p className="text-muted-foreground text-sm">
            {formatTime(currentTime)}
          </p>
          <p className="text-muted-foreground text-sm">
            {formatTime(duration)}
          </p>
        </div>
      )}
    </div>
  );
});

export const ensureHttpsForDownloadUrls = (song) => {
  if (!song || typeof song !== "object") return song;

  // Handle download_url edge cases
  const updatedDownloadUrls = Array.isArray(song.download_url)
    ? song.download_url.map((item) => {
        if (!item || typeof item !== "object") return item;
        return {
          ...item,
          link:
            item.link && typeof item.link === "string"
              ? item.link.startsWith("http://")
                ? item.link.replace("http://", "https://")
                : item.link
              : item.link,
        };
      })
    : song.download_url;

  // Handle image edge cases
  const updatedArtworkUrls = Array.isArray(song.image)
    ? song.image.map((item) => {
        if (!item || typeof item !== "object") return item;
        return {
          ...item,
          link:
            item.link && typeof item.link === "string"
              ? item.link.startsWith("http://")
                ? item.link.replace("http://", "https://")
                : item.link
              : item.link,
        };
      })
    : song.image;

  return {
    ...song,
    download_url: updatedDownloadUrls,
    image: updatedArtworkUrls,
  };
};

export const addToHistory = async (songData, playedTime, trackingType) => {
  try {
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL}/api/history/add`,
      { songData, playedTime, trackingType },
      { withCredentials: true },
    );

    if (response.status === 200) {
      console.log(
        `Successfully tracked ${trackingType} for song:`,
        songData.name,
      );
    }
  } catch (error) {
    console.error(`Error adding song to history (${trackingType}):`, error);
  }
};
