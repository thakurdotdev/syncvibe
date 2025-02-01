import { usePlayer, usePlayerState } from "@/Context/PlayerContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import axios from "axios";
import he from "he";
import {
  ListMusic,
  Loader2,
  Music2,
  Pencil,
  Play,
  Plus,
  Trash2,
  User2,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddToPlaylist from "./AddToPlaylist";
import { ensureHttpsForDownloadUrls } from "./Common";
import "./music.css";

// Constants
const CARD_IMAGE_DIMENSIONS = "w-36 h-36 aspect-square mx-auto";
const HOVER_TRANSITION = "transition-all duration-200 ease-out";
const CARD_BASE_CLASSES =
  "group relative overflow-hidden backdrop-blur-sm border border-transparent cursor-pointer";
const CARD_HOVER_CLASSES =
  "hover:shadow-lg hover:bg-accent/50 hover:border-primary/20";

export const AudioWave = memo(() => (
  <div className="flex items-center justify-center gap-1 h-8 px-2">
    {[...Array(5)].map((_, i) => (
      <span
        key={i}
        className="w-1 bg-green-400 rounded-full animate-wave"
        style={{
          animationDelay: `${i * 0.4}s`,
          height: "16px",
          transformOrigin: "bottom",
        }}
      />
    ))}
  </div>
));

// Optimized Image Component
const OptimizedImage = ({ src, alt, className }) => (
  <div className="relative">
    <Avatar className={cn("w-full h-32 rounded-none")}>
      <AvatarImage
        src={src}
        alt={alt}
        className={cn("object-cover", className)}
        loading="lazy"
      />
      <AvatarFallback>
        <img src={src} className="w-full h-full text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
  </div>
);

// Artist Card Component
export const ArtistCard = memo(({ artist }) => {
  const navigate = useNavigate();
  if (!artist?.name || !artist?.image) return null;

  const imageUrl = useMemo(
    () => (Array.isArray(artist.image) ? artist.image[2].link : artist.image),
    [artist.image],
  );

  const handleClick = useCallback(
    () => navigate(`/music/artist/${artist.id}`, { state: artist.id }),
    [artist.id, navigate],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              CARD_BASE_CLASSES,
              CARD_HOVER_CLASSES,
              "w-[150px]",
              HOVER_TRANSITION,
            )}
            onClick={handleClick}
          >
            <CardContent className="p-4 space-y-4">
              <Avatar
                className={cn(
                  "w-32 h-32 rounded-full",
                  "ring-2 ring-offset-2 ring-offset-background ring-primary/10",
                  "group-hover:ring-primary/30",
                  HOVER_TRANSITION,
                )}
              >
                <AvatarImage
                  src={imageUrl}
                  alt={artist.name}
                  className="object-cover group-hover:scale-105"
                />
                <AvatarFallback>
                  <User2 className="w-12 h-12 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>

              <div className="text-center space-y-1">
                <p className="font-semibold line-clamp-1 group-hover:text-primary">
                  {artist.name}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {artist.description || "Artist"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>View {artist.name}'s profile</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// Song Card Component
export const SongCard = memo(({ song }) => {
  const navigate = useNavigate();
  const { playSong, handlePlayPauseSong } = usePlayer();
  const { currentSong, isPlaying } = usePlayerState();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!song?.id || !song?.image?.[2]) return null;

  const isCurrentSong = currentSong?.id === song.id;
  const name = he.decode(song.name || song.title || "");
  const artistName =
    song?.artist_map?.artists
      ?.slice(0, 3)
      ?.map((artist) => artist.name)
      .join(", ") || song?.name;

  const handlePlayClick = async (e) => {
    try {
      if (isCurrentSong) {
        handlePlayPauseSong();
        return;
      }
      if (song?.download_url) {
        const updatedSong = ensureHttpsForDownloadUrls(song);
        playSong(ensureHttpsForDownloadUrls(updatedSong));
        return;
      }
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`,
      );
      if (response.data?.data?.songs[0]) {
        const song = ensureHttpsForDownloadUrls(response.data.data.songs[0]);
        playSong(song);
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching song:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = useCallback((e) => {
    e.stopPropagation();
    // Queue logic implementation
  }, []);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              CARD_BASE_CLASSES,
              CARD_HOVER_CLASSES,
              isCurrentSong && "bg-primary/5 border-primary/30",
              HOVER_TRANSITION,
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={
              song.type === "song"
                ? handlePlayClick
                : () =>
                    navigate(`/music/${song.type}/${song.id}`, {
                      state: song.id,
                    })
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative min-w-[3.5rem] h-14">
                  <div className="relative">
                    <Avatar className={"rounded-none"}>
                      <AvatarImage
                        src={
                          Array.isArray(song.image)
                            ? song.image?.[1].link
                            : song.image
                        }
                        alt={name}
                        className={"object-cover w-14 h-14"}
                        loading="lazy"
                      />
                      <AvatarFallback>
                        <User2 className="w-12 h-12 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {song.type === "song" && (
                    <div
                      className={cn(
                        "absolute inset-0 bg-black/60 flex items-center justify-center",
                        !isCurrentSong && !isHovered && "opacity-0",
                        HOVER_TRANSITION,
                      )}
                    >
                      {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      ) : isCurrentSong && isPlaying ? (
                        <AudioWave />
                      ) : (
                        <Play className="w-6 h-6 text-white" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-grow min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium line-clamp-1 group-hover:text-primary">
                      {name}
                    </p>
                    {isCurrentSong && (
                      <Badge variant="secondary" className="h-5">
                        Playing
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {artistName}
                  </p>
                </div>

                {song.type === "song" && isHovered && (
                  <div className="absolute right-0 top-0 bottom-0 flex items-center gap-2 bg-gradient-to-l from-background/80 via-background/80 pl-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:scale-110"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModalOpen(true);
                      }}
                    >
                      <ListMusic className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:scale-110"
                      onClick={handleAddToQueue}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          {error ? (
            <p className="text-destructive">Error: {error}</p>
          ) : (
            <p>
              {isCurrentSong ? "Now Playing" : "Play"} {name}
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      {isModalOpen && (
        <AddToPlaylist
          dialogOpen={isModalOpen}
          setDialogOpen={setIsModalOpen}
          song={song}
        />
      )}
    </TooltipProvider>
  );
});

// Album Card Component - Similar optimizations applied
export const AlbumCard = memo(({ album }) => {
  const navigate = useNavigate();
  const name = useMemo(
    () => he.decode(album.name || album.title || ""),
    [album],
  );

  const handleClick = useCallback(
    () =>
      navigate(`/music/album/${album.album_id || album?.id}`, {
        state: album.album_id || album?.id,
      }),
    [album, navigate],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              CARD_BASE_CLASSES,
              CARD_HOVER_CLASSES,
              "w-[180px]",
              HOVER_TRANSITION,
            )}
            onClick={handleClick}
          >
            <CardContent className="p-4 space-y-4">
              <div className="relative">
                <OptimizedImage
                  src={album.image[2].link || album.image[2].url}
                  alt={name}
                  className={cn(
                    CARD_IMAGE_DIMENSIONS,
                    "rounded-lg group-hover:scale-105",
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-lg",
                    "flex items-center justify-center opacity-0 group-hover:opacity-100",
                    HOVER_TRANSITION,
                  )}
                >
                  <Music2 className="w-10 h-10 text-white transform translate-y-4 group-hover:translate-y-0" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold line-clamp-1 group-hover:text-primary">
                  {name}
                </p>
                <Badge variant="secondary" className="capitalize text-xs">
                  {album.language}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>View {name} album</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// Playlist Card Component
export const PlaylistCard = memo(({ playlist }) => {
  const navigate = useNavigate();

  if (!playlist?.name || !playlist?.image) return null;

  const subtitle = useMemo(
    () => playlist.subtitle || playlist.description || "Playlist",
    [playlist],
  );

  const imageUrl = useMemo(
    () =>
      Array.isArray(playlist.image) ? playlist.image[2].link : playlist.image,
    [playlist.image],
  );

  const handleClick = useCallback(
    () => navigate(`/music/playlist/${playlist.id}`, { state: playlist.id }),
    [playlist.id, navigate],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              CARD_BASE_CLASSES,
              CARD_HOVER_CLASSES,
              "w-[180px]",
              HOVER_TRANSITION,
            )}
            onClick={handleClick}
          >
            <CardContent className="p-4 space-y-4">
              <div className="relative mx-auto">
                <Avatar className={cn("w-full h-36 rounded-lg")}>
                  <AvatarImage
                    src={imageUrl}
                    alt={playlist.name}
                    className={cn(
                      "rounded-lg object-cover",
                      "group-hover:scale-105",
                      HOVER_TRANSITION,
                    )}
                    loading="lazy"
                  />
                  <AvatarFallback>
                    <ListMusic className="w-10 h-10 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent",
                    "rounded-lg flex items-center justify-center",
                    "opacity-0 group-hover:opacity-100",
                    HOVER_TRANSITION,
                  )}
                >
                  <ListMusic
                    className={cn(
                      "w-10 h-10 text-white transform",
                      "translate-y-4 group-hover:translate-y-0",
                      HOVER_TRANSITION,
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold tracking-tight line-clamp-1 group-hover:text-primary">
                  {playlist.name}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2 group-hover:text-muted-foreground/80">
                  {subtitle}
                </p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>Open {playlist.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

// Action Button Component for UserPlaylistCard
const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  variant = "secondary",
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={variant}
          className={cn(
            "h-8 w-8 bg-white/20 backdrop-blur-sm",
            variant === "secondary"
              ? "hover:bg-white/40"
              : "hover:bg-red-500/80",
            HOVER_TRANSITION,
          )}
          onClick={onClick}
        >
          <Icon className="w-4 h-4 text-white" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// Delete Confirmation Dialog Component
const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, playlistName }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Playlist</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete "{playlistName}"? This action cannot
          be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Delete
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// User Playlist Card Component
export const UserPlaylistCard = ({ playlist, onDelete, onEdit }) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  if (!playlist?.name) return null;

  const subtitle = playlist.description || "Playlist";

  const handleCardClick = useCallback(
    (e) => {
      if (e.target.closest(".action-buttons")) return;
      navigate(`/music/my-playlist/${playlist.id}`, {
        state: playlist.id,
      });
    },
    [playlist.id, navigate],
  );

  const handleDelete = useCallback(() => {
    onDelete(playlist.id);
    setShowDeleteAlert(false);
  }, [playlist.id, onDelete]);

  const handleEdit = useCallback(
    (e) => {
      e.stopPropagation();
      onEdit?.(playlist);
    },
    [playlist, onEdit],
  );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              className={cn(
                CARD_BASE_CLASSES,
                CARD_HOVER_CLASSES,
                "w-1/2 sm:w-[200px]",
                HOVER_TRANSITION,
              )}
              onClick={handleCardClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <CardContent className="p-4 space-y-4">
                <div className="relative mx-auto">
                  <Avatar
                    className={cn(
                      "w-full h-36 rounded-lg",
                      "ring-2 ring-offset-2 ring-offset-background ring-primary/10",
                      "group-hover:ring-primary/30",
                      HOVER_TRANSITION,
                    )}
                  >
                    <AvatarImage
                      src={playlist?.image?.[2]?.link}
                      alt={playlist.name}
                      className={cn(
                        "rounded-lg object-cover",
                        "group-hover:scale-105",
                        HOVER_TRANSITION,
                      )}
                    />
                    <AvatarFallback className="rounded-lg">
                      <ListMusic className="w-10 h-10 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>

                  {/* Overlay with actions */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-lg",
                      "flex flex-col items-center justify-center gap-3",
                      "bg-gradient-to-t from-black/60 via-black/30 to-transparent",
                      isHovered ? "opacity-100" : "opacity-0",
                      HOVER_TRANSITION,
                    )}
                  >
                    <ListMusic
                      className={cn(
                        "w-10 h-10 text-white transform",
                        isHovered ? "translate-y-0" : "translate-y-4",
                        HOVER_TRANSITION,
                      )}
                    />

                    {/* Action buttons */}
                    <div
                      className={cn(
                        "action-buttons absolute bottom-2 right-2",
                        "flex items-center gap-1",
                        "transform",
                        isHovered
                          ? "translate-y-0 opacity-100"
                          : "translate-y-4 opacity-0",
                        HOVER_TRANSITION,
                      )}
                    >
                      <ActionButton
                        icon={Pencil}
                        label="Edit playlist"
                        onClick={handleEdit}
                      />
                      <ActionButton
                        icon={Trash2}
                        label="Delete playlist"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteAlert(true);
                        }}
                        variant="destructive"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold tracking-tight line-clamp-1 group-hover:text-primary">
                    {playlist.name}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 group-hover:text-muted-foreground/80">
                    {subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>Open {playlist.name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DeleteConfirmDialog
        isOpen={showDeleteAlert}
        onClose={() => setShowDeleteAlert(false)}
        onConfirm={handleDelete}
        playlistName={playlist.name}
      />
    </>
  );
};
