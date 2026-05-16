import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useUserPlaylistsQuery, usePlaylistDetailsQuery } from "@/hooks/queries/usePlaylistQueries"
import { cn } from "@/lib/utils"
import { ArrowLeft, ChevronRight, ListPlus, Loader2, Music, Play, SkipForward } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const PlaylistSongItem = memo(({ song, onPlayNow, onPlayNext, onAddToQueue }) => {
  const artistName = useMemo(
    () => song.artist_map?.primary_artists?.[0]?.name || "Unknown Artist",
    [song.artist_map?.primary_artists],
  )

  const duration = useMemo(() => {
    if (!song.duration) return null
    const mins = Math.floor(song.duration / 60)
    const secs = String(song.duration % 60).padStart(2, "0")
    return `${mins}:${secs}`
  }, [song.duration])

  return (
    <div className="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-accent/60 transition-all duration-200">
      <div
        onClick={() => onPlayNow(song)}
        className="relative h-10 w-10 rounded-lg overflow-hidden shrink-0 cursor-pointer shadow-sm"
      >
        <img
          src={song.image?.[1]?.link}
          alt={song.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Play className="h-4 w-4 text-white fill-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlayNow(song)}>
        <p className="font-medium truncate text-sm group-hover:text-primary transition-colors">{song.name}</p>
        <p className="text-xs text-muted-foreground/80 truncate mt-0.5">{artistName}</p>
      </div>

      {duration && (
        <span className="text-[11px] text-muted-foreground/60 tabular-nums font-mono">{duration}</span>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPlayNext(song)}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
          title="Play next"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAddToQueue(song)}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
          title="Add to queue"
        >
          <ListPlus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
})

const PlaylistDetail = memo(({ playlistId, playlistName, onBack, onPlayNow, onPlayNext, onAddToQueue, onAddAll }) => {
  const { data: playlist, isLoading } = usePlaylistDetailsQuery(playlistId)

  const songs = useMemo(() => {
    if (!playlist?.songs) return []
    return playlist.songs
      .map((item) => item.songData || item)
      .filter((s) => s?.id)
  }, [playlist])

  const handleAddAll = useCallback(() => {
    if (songs.length > 0) onAddAll(songs)
  }, [songs, onAddAll])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-52 gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">Loading songs...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 rounded-lg cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{playlistName}</p>
          <p className="text-xs text-muted-foreground/60">{songs.length} songs</p>
        </div>
        {songs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddAll}
            className="gap-1.5 h-8 rounded-lg text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <ListPlus className="h-3.5 w-3.5" />
            Add All
          </Button>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-52 gap-3">
          <div className="p-4 rounded-2xl bg-accent/40">
            <Music className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground text-sm">This playlist is empty</p>
        </div>
      ) : (
        <div className="py-2 space-y-0.5 px-1">
          {songs.map((song) => (
            <PlaylistSongItem
              key={song.id}
              song={song}
              onPlayNow={onPlayNow}
              onPlayNext={onPlayNext}
              onAddToQueue={onAddToQueue}
            />
          ))}
        </div>
      )}
    </div>
  )
})

const PlaylistBrowser = memo(({ onPlayNow, onPlayNext, onAddToQueue, onAddAll }) => {
  const { data: playlists = [], isLoading } = useUserPlaylistsQuery()
  const [selectedPlaylist, setSelectedPlaylist] = useState(null)

  const handleSelectPlaylist = useCallback((playlist) => {
    setSelectedPlaylist({ id: playlist.id, name: playlist.name })
  }, [])

  const handleBack = useCallback(() => setSelectedPlaylist(null), [])

  return (
    <motion.div
      key="playlists"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence mode="wait">
        {selectedPlaylist ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            <PlaylistDetail
              playlistId={selectedPlaylist.id}
              playlistName={selectedPlaylist.name}
              onBack={handleBack}
              onPlayNow={onPlayNow}
              onPlayNext={onPlayNext}
              onAddToQueue={onAddToQueue}
              onAddAll={onAddAll}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <Loader2 className="h-8 w-8 animate-spin text-primary relative" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">Loading playlists...</p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 gap-3">
                <div className="p-4 rounded-2xl bg-accent/40">
                  <Music className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-sm font-medium">No playlists yet</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Create playlists from your music library</p>
                </div>
              </div>
            ) : (
              <div className="py-2 px-2 space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-2 mb-2">
                  Your Playlists ({playlists.length})
                </p>
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => handleSelectPlaylist(playlist)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer",
                      "hover:bg-accent/60 active:bg-accent/80 transition-all duration-200 group",
                    )}
                  >
                    <Avatar className="h-11 w-11 rounded-lg shrink-0 shadow-sm">
                      <AvatarImage src={playlist.image?.[1]?.link || playlist.image?.[0]?.link || playlist.image} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 rounded-lg">
                        <Music className="h-5 w-5 text-primary/60" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {playlist.name}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {playlist.songCount || 0} songs
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})

export default PlaylistBrowser
