import { useAudioStore } from "@/zustand/useAudioStore"
import { useEffect, useRef } from "react"

const AudioPlayer = () => {
  const audioRef = useRef(null)
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    currentSong,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    handleNextSong,
  } = useAudioStore()

  console.log("AudioPlayer")

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration)
    const handleVolumeChange = () => setVolume(audio.volume)
    const handleEnded = () => handleNextSong()

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("volumechange", handleVolumeChange)
    audio.addEventListener("ended", handleEnded)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("volumechange", handleVolumeChange)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [setCurrentTime, setDuration, setVolume, handleNextSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentSong) return

    audio.src = currentSong.download_url?.[4]?.link || currentSong.download_url?.[3]?.link || ""
    audio.currentTime = 0

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("Playback error:", err)
        setIsPlaying(false)
      })
    } else {
      audio.pause()
    }
  }, [currentSong, isPlaying, setIsPlaying])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volume
    }
  }, [volume])

  return <audio ref={audioRef} />
}

export default AudioPlayer
