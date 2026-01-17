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
import he from "he"
import { Disc3, GripVertical, ListMusic, MoreHorizontal, Pause, Play, User, X } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import LazyImage from "@/components/LazyImage"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { usePlayerStore } from "@/stores/playerStore"

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

    return (
      <div
        className={cn(
          "group flex items-center gap-2 py-1.5 px-1 rounded-lg",
          isCurrentSong ? "bg-primary/10" : "hover:bg-accent/50",
          isDragging && "opacity-30",
          isOverlay && "bg-background shadow-lg border border-border",
        )}
      >
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/40 hover:text-muted-foreground touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Song image with play overlay */}
        <div
          className="relative w-10 h-10 shrink-0 cursor-pointer rounded overflow-hidden"
          onClick={handlePlay}
        >
          <LazyImage
            src={Array.isArray(song.image) ? song.image?.[1]?.link : song.image}
            alt={name}
            className="w-full h-full object-cover"
          />
          <div
            className={cn(
              "absolute inset-0 bg-black/50 flex items-center justify-center",
              "transition-opacity duration-100",
              isCurrentSong ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {isCurrentSong && isPlaying ? (
              <Pause className="w-4 h-4 text-white fill-white" />
            ) : (
              <Play className="w-4 h-4 text-white fill-white" />
            )}
          </div>
        </div>

        {/* Song info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={handlePlay}>
          <p className={cn("text-sm font-medium line-clamp-1", isCurrentSong && "text-primary")}>
            {name}
          </p>
          {artistName && <p className="text-xs text-muted-foreground line-clamp-1">{artistName}</p>}
        </div>

        {/* Now playing indicator */}
        {isCurrentSong && isPlaying && (
          <div className="flex items-center gap-0.5 mr-1">
            <span className="w-0.5 h-3 bg-primary rounded-full animate-pulse" />
            <span className="w-0.5 h-4 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-0.5 h-2 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
          </div>
        )}

        {/* Quick remove (visible on hover) */}
        {!isCurrentSong && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleRemove}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
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
          <DropdownMenuContent align="end" className="w-44">
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
              <DropdownMenuItem
                onClick={handleRemove}
                className="cursor-pointer text-sm text-destructive focus:text-destructive"
              >
                <X className="w-3.5 h-3.5 mr-2" />
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  },
)

QueueSongItem.displayName = "QueueSongItem"

// Sortable wrapper
const SortableSongItem = memo(({ song, isCurrentSong, isPlaying, onPlay, onRemove }) => {
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
      />
    </div>
  )
})

SortableSongItem.displayName = "SortableSongItem"

// Main QueueTab
const QueueTab = memo(() => {
  const playlist = usePlayerStore((s) => s.playlist)
  const currentSongId = usePlayerStore((s) => s.currentSong?.id)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const playSong = usePlayerStore((s) => s.playSong)
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)

  const [activeId, setActiveId] = useState(null)

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
    <div className="h-full">
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground mb-3">
          {playlist.length} song{playlist.length !== 1 ? "s" : ""}
        </p>

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
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
})

QueueTab.displayName = "QueueTab"
export default QueueTab
