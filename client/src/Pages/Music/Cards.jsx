import {
  usePlayer,
  usePlayerState,
  usePlaylist,
} from "@/Context/PlayerContext";
import LazyImage from "@/components/LazyImage";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  EllipsisVerticalIcon,
  ListMusic,
  Loader2,
  Music2Icon,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AddToPlaylist from "./AddToPlaylist";
import { addToHistory, ensureHttpsForDownloadUrls } from "./Common";
import "./music.css";

const HOVER_TRANSITION = "transition-all duration-0 ease-out";
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
              <LazyImage
                src={imageUrl}
                alt={artist.name}
                height={128}
                width={128}
                className={cn(
                  "rounded-full ring-2 ring-offset-2 ring-offset-background ring-primary/10 group-hover:ring-primary/30 object-cover group-hover:scale-105",
                  HOVER_TRANSITION,
                )}
              />
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

export const SongCard = memo(({ song }) => {
  const navigate = useNavigate();
  const { playSong, handlePlayPauseSong, addToPlaylist, addToQueue } =
    usePlayer();
  const { currentSong, isPlaying } = usePlayerState();
  const { playlist } = usePlaylist();

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
        addToHistory(updatedSong, 10);
        return;
      }
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`,
      );
      if (response.data?.data?.songs[0]) {
        const song = ensureHttpsForDownloadUrls(response.data.data.songs[0]);
        playSong(song);
        addToHistory(song, 10);
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching song:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = useCallback(
    (e) => {
      e.stopPropagation();
      if (!isCurrentSong) {
        addToQueue(song);
        toast.success(`Added ${name} to queue`);
      }
    },
    [song, name, isCurrentSong, addToQueue],
  );

  const handleRemoveFromQueue = useCallback((e) => {
    e.stopPropagation();
    const updatedQueue = playlist.filter((item) => item.id !== song.id);
    addToPlaylist(updatedQueue);
    toast.success(`Removed ${name} from queue`);
  }, []);

  const isInQueue = playlist.some((item) => item.id === song.id);

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
              "p-0",
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <CardContent className="p-1">
              <div className="flex items-center gap-4">
                <div
                  className="relative min-w-[3rem] h-14"
                  onClick={
                    song.type === "song"
                      ? handlePlayClick
                      : () =>
                          navigate(`/music/${song.type}/${song.id}`, {
                            state: song.id,
                          })
                  }
                >
                  <div className="relative">
                    <LazyImage
                      src={
                        Array.isArray(song.image)
                          ? song.image?.[1].link
                          : song.image
                      }
                      alt={name}
                      height={50}
                      width={50}
                      className={cn(
                        "w-14 h-14 rounded-lg",
                        "group-hover:scale-105",
                        HOVER_TRANSITION,
                      )}
                    />
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

                <div
                  className="flex-grow min-w-0 space-y-1"
                  onClick={
                    song.type === "song"
                      ? handlePlayClick
                      : () =>
                          navigate(`/music/${song.type}/${song.id}`, {
                            state: song.id,
                          })
                  }
                >
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

                {song.type === "song" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="link" className="ml-auto">
                        <EllipsisVerticalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {song?.album_id && (
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/music/album/${song.album_id}`, {
                              state: song.album_id,
                            })
                          }
                          className="capitalize cursor-pointer line-clamp-1 truncate"
                        >
                          More from {song.album}
                        </DropdownMenuItem>
                      )}
                      {song?.artist_map?.primary_artists?.[0] && (
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(
                              `/music/artist/${song.artist_map.primary_artists[0].id}`,
                              {
                                state: song.artist_map.primary_artists[0].id,
                              },
                            )
                          }
                          className="capitalize cursor-pointer line-clamp-1 truncate"
                        >
                          More from {song.artist_map.primary_artists[0].name}
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuItem
                        onClick={
                          isInQueue ? handleRemoveFromQueue : handleAddToQueue
                        }
                        className="capitalize cursor-pointer"
                      >
                        {isInQueue ? "Remove from Queue" : "Add to Queue"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setIsModalOpen(true)}
                        className="capitalize cursor-pointer"
                      >
                        Add to Playlist
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

export const NewSongCard = memo(({ song }) => {
  const navigate = useNavigate();
  const { playSong, handlePlayPauseSong, addToPlaylist, addToQueue } =
    usePlayer();
  const { currentSong, isPlaying } = usePlayerState();
  const { playlist } = usePlaylist();

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
  const isInQueue = playlist.some((item) => item.id === song.id);

  const handlePlayClick = async () => {
    try {
      if (isCurrentSong) {
        handlePlayPauseSong();
        return;
      }

      if (song?.download_url) {
        const updatedSong = ensureHttpsForDownloadUrls(song);
        playSong(updatedSong);
        addToHistory(updatedSong, 10);
        return;
      }

      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`,
      );

      if (response.data?.data?.songs[0]) {
        const songData = ensureHttpsForDownloadUrls(
          response.data.data.songs[0],
        );
        playSong(songData);
        addToHistory(songData, 10);
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching song:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = useCallback(
    (e) => {
      e.stopPropagation();
      if (!isCurrentSong) {
        addToQueue(song);
        toast.success(`Added ${name} to queue`);
      }
    },
    [song, name, isCurrentSong, addToQueue],
  );

  const handleRemoveFromQueue = useCallback(
    (e) => {
      e.stopPropagation();
      const updatedQueue = playlist.filter((item) => item.id !== song.id);
      addToPlaylist(updatedQueue);
      toast.success(`Removed ${name} from queue`);
    },
    [song, name, playlist, addToPlaylist],
  );

  const handleNavigate = useCallback(() => {
    if (song.type !== "song") {
      navigate(`/music/${song.type}/${song.id}`, { state: song.id });
    }
  }, [song, navigate]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            className={cn(
              CARD_BASE_CLASSES,
              CARD_HOVER_CLASSES,
              "w-[150px]",
              isCurrentSong && "bg-primary/5 border-primary/30",
              HOVER_TRANSITION,
              "p-0",
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={song.type === "song" ? handlePlayClick : handleNavigate}
          >
            <CardContent className="space-y-4 p-1">
              <div className="relative">
                <LazyImage
                  src={
                    Array.isArray(song.image)
                      ? song.image?.[2]?.link
                      : song.image
                  }
                  alt={name}
                  className={cn(
                    "rounded-lg w-full",
                    "group-hover:scale-105",
                    HOVER_TRANSITION,
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent",
                    "rounded-lg flex items-center justify-center",
                    !isCurrentSong && !isHovered ? "opacity-0" : "opacity-100",
                    HOVER_TRANSITION,
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-10 h-10 animate-spin text-white" />
                  ) : isCurrentSong && isPlaying ? (
                    <div className="transform scale-150">
                      <AudioWave />
                    </div>
                  ) : (
                    <Play
                      className={cn(
                        "w-10 h-10 text-white transform",
                        "translate-y-4 group-hover:translate-y-0",
                        HOVER_TRANSITION,
                      )}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="md:font-semibold text-sm line-clamp-1 group-hover:text-primary">
                    {name}
                  </p>
                  {isCurrentSong && (
                    <Badge variant="secondary" className="h-5">
                      Playing
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1 truncate">
                  {artistName}
                </p>

                <div className="flex justify-between items-center mt-2">
                  {song.language ? (
                    <Badge variant="outline" className="text-xs capitalize">
                      {song.language}
                    </Badge>
                  ) : song?.album ? (
                    <Badge
                      variant="outline"
                      className="text-xs capitalize truncate line-clamp-1 mr-3"
                    >
                      {song.album}
                    </Badge>
                  ) : song?.type === "album" ? (
                    <Badge
                      variant="outline"
                      className="text-xs capitalize truncate line-clamp-1 mr-3"
                    >
                      Album
                    </Badge>
                  ) : song?.type === "playlist" ? (
                    <Badge
                      variant="outline"
                      className="text-xs capitalize truncate line-clamp-1 mr-3"
                    >
                      Playlist
                    </Badge>
                  ) : null}
                  {song.type === "song" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EllipsisVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {song?.album_id && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/music/album/${song.album_id}`, {
                                state: song.album_id,
                              });
                            }}
                            className="capitalize cursor-pointer line-clamp-1 truncate"
                          >
                            More from {song.album}
                          </DropdownMenuItem>
                        )}
                        {song?.artist_map?.primary_artists?.[0] && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/music/artist/${song.artist_map.primary_artists[0].id}`,
                                {
                                  state: song.artist_map.primary_artists[0].id,
                                },
                              );
                            }}
                            className="capitalize cursor-pointer line-clamp-1"
                          >
                            More from {song.artist_map.primary_artists[0].name}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            isInQueue
                              ? handleRemoveFromQueue(e)
                              : handleAddToQueue(e);
                          }}
                          className="capitalize cursor-pointer"
                        >
                          {isInQueue ? "Remove from Queue" : "Add to Queue"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsModalOpen(true);
                          }}
                          className="capitalize cursor-pointer"
                        >
                          Add to Playlist
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
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
              "w-[150px]",
              HOVER_TRANSITION,
            )}
            onClick={handleClick}
          >
            <CardContent className="p-1 space-y-4">
              <div className="relative">
                <LazyImage
                  src={album.image?.[2]?.link || album.image?.[2]?.url}
                  alt={name}
                  height={144}
                  width={144}
                  className={cn(
                    "rounded-lg",
                    "group-hover:scale-105",
                    HOVER_TRANSITION,
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent",
                    "rounded-lg flex items-center justify-center",
                    "opacity-0 group-hover:opacity-100",
                    HOVER_TRANSITION,
                  )}
                >
                  <Music2Icon
                    className={cn(
                      "w-10 h-10 text-white transform",
                      "translate-y-4 group-hover:translate-y-0",
                      HOVER_TRANSITION,
                    )}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="font-semibold line-clamp-1 group-hover:text-primary">
                  {name}
                </p>
                {album.language && (
                  <Badge variant="secondary" className="capitalize text-xs">
                    {album.language}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>View {name} album</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

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
              "w-[150px]",
              HOVER_TRANSITION,
            )}
            onClick={handleClick}
          >
            <CardContent className="p-1 space-y-4">
              <div className="relative mx-auto">
                <LazyImage
                  src={imageUrl}
                  alt={playlist.name}
                  height={144}
                  width={144}
                  className={cn(
                    "rounded-lg object-cover",
                    "group-hover:scale-105",
                    HOVER_TRANSITION,
                  )}
                />
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
