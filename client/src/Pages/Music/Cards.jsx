import axios from "axios"
import { AnimatePresence, motion } from "framer-motion"
import he from "he"
import { Disc3, ListMusic, Loader2, MoreVertical, Pencil, Play, Trash2 } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import LazyImage from "@/components/LazyImage"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import AddToPlaylist from "./AddToPlaylist"
import { ensureHttpsForDownloadUrls } from "./Common"
import "./music.css"

const MotionCard = motion.div

export const AudioWave = memo(() => (
  <div className="flex items-center justify-center gap-0.5 h-6">
    {[...Array(4)].map((_, i) => (
      <motion.span
        key={i}
        className="w-0.5 bg-white rounded-full"
        animate={{
          height: ["8px", "16px", "8px"],
        }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          delay: i * 0.1,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
))

export const ArtistCard = memo(({ artist }) => {
  const navigate = useNavigate()
  if (!artist?.name || !artist?.image) return null

  const imageUrl = Array.isArray(artist.image) ? artist.image[2].link : artist.image

  return (
    <MotionCard
      className="w-[150px] group cursor-pointer p-3 rounded-lg"
      onClick={() => navigate(`/music/artist/${artist.id}`, { state: artist.id })}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative mb-3">
        <LazyImage
          src={imageUrl}
          alt={artist.name}
          height={128}
          width={128}
          className="w-full aspect-square rounded-full object-cover"
        />
      </div>
      <p className="font-medium text-sm text-center truncate group-hover:text-primary transition-colors">
        {artist.name}
      </p>
      <p className="text-xs text-muted-foreground text-center truncate">
        {artist.description || "Artist"}
      </p>
    </MotionCard>
  )
})

export const SongCard = memo(({ song }) => {
  const navigate = useNavigate()
  const currentSongId = usePlayerStore((s) => s.currentSong?.id)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playlist = usePlayerStore((s) => s.playlist)
  const playSong = usePlayerStore((s) => s.playSong)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  const [loading, setLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!song?.id || !song?.image?.[2]) return null

  const isCurrentSong = currentSongId === song.id
  const name = he.decode(song.name || song.title || "")
  const artistName =
    song?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((a) => a.name)
      .join(", ") ||
    song?.name ||
    ""
  const isInQueue = playlist.some((item) => item.id === song.id)

  const handlePlay = async (e) => {
    e?.stopPropagation()
    if (isCurrentSong) {
      handlePlayPause()
      return
    }
    if (song?.download_url) {
      playSong(ensureHttpsForDownloadUrls(song))
      return
    }
    setLoading(true)
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`)
      if (response.data?.data?.songs[0]) {
        playSong(ensureHttpsForDownloadUrls(response.data.data.songs[0]))
      }
    } catch (err) {
      console.error("Error fetching song:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToQueue = (e) => {
    e.stopPropagation()
    if (!isCurrentSong) {
      addToQueue(song)
      toast.success(`Added to queue`)
    }
  }

  const handleRemoveFromQueue = (e) => {
    e.stopPropagation()
    if (isCurrentSong) {
      toast.error("Can't remove playing song")
      return
    }
    setPlaylist(playlist.filter((item) => item.id !== song.id))
    toast.success(`Removed from queue`)
  }

  const handleNavigate = () => {
    if (song.type !== "song") {
      navigate(`/music/${song.type}/${song.id}`, { state: song.id })
    }
  }

  return (
    <>
      <MotionCard
        className={cn("group cursor-pointer rounded-lg p-2", isCurrentSong && "bg-primary/5")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{
          backgroundColor: isCurrentSong ? "rgba(var(--primary), 0.08)" : "rgba(255,255,255,0.05)",
        }}
        whileTap={{ scale: 0.995 }}
      >
        <div
          className="flex items-center gap-3"
          onClick={song.type === "song" ? handlePlay : handleNavigate}
        >
          <div className="relative shrink-0 w-12 h-12">
            <LazyImage
              src={Array.isArray(song.image) ? song.image?.[1].link : song.image}
              alt={name}
              height={48}
              width={48}
              className="w-12 h-12 rounded-md object-cover"
            />
            {song.type === "song" && (
              <AnimatePresence>
                {(isCurrentSong || isHovered || menuOpen) && (
                  <motion.div
                    className="absolute inset-0 rounded-md bg-black/60 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : isCurrentSong && isPlaying ? (
                      <AudioWave />
                    ) : (
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Play className="w-5 h-5 text-white" fill="white" />
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{name}</p>
              <AnimatePresence>
                {isCurrentSong && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5 shrink-0">
                      Playing
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-xs text-muted-foreground truncate">{artistName}</p>
          </div>

          {song.type === "song" && (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {song?.album_id && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/music/album/${song.album_id}`, { state: song.album_id })
                    }}
                  >
                    Go to album
                  </DropdownMenuItem>
                )}
                {song?.artist_map?.primary_artists?.[0] && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/music/artist/${song.artist_map.primary_artists[0].id}`)
                    }}
                  >
                    Go to artist
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={isInQueue && !isCurrentSong ? handleRemoveFromQueue : handleAddToQueue}
                  disabled={isCurrentSong && isInQueue}
                >
                  {isInQueue
                    ? isCurrentSong
                      ? "Now Playing"
                      : "Remove from queue"
                    : "Add to queue"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsModalOpen(true)
                  }}
                >
                  Add to playlist
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </MotionCard>

      {isModalOpen && (
        <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={song} />
      )}
    </>
  )
})

export const NewSongCard = memo(({ song }) => {
  const navigate = useNavigate()
  const currentSongId = usePlayerStore((s) => s.currentSong?.id)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playlist = usePlayerStore((s) => s.playlist)
  const playSong = usePlayerStore((s) => s.playSong)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const addToQueue = usePlayerStore((s) => s.addToQueue)

  const [loading, setLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!song?.id || !song?.image?.[2]) return null

  const isCurrentSong = currentSongId === song.id
  const name = he.decode(song.name || song.title || "")
  const artistName =
    song?.artist_map?.artists
      ?.slice(0, 2)
      ?.map((a) => a.name)
      .join(", ") ||
    song?.name ||
    ""
  const isInQueue = playlist.some((item) => item.id === song.id)

  const handlePlay = async () => {
    if (isCurrentSong) {
      handlePlayPause()
      return
    }
    if (song?.download_url) {
      playSong(ensureHttpsForDownloadUrls(song))
      return
    }
    setLoading(true)
    try {
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/song?id=${song.id}`)
      if (response.data?.data?.songs[0]) {
        playSong(ensureHttpsForDownloadUrls(response.data.data.songs[0]))
      }
    } catch (err) {
      console.error("Error fetching song:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToQueue = (e) => {
    e.stopPropagation()
    if (!isCurrentSong) {
      addToQueue(song)
      toast.success(`Added to queue`)
    }
  }

  const handleRemoveFromQueue = (e) => {
    e.stopPropagation()
    if (isCurrentSong) {
      toast.error("Can't remove playing song")
      return
    }
    setPlaylist(playlist.filter((item) => item.id !== song.id))
    toast.success(`Removed from queue`)
  }

  const handleNavigate = () => {
    if (song.type !== "song") {
      navigate(`/music/${song.type}/${song.id}`, { state: song.id })
    }
  }

  return (
    <>
      <MotionCard
        className={cn(
          "w-[150px] group cursor-pointer rounded-lg p-2",
          isCurrentSong && "bg-primary/5",
        )}
        onClick={song.type === "song" ? handlePlay : handleNavigate}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative mb-2 overflow-hidden rounded-lg">
          <motion.div
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <LazyImage
              src={Array.isArray(song.image) ? song.image?.[2]?.link : song.image}
              alt={name}
              height={140}
              width={140}
              className="w-full aspect-square rounded-lg object-cover"
            />
          </motion.div>
          <AnimatePresence>
            {(isCurrentSong || isHovered || menuOpen) && (
              <motion.div
                className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {loading ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : isCurrentSong && isPlaying ? (
                  <div className="scale-125">
                    <AudioWave />
                  </div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Play className="w-10 h-10 text-white" fill="white" />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {song.type === "song" && (
            <div
              className={cn(
                "absolute top-1 right-1 transition-opacity duration-150",
                "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                menuOpen && "opacity-100!",
              )}
            >
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-black/50 hover:bg-black/70"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4 text-white" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {song?.album_id && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/music/album/${song.album_id}`, { state: song.album_id })
                      }}
                    >
                      Go to album
                    </DropdownMenuItem>
                  )}
                  {song?.artist_map?.primary_artists?.[0] && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/music/artist/${song.artist_map.primary_artists[0].id}`)
                      }}
                    >
                      Go to artist
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={isInQueue && !isCurrentSong ? handleRemoveFromQueue : handleAddToQueue}
                    disabled={isCurrentSong && isInQueue}
                  >
                    {isInQueue
                      ? isCurrentSong
                        ? "Now Playing"
                        : "Remove from queue"
                      : "Add to queue"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsModalOpen(true)
                    }}
                  >
                    Add to playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{artistName}</p>
          {(song.language || song.album || song.type !== "song") && (
            <Badge
              variant="outline"
              className="mt-1.5 text-[10px] h-5 capitalize max-w-full truncate"
            >
              {song.language || (song.type === "song" ? song.album : song.type)}
            </Badge>
          )}
        </div>
      </MotionCard>

      {isModalOpen && (
        <AddToPlaylist dialogOpen={isModalOpen} setDialogOpen={setIsModalOpen} song={song} />
      )}
    </>
  )
})

export const AlbumCard = memo(({ album }) => {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)
  const name = useMemo(() => he.decode(album.name || album.title || ""), [album])

  return (
    <MotionCard
      className="w-[150px] group cursor-pointer rounded-lg p-2"
      onClick={() =>
        navigate(`/music/album/${album.album_id || album?.id}`, {
          state: album.album_id || album?.id,
        })
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative mb-2 overflow-hidden rounded-lg">
        <motion.div
          animate={{ scale: isHovered ? 1.05 : 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <LazyImage
            src={album.image?.[2]?.link || album.image?.[2]?.url}
            alt={name}
            height={140}
            width={140}
            className="w-full aspect-square rounded-lg object-cover"
          />
        </motion.div>
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                <Disc3 className="w-8 h-8 text-white" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
        {name}
      </p>
      {album.language && (
        <Badge variant="outline" className="mt-1 text-[10px] h-5 capitalize max-w-full truncate">
          {album.language}
        </Badge>
      )}
    </MotionCard>
  )
})

export const PlaylistCard = memo(({ playlist }) => {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)

  if (!playlist?.name || !playlist?.image) return null

  const subtitle = useMemo(
    () => playlist.subtitle || playlist.description || "Playlist",
    [playlist],
  )

  const imageUrl = useMemo(
    () => (Array.isArray(playlist.image) ? playlist.image[2].link : playlist.image),
    [playlist.image],
  )

  return (
    <MotionCard
      className="w-[150px] group cursor-pointer rounded-lg p-2"
      onClick={() => navigate(`/music/playlist/${playlist.id}`, { state: playlist.id })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative mb-2 overflow-hidden rounded-lg">
        <motion.div
          animate={{ scale: isHovered ? 1.05 : 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <LazyImage
            src={imageUrl}
            alt={playlist.name}
            height={140}
            width={140}
            className="w-full aspect-square rounded-lg object-cover"
          />
        </motion.div>
        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.05 }}
              >
                <ListMusic className="w-8 h-8 text-white" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
        {playlist.name}
      </p>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
    </MotionCard>
  )
})

const DeleteConfirmDialog = ({ isOpen, onClose, onConfirm, playlistName }) => (
  <AlertDialog open={isOpen} onOpenChange={onClose}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete Playlist</AlertDialogTitle>
        <AlertDialogDescription>
          Delete "{playlistName}"? This can't be undone.
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
)

export const UserPlaylistCard = ({ playlist, onDelete, onEdit }) => {
  const navigate = useNavigate()
  const [isHovered, setIsHovered] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)

  if (!playlist?.name) return null

  const subtitle = playlist.description || `${playlist.songs?.length || 0} songs`

  const handleCardClick = useCallback(
    (e) => {
      if (e.target.closest(".action-buttons")) return
      navigate(`/music/my-playlist/${playlist.id}`, { state: playlist.id })
    },
    [playlist.id, navigate],
  )

  const handleDelete = useCallback(() => {
    onDelete(playlist.id)
    setShowDeleteAlert(false)
  }, [playlist.id, onDelete])

  return (
    <>
      <MotionCard
        className="w-[180px] group cursor-pointer rounded-lg p-2"
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="relative mb-2 overflow-hidden rounded-lg">
          <motion.div
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Avatar className="w-full h-auto aspect-square rounded-lg">
              <AvatarImage
                src={playlist?.image?.[2]?.link}
                alt={playlist.name}
                className="object-cover rounded-lg"
              />
              <AvatarFallback className="rounded-lg aspect-square flex items-center justify-center bg-muted">
                <ListMusic className="w-8 h-8 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </motion.div>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05 }}
                >
                  <ListMusic className="w-8 h-8 text-white" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="action-buttons absolute bottom-2 right-2 flex gap-1"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-white/90 hover:bg-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.(playlist)
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 text-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-white/90 hover:bg-destructive hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteAlert(true)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
          {playlist.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </MotionCard>

      <DeleteConfirmDialog
        isOpen={showDeleteAlert}
        onClose={() => setShowDeleteAlert(false)}
        onConfirm={handleDelete}
        playlistName={playlist.name}
      />
    </>
  )
}
