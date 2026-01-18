import { useContext, useEffect, useRef } from "react"
import { Context } from "./Context"
import { usePlayerStore } from "@/stores/playerStore"
import { useUserPlaylistsQuery } from "@/hooks/queries/usePlaylistQueries"

export function PlayerProvider({ children }) {
  const { user, loading } = useContext(Context)
  const audioRef = useRef(null)
  const nextAudioRef = useRef(null)
  const prevSongIdRef = useRef(null)
  const lastUpdateTime = useRef(0)

  const setAudioRefs = usePlayerStore((s) => s.setAudioRefs)
  const loadAndPlayCurrentSong = usePlayerStore((s) => s.loadAndPlayCurrentSong)
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)
  const updateTime = usePlayerStore((s) => s.updateTime)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setUserPlaylist = usePlayerStore((s) => s.setUserPlaylist)
  const decrementSongsRemaining = usePlayerStore((s) => s.decrementSongsRemaining)

  const currentSong = usePlayerStore((s) => s.currentSong)
  const volume = usePlayerStore((s) => s.volume)

  const { data: userPlaylists } = useUserPlaylistsQuery({
    enabled: !!user && !loading,
  })

  useEffect(() => {
    if (userPlaylists) {
      setUserPlaylist(userPlaylists)
    }
  }, [userPlaylists, setUserPlaylist])

  useEffect(() => {
    if (audioRef.current && nextAudioRef.current) {
      setAudioRefs(audioRef.current, nextAudioRef.current)
    }
  }, [setAudioRefs])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      const now = Date.now()
      if (now - lastUpdateTime.current > 1000) {
        updateTime(audio.currentTime)
        lastUpdateTime.current = now
      }
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      audio.volume = volume
    }

    const handleEnded = () => {
      handleNextSong()
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [handleNextSong, volume, updateTime, setDuration])

  useEffect(() => {
    const loadSong = async () => {
      prevSongIdRef.current = await loadAndPlayCurrentSong(prevSongIdRef.current)
    }
    loadSong()
  }, [currentSong, loadAndPlayCurrentSong])

  useEffect(() => {
    if (currentSong) {
      decrementSongsRemaining()
    }
  }, [currentSong?.id, decrementSongsRemaining])

  return (
    <>
      {children}
      <audio ref={audioRef} preload="auto" />
      <audio ref={nextAudioRef} preload="auto" style={{ display: "none" }} />
    </>
  )
}
