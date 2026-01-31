import { usePlayerStore } from "@/stores/playerStore"

export const useVoiceCommandExecutor = () => {
  const handlePlayPause = usePlayerStore((s) => s.handlePlayPause)
  const handleNextSong = usePlayerStore((s) => s.handleNextSong)
  const handlePrevSong = usePlayerStore((s) => s.handlePrevSong)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat)
  const clearQueue = usePlayerStore((s) => s.clearQueue)
  const adjustVolume = usePlayerStore((s) => s.adjustVolume)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  const executeCommand = (intent) => {
    if (!intent || intent.action === "unknown") {
      return { success: false, message: "Command not recognized" }
    }

    const actions = {
      play: () => {
        if (!isPlaying) handlePlayPause()
        return { success: true, message: "Playing" }
      },
      pause: () => {
        if (isPlaying) handlePlayPause()
        return { success: true, message: "Paused" }
      },
      next: () => {
        handleNextSong()
        return { success: true, message: "Playing next song" }
      },
      previous: () => {
        handlePrevSong()
        return { success: true, message: "Playing previous song" }
      },
      shuffle: () => {
        toggleShuffle()
        return { success: true, message: "Shuffle toggled" }
      },
      repeat: () => {
        toggleRepeat()
        return { success: true, message: "Repeat toggled" }
      },
      clearQueue: () => {
        clearQueue()
        return { success: true, message: "Queue cleared" }
      },
      volumeUp: () => {
        adjustVolume(0.1)
        return { success: true, message: "Volume increased" }
      },
      volumeDown: () => {
        adjustVolume(-0.1)
        return { success: true, message: "Volume decreased" }
      },
      mute: () => {
        adjustVolume(-1)
        return { success: true, message: "Muted" }
      },
    }

    const action = actions[intent.action]
    if (action) {
      return action()
    }

    return { success: false, message: "Unknown command" }
  }

  return { executeCommand }
}
