/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AnimatePresence, motion } from "framer-motion"
import he from "he"
import {
  Disc3,
  GripVertical,
  ListMusic,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
  X,
} from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import LazyImage from "@/components/LazyImage"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"
import { useSongRecommendationsQuery } from "@/hooks/queries/useSongQueries"

const buttonVariants = {
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
}

const itemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
}

// Minimal queue song item - clean and lightweight
const QueueSongItem = memo(
  ({
    song,
    isCurrentSong,
    isPlaying,
    isDragging,
    dragHandleProps,
    isOverlay,
    onPlay,
    onRemove,
    onFetchRecommendations,
    isLoadingRecs,
  }) => {
    const navigate = useNavigate()

    const name = useMemo(() => he.decode(song.name || song.title || ""), [song.name, song.title])
    const artistName = useMemo(
      () =>
        song?.artist_map?.artists
          ?.slice(0, 2)
          ?.map((artist) => artist.name)
          .join(", ") || "",
      [song?.artist_map?.artists],
    )

    const handlePlay = useCallback(
      (e) => {
        e.stopPropagation()
        onPlay(song, isCurrentSong)
      },
      [onPlay, song, isCurrentSong],
    )

    const handleRemove = useCallback(
      (e) => {
        e.stopPropagation()
        onRemove(song.id, name, isCurrentSong)
      },
      [onRemove, song.id, name, isCurrentSong],
    )

    const handleGoToAlbum = useCallback(
      (e) => {
        e.stopPropagation()
        if (song?.album_id) {
          navigate(`/music/album/${song.album_id}`, { state: song.album_id })
        }
      },
      [song?.album_id, navigate],
    )

    const handleGoToArtist = useCallback(
      (e) => {
        e.stopPropagation()
        if (song?.artist_map?.primary_artists?.[0]?.id) {
          navigate(`/music/artist/${song.artist_map.primary_artists[0].id}`, {
            state: song.artist_map.primary_artists[0].id,
          })
        }
      },
      [song?.artist_map?.primary_artists, navigate],
    )

    const handleFetchRecs = useCallback(
      (e) => {
        e.stopPropagation()
        onFetchRecommendations?.(song.id, song.name || song.title)
      },
      [onFetchRecommendations, song.id, song.name, song.title],
    )

    return (
      <motion.div
        layout
        initial={!isOverlay ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn(
          "group flex items-center gap-2 py-1.5 px-1 rounded-lg",
          isCurrentSong ? "bg-primary/10" : "hover:bg-accent/50",
          isOverlay && "bg-background shadow-lg border border-border",
        )}
      >
        <motion.div
          {...dragHandleProps}
          whileHover={{ scale: 1.1 }}
          className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-muted-foreground touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative w-10 h-10 shrink-0 cursor-pointer rounded-md overflow-hidden shadow-xs"
          onClick={handlePlay}
        >
          <LazyImage
            src={Array.isArray(song.image) ? song.image?.[1]?.link : song.image}
            alt={name}
            className="w-full h-full object-cover"
          />
          <motion.div
            initial={false}
            animate={{ opacity: isCurrentSong ? 1 : 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isCurrentSong && isPlaying ? "pause" : "play"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {isCurrentSong && isPlaying ? (
                  <Pause className="w-4 h-4 text-white fill-white" />
                ) : (
                  <Play className="w-4 h-4 text-white fill-white" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlay}>
          <p
            className={cn(
              "text-sm font-medium line-clamp-1 transition-colors",
              isCurrentSong && "text-primary",
            )}
          >
            {name}
          </p>
          {artistName && <p className="text-xs text-muted-foreground line-clamp-1">{artistName}</p>}
        </div>

        <AnimatePresence>
          {isCurrentSong && isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-0.5 mr-1"
            >
              <motion.span
                animate={{ height: [12, 16, 8, 12] }}
                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                className="w-0.5 bg-primary rounded-full"
                style={{ height: 12 }}
              />
              <motion.span
                animate={{ height: [16, 8, 12, 16] }}
                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.15 }}
                className="w-0.5 bg-primary rounded-full"
                style={{ height: 16 }}
              />
              <motion.span
                animate={{ height: [8, 12, 16, 8] }}
                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut", delay: 0.3 }}
                className="w-0.5 bg-primary rounded-full"
                style={{ height: 8 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {!isCurrentSong && (
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="opacity-0 group-hover:opacity-100"
          >
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemove}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={handleFetchRecs}
              disabled={isLoadingRecs}
              className="cursor-pointer text-sm"
            >
              {isLoadingRecs ? (
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-2" />
              )}
              Get similar songs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {song?.album_id && (
              <DropdownMenuItem onClick={handleGoToAlbum} className="cursor-pointer text-sm">
                <Disc3 className="w-3.5 h-3.5 mr-2" />
                Go to Album
              </DropdownMenuItem>
            )}
            {song?.artist_map?.primary_artists?.[0] && (
              <DropdownMenuItem onClick={handleGoToArtist} className="cursor-pointer text-sm">
                <User className="w-3.5 h-3.5 mr-2" />
                Go to Artist
              </DropdownMenuItem>
            )}
            {!isCurrentSong && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleRemove}
                  className="cursor-pointer text-sm text-destructive focus:text-destructive"
                >
                  <X className="w-3.5 h-3.5 mr-2" />
                  Remove
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    )
  },
)

QueueSongItem.displayName = "QueueSongItem"

// Sortable wrapper
const SortableSongItem = memo(
  ({ song, isCurrentSong, isPlaying, onPlay, onRemove, onFetchRecommendations, isLoadingRecs }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: song.id,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition || "transform 150ms ease",
    }

    return (
      <div ref={setNodeRef} style={style}>
        <QueueSongItem
          song={song}
          isCurrentSong={isCurrentSong}
          isPlaying={isPlaying}
          isDragging={isDragging}
          dragHandleProps={{ ...attributes, ...listeners }}
          onPlay={onPlay}
          onRemove={onRemove}
          onFetchRecommendations={onFetchRecommendations}
          isLoadingRecs={isLoadingRecs}
        />
      </div>
    )
  },
)

SortableSongItem.displayName = "SortableSongItem"

// Main QueueTab
const QueueTab = memo(() => {
  const playlist = usePlayerStore((s) => s.playlist)
  const currentSong = usePlayerStore((s) => s.currentSong)
  const currentSongId = currentSong?.id
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const playSong = usePlayerStore((s) => s.playSong)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const clearQueue = usePlayerStore((s) => s.clearQueue)
  const replaceQueue = usePlayerStore((s) => s.replaceQueue)
  const addToQueue = usePlayerStore((s) => s.addToQueue)
  const autoFetchRecommendations = usePlayerStore((s) => s.autoFetchRecommendations)
  const setAutoFetchRecommendations = usePlayerStore((s) => s.setAutoFetchRecommendations)

  const [activeId, setActiveId] = useState(null)
  const [fetchingRecs, setFetchingRecs] = useState(false)
  const [loadingSongId, setLoadingSongId] = useState(null)

  const { refetch: fetchRecommendations } = useSongRecommendationsQuery(currentSongId, {
    enabled: false,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handlePlay = useCallback(
    (song, isCurrentSong) => {
      if (isCurrentSong) {
        handlePlayPause()
      } else {
        playSong(song)
      }
    },
    [handlePlayPause, playSong],
  )

  const handleRemove = useCallback(
    (songId, name, isCurrentSong) => {
      if (isCurrentSong) {
        toast.error("Cannot remove currently playing song")
        return
      }
      setPlaylist(playlist.filter((item) => item.id !== songId))
      toast.success(`Removed "${name}"`)
    },
    [setPlaylist, playlist],
  )

  const handleClearQueue = useCallback(() => {
    clearQueue()
    toast.success("Queue cleared")
  }, [clearQueue])

  const handleFetchAndReplace = useCallback(async () => {
    if (!currentSongId) return
    setFetchingRecs(true)
    try {
      const { data } = await fetchRecommendations()
      if (data?.length > 0) {
        replaceQueue(data, true)
        toast.success(`Added ${data.length} recommendations`)
      } else {
        toast.info("No recommendations found")
      }
    } catch {
      toast.error("Failed to fetch recommendations")
    }
    setFetchingRecs(false)
  }, [currentSongId, fetchRecommendations, replaceQueue])

  const handleFetchAndAdd = useCallback(async () => {
    if (!currentSongId) return
    setFetchingRecs(true)
    try {
      const { data } = await fetchRecommendations()
      if (data?.length > 0) {
        const addToQueue = usePlayerStore.getState().addToQueue
        addToQueue(data)
        toast.success(`Added ${data.length} songs to queue`)
      } else {
        toast.info("No recommendations found")
      }
    } catch {
      toast.error("Failed to fetch recommendations")
    }
    setFetchingRecs(false)
  }, [currentSongId, fetchRecommendations])

  const handleToggleAutoFetch = useCallback(() => {
    setAutoFetchRecommendations(!autoFetchRecommendations)
    toast.success(autoFetchRecommendations ? "Auto-fetch disabled" : "Auto-fetch enabled")
  }, [autoFetchRecommendations, setAutoFetchRecommendations])

  const handleSongFetchRecs = useCallback(
    async (songId, songName) => {
      if (!songId || loadingSongId) return
      setLoadingSongId(songId)
      try {
        const { fetchSongRecommendations } = await import("@/api/music/songs")
        const data = await fetchSongRecommendations(songId)
        if (data?.length > 0) {
          addToQueue(data)
          toast.success(`Added ${data.length} similar songs`)
        } else {
          toast.info("No similar songs found")
        }
      } catch {
        toast.error("Failed to fetch recommendations")
      }
      setLoadingSongId(null)
    },
    [loadingSongId, addToQueue],
  )

  const handleDragStart = useCallback((event) => setActiveId(event.active.id), [])

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      setActiveId(null)
      if (active.id !== over?.id) {
        const oldIndex = playlist.findIndex((s) => s.id === active.id)
        const newIndex = playlist.findIndex((s) => s.id === over?.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          setPlaylist(arrayMove(playlist, oldIndex, newIndex))
        }
      }
    },
    [playlist, setPlaylist],
  )

  const handleDragCancel = useCallback(() => setActiveId(null), [])

  const activeSong = useMemo(
    () => (activeId ? playlist.find((s) => s.id === activeId) : null),
    [activeId, playlist],
  )

  const playlistIds = useMemo(() => playlist.map((s) => s.id), [playlist])

  if (!playlist?.length) {
    return (
      <div className="flex flex-col justify-center items-center h-[70vh] gap-3">
        <ListMusic className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Queue is empty</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full">
        <div className="px-3 py-2">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between mb-3"
          >
            <motion.p
              key={playlist.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground"
            >
              {playlist.length} song{playlist.length !== 1 ? "s" : ""}
            </motion.p>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={handleClearQueue}
                      disabled={playlist.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Clear queue
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={fetchingRecs}
                      >
                        {fetchingRecs ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Recommendations
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleFetchAndAdd} className="cursor-pointer text-sm">
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Add to queue
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleFetchAndReplace}
                    className="cursor-pointer text-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    Replace queue
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleToggleAutoFetch}
                    className="cursor-pointer text-sm"
                  >
                    {autoFetchRecommendations ? (
                      <ToggleRight className="w-3.5 h-3.5 mr-2 text-primary" />
                    ) : (
                      <ToggleLeft className="w-3.5 h-3.5 mr-2" />
                    )}
                    Auto-fetch: {autoFetchRecommendations ? "On" : "Off"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={playlistIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {playlist.map((song) => (
                  <SortableSongItem
                    key={song.id}
                    song={song}
                    isCurrentSong={currentSongId === song.id}
                    isPlaying={isPlaying}
                    onPlay={handlePlay}
                    onRemove={handleRemove}
                    onFetchRecommendations={handleSongFetchRecs}
                    isLoadingRecs={loadingSongId === song.id}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeSong && (
                <QueueSongItem
                  song={activeSong}
                  isCurrentSong={currentSongId === activeSong.id}
                  isPlaying={isPlaying}
                  isOverlay
                  onPlay={handlePlay}
                  onRemove={handleRemove}
                  onFetchRecommendations={handleSongFetchRecs}
                  isLoadingRecs={loadingSongId === activeSong.id}
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </TooltipProvider>
  )
})

QueueTab.displayName = "QueueTab"
export default QueueTab
