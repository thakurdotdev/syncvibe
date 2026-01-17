import { usePlayerStore } from "@/stores/playerStore"
import axios from "axios"
import { useCallback, useEffect, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import { SongCard } from "./Cards"
import { LoadingState, PlaylistActions } from "./Common"

const Playlist = () => {
  const location = useLocation()
  const params = useParams()
  const id = location.state || params?.id || null
  const [playlistData, setPlaylistData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Individual selectors
  const setPlaylist = usePlayerStore((s) => s.setPlaylist)
  const playSong = usePlayerStore((s) => s.playSong)

  const fetchPlaylistData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${import.meta.env.VITE_SONG_URL}/playlist?id=${id}`)
      const data = response.data
      setPlaylistData(data.data)
      setLoading(false)
    } catch (error) {
      setLoading(false)
      console.error("Error fetching playlist data:", error)
    }
  }, [id])

  useEffect(() => {
    if (id) {
      fetchPlaylistData()
    }
  }, [id, fetchPlaylistData])

  if (loading) return <LoadingState />

  const handlePlayAll = () => {
    if (playlistData?.songs?.length) {
      setPlaylist(
        playlistData.songs.map((song) => {
          return {
            ...song,
            isPlaylist: true,
            playlistId: playlistData.id,
          }
        }),
      )
      playSong(playlistData.songs[0])
    }
  }

  const handleShuffle = () => {
    if (playlistData?.songs?.length) {
      const shuffledSongs = [...playlistData.songs].sort(() => Math.random() - 0.5)
      setPlaylist(
        shuffledSongs.map((song) => ({
          ...song,
          isPlaylist: true,
          playlistId: playlistData.id,
        })),
      )
      playSong(shuffledSongs[0])
    }
  }

  const bgUrl = playlistData?.image

  return (
    <div className="flex flex-col gap-10 p-5">
      {/** Playlist Info */}
      <div
        className="w-full h-[250px] sm:h-[300px] rounded-2xl"
        style={{
          backgroundImage: `url('${bgUrl}')`,
          backgroundSize: "cover",
        }}
      >
        <div className="rounded-2xl w-full h-full bg-black/60 backdrop-blur-sm flex flex-col transition-all">
          <div className="flex flex-col p-3">
            <div className="flex items-center p-3 gap-6">
              <div className="w-[150px] h-[150px] sm:w-[200px] sm:h-[200px] rounded-lg overflow-hidden">
                <img src={bgUrl} className="object-cover w-full h-full" />
              </div>
              <div className="h-[150px] sm:h-[200px] flex flex-col py-3">
                <h1 className="text-white text-3xl font-semibold hidden sm:block">
                  {playlistData.name}
                </h1>
                <p className="text-base text-white/70 font-medium mt-1">
                  {playlistData.header_desc}
                </p>
                <div className="mt-5 flex flex-col">
                  <p className="text-sm text-white/80">{playlistData.list_count} songs</p>
                  <p className="text-sm text-white/80">
                    {formatCount(playlistData.follower_count)} followers
                  </p>
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-white text-xl font-semibold ml-5 sm:hidden line-clamp-1">
            {playlistData.name}
          </h1>
        </div>
      </div>
      <PlaylistActions
        onPlayAll={handlePlayAll}
        onShuffle={handleShuffle}
        disabled={!playlistData?.songs?.length}
      />

      {/** Playlist Songs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {playlistData.songs.map((song, index) => (
          <SongCard key={song.id} song={song} />
        ))}
      </div>
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

export default Playlist
