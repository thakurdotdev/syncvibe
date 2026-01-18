import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { usePlayerStore } from "@/stores/playerStore"
import { ArrowLeft } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { AlbumCard, ArtistCard, PlaylistCard, SongCard } from "./Cards"
import { LoadingState, PlaylistActions } from "./Common"
import { useArtistQuery } from "@/hooks/queries/useSongQueries"

const Artist = () => {
  const navigate = useNavigate()
  const params = useParams()
  const id = params?.id || null

  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const playSong = usePlayerStore((s) => s.playSong)

  const { data: artistData, isLoading } = useArtistQuery(id)

  if (isLoading) return <LoadingState />
  if (!artistData) return null

  const handlePlayAll = () => {
    if (artistData?.top_songs?.length) {
      setPlaylist(artistData.top_songs)
      playSong(artistData.top_songs[0])
    }
  }

  const handleShuffle = () => {
    if (artistData?.top_songs?.length) {
      const shuffledSongs = [...artistData.top_songs].sort(() => Math.random() - 0.5)
      setPlaylist(shuffledSongs)
      playSong(shuffledSongs[0])
    }
  }

  const bgUrl = Array.isArray(artistData.image) ? artistData.image[2]?.link : artistData.image

  return (
    <div className="flex flex-col gap-10 p-5">
      <div
        className="w-full h-[250px] sm:h-[300px] rounded-2xl"
        style={{
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: "cover",
        }}
      >
        <div className="rounded-2xl w-full h-full bg-black/60 backdrop-blur-sm flex flex-col transition-all relative">
          <div className="absolute top-3 right-3">
            <Button onClick={() => navigate(-1)} variant="ghost">
              <ArrowLeft className="w-5 h-5" />
              Back
            </Button>
          </div>
          <div className="flex flex-col p-3">
            <div className="flex items-center p-3 gap-6">
              <div className="w-[150px] h-[150px] sm:w-[200px] sm:h-[200px] rounded-lg overflow-hidden">
                <img src={bgUrl} className="object-cover w-full h-full" />
              </div>
              <div className="h-[150px] sm:h-[200px] flex flex-col py-3">
                <h1 className="text-white text-3xl font-semibold hidden sm:block">
                  {artistData.name}
                </h1>
                <p className="text-base text-white/70 font-medium mt-1">{artistData.header_desc}</p>
                <div className="mt-5 flex flex-col">
                  <p className="text-sm text-white/80">{artistData.list_count} songs</p>
                  <p className="text-sm text-white/80">
                    {formatCount(artistData.follower_count)} followers
                  </p>
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-white text-xl font-semibold ml-5 sm:hidden line-clamp-1">
            {artistData.name}
          </h1>
        </div>
      </div>
      <PlaylistActions
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        disabled={!artistData?.top_songs?.length}
      />

      <h2 className="text-2xl font-semibold mt-6">Top Songs</h2>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        {artistData.top_songs.map((song, index) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>

      <h2 className="text-2xl font-semibold mt-6">Top Albums</h2>
      <ScrollArea>
        <div className="flex gap-1 overflow-x-auto mb-3">
          {artistData.top_albums.map((album, index) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <h2 className="text-2xl font-semibold mt-6">Dedicated Playlist</h2>
      <ScrollArea>
        <div className="flex gap-1 overflow-x-auto mb-3">
          {artistData.dedicated_artist_playlist.map((playlist, index) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {artistData.similar_artists.length > 0 && (
        <>
          <h2 className="text-2xl font-semibold mt-6">Similar Artists</h2>
          <ScrollArea>
            <div className="flex gap-1 overflow-x-auto mb-3">
              {artistData.similar_artists.map((artist, index) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </>
      )}
    </div>
  )
}

function formatCount(count) {
  if (count === undefined || count === null) {
    return "N/A"
  }

  if (count >= 1000000000) {
    return (count / 1000000000).toFixed(1) + "B"
  } else if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + "M"
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + "K"
  } else {
    return count.toString()
  }
}

export default Artist
