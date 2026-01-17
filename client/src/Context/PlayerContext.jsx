import { useContext, useEffect, useRef } from "react"
import { Context } from "./Context"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * PlayerProvider - Minimal provider that only:
 * 1. Manages audio element refs
 * 2. Sets up audio event listeners
 * 3. Syncs audio with store state
 */
export function PlayerProvider({ children }) {
  const { user, loading } = useContext(Context)
  const audioRef = useRef(null)
  const nextAudioRef = useRef(null)
  const prevSongIdRef = useRef(null)
  const lastUpdateTime = useRef(0)

  // Get store actions (stable references)
  const setAudioRefs = usePlayerStore((s) => s.setAudioRefs)
  const loadAndPlayCurrentSong = usePlayerStore((s) => s.loadAndPlayCurrentSong)
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)
  const updateTime = usePlayerStore((s) => s.updateTime)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const getPlaylists = usePlayerStore((s) => s.getPlaylists)
  const decrementSongsRemaining = usePlayerStore((s) => s.decrementSongsRemaining)

  // Get state that triggers effects
  const currentSong = usePlayerStore((s) => s.currentSong)
  const volume = usePlayerStore((s) => s.volume)

  // Set audio refs on mount
  useEffect(() => {
    if (audioRef.current && nextAudioRef.current) {
      setAudioRefs(audioRef.current, nextAudioRef.current)
    }
  }, [setAudioRefs])

  // Audio event listeners
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

  // Load and play song when currentSong changes
  useEffect(() => {
    const loadSong = async () => {
      prevSongIdRef.current = await loadAndPlayCurrentSong(prevSongIdRef.current)
    }
    loadSong()
  }, [currentSong, loadAndPlayCurrentSong])

  // Decrement songs remaining on song change (for sleep timer)
  useEffect(() => {
    if (currentSong) {
      decrementSongsRemaining()
    }
  }, [currentSong?.id, decrementSongsRemaining])

  // Fetch user playlists on login
  useEffect(() => {
    if (!user || loading) return
    getPlaylists()
  }, [user, loading, getPlaylists])

  return (
    <>
      {children}
      <audio ref={audioRef} preload="auto" />
      <audio ref={nextAudioRef} preload="auto" style={{ display: "none" }} />
    </>
  )
}
