import { usePlayerStore } from "@/stores/playerStore"
import { useParams } from "react-router-dom"
import { SongCard } from "./Cards"
import { ensureHttpsForDownloadUrls, LoadingState, PlaylistActions } from "./Common"
import { useAlbumQuery } from "@/hooks/queries/useSongQueries"

const Album = () => {
  const params = useParams()
  const id = params?.id || null

  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const playSong = usePlayerStore((s) => s.playSong)

  const { data: albumData, isLoading } = useAlbumQuery(id)

  if (isLoading) return <LoadingState />
  if (!albumData) return null

  const handlePlayAll = () => {
    if (albumData?.songs?.length) {
      setPlaylist(albumData.songs)
      const updatedSong = ensureHttpsForDownloadUrls(albumData.songs[0])
      playSong(updatedSong)
    }
  }

  const handleShuffle = () => {
    if (albumData?.songs?.length) {
      const shuffledSongs = [...albumData.songs].sort(() => Math.random() - 0.5)
      setPlaylist(shuffledSongs)
      const updatedSong = ensureHttpsForDownloadUrls(shuffledSongs[0])
      playSong(updatedSong)
    }
  }

  const bgUrl = albumData.image[2]?.link
  const artistName = albumData?.artist_map?.artists
    ?.slice(0, 2)
    ?.map((artist) => artist.name)
    .join(", ")

  return (
    <div className="flex flex-col gap-10 p-5">
      <div
        className={`w-full h-[250px] rounded-2xl bg-cover`}
        style={{
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: "cover",
        }}
      >
        <div className="rounded-2xl w-full h-full bg-black/60 backdrop-blur-sm flex items-center p-3 gap-6">
          <div className="w-[200px] h-[200px]">
            <img src={bgUrl} className="rounded-lg" />
          </div>
          <div className="h-[200px] flex flex-col py-3">
            <h1 className="text-white text-3xl font-semibold">{albumData.name}</h1>
            <p className="text-base text-white/70 font-medium mt-1">:- {artistName}</p>
            <div className="mt-5 flex flex-col">
              <p className="text-sm text-white/80">{albumData.year}</p>
              <p className="text-sm text-white/80">{albumData?.songcount} songs</p>
            </div>
          </div>
        </div>
      </div>
      <PlaylistActions
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        disabled={!albumData?.songs?.length}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        {albumData.songs.map((song, index) => (
          <div key={index}>
            <SongCard song={song} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Album
