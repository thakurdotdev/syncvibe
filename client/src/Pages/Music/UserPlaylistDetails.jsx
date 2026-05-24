import { Context } from "@/Context/Context"
import { usePlayerStore } from "@/stores/playerStore"
import { CalendarDays, ListMusic, Play, Shuffle, Trash2, ArrowLeft } from "lucide-react"
import { useContext, useEffect, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { SongCard } from "./Cards"
import { LoadingState } from "./Common"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePlaylistDetailsQuery } from "@/hooks/queries/usePlaylistQueries"
import { useRemoveSongFromPlaylistMutation } from "@/hooks/mutations/usePlaylistMutations"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion } from "framer-motion"

const PlaylistHeader = ({ playlistData }) => {
  const bgUrl = Array.isArray(playlistData?.image) ? playlistData?.image[2]?.link : ""

  return (
    <div className="relative w-full h-[220px] md:h-[260px] rounded-2xl overflow-hidden shadow-lg group">
      <div
        className="absolute inset-0 bg-center bg-cover transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url('${bgUrl}')` }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent">
        <div className="h-full w-full p-4 md:p-8 flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="relative w-[140px] h-[140px] md:w-[180px] md:h-[180px] shrink-0 mx-auto md:mx-0 shadow-xl rounded-xl overflow-hidden">
            <Avatar className="w-full h-full rounded-none">
              <AvatarImage
                src={bgUrl}
                alt={playlistData?.name}
                className="object-cover"
                loading="lazy"
              />
              <AvatarFallback className="w-full h-full rounded-none bg-accent">
                <ListMusic className="w-12 h-12 text-primary/40" />
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex flex-col gap-2 flex-1 text-center md:text-left">
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight line-clamp-1">
              {playlistData?.name}
            </h1>

            {playlistData?.description && (
              <p className="text-xs md:text-sm text-muted-foreground font-medium line-clamp-2 max-w-xl">
                {playlistData?.description}
              </p>
            )}

            <div className="flex items-center justify-center md:justify-start gap-4 text-[11px] md:text-xs font-semibold text-muted-foreground/80">
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                <span>{new Date(playlistData?.createdat).getFullYear()}</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{playlistData?.songs?.length || 0} tracks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const UserPlaylistDetails = () => {
  const navigate = useNavigate()
  const params = useParams()
  const { user } = useContext(Context)
  const id = params?.id || null

  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const playSong = usePlayerStore((s) => s.playSong)

  const { data: playlistData, isLoading } = usePlaylistDetailsQuery(id)

  const removeMutation = useRemoveSongFromPlaylistMutation({
    onSuccess: () => {
      toast.success("Removed from playlist")
    },
    onError: (err) => {
      toast.error(err.message || "Failed to remove song")
    },
  })

  useEffect(() => {
    if (!user || !playlistData || !id) return
    if (user?.userid !== playlistData?.userId) {
      navigate("/music/my-playlist")
    }
  }, [user, playlistData, navigate, id])

  const handlePlayAll = () => {
    if (playlistData?.songs?.length) {
      setPlaylist(playlistData.songs.map((s) => s.songData))
      playSong(playlistData.songs[0].songData)
    }
  }

  const handleShuffle = () => {
    if (playlistData?.songs?.length) {
      const shuffledSongs = [...playlistData.songs]
        .map((s) => s.songData)
        .sort(() => Math.random() - 0.5)
      setPlaylist(shuffledSongs)
      playSong(shuffledSongs[0])
    }
  }

  const handleRemoveSong = useCallback(
    (songId) => {
      removeMutation.mutate({ playlistId: id, songId })
    },
    [id, removeMutation],
  )

  if (isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full h-8 w-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold text-muted-foreground">Back to Playlists</h2>
      </div>

      <PlaylistHeader playlistData={playlistData} />

      <div className="flex items-center gap-3">
        <Button
          onClick={handlePlayAll}
          disabled={!playlistData?.songs?.length}
          size="sm"
          className="rounded-lg h-9 px-6 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer shadow-sm active:scale-95 transition-all"
        >
          <Play className="w-4 h-4 fill-current" />
          Play All
        </Button>

        <Button
          variant="outline"
          onClick={handleShuffle}
          disabled={!playlistData?.songs?.length}
          size="sm"
          className="rounded-lg h-9 px-6 gap-2 border-border/50 hover:bg-accent font-semibold cursor-pointer active:scale-95 transition-all"
        >
          <Shuffle className="w-4 h-4" />
          Shuffle
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/10 pb-3">
          <h3 className="text-lg font-bold tracking-tight">Tracks</h3>
          <span className="text-xs font-medium text-muted-foreground">
            {playlistData?.songs?.length || 0} songs
          </span>
        </div>

        {playlistData?.songs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-accent/10 rounded-3xl border border-dashed border-border/50">
            <div className="p-5 rounded-full bg-accent/20 mb-4">
              <ListMusic className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No songs in this playlist yet</p>
            <Button variant="link" onClick={() => navigate("/music/search")} className="mt-2">
              Find some music
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {playlistData.songs.map((song, index) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <SongCard song={song.songData} onRemoveFromPlaylist={handleRemoveSong} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default UserPlaylistDetails
