/**
 * Sound Effects Audio Manager
 * Manages preview audio and room sound effect playback independently from the main music stream.
 */

let previewAudio = null
let previewUrl = null
let currentOnEnd = null

const SFX_VOLUME = 0.75

export const soundEffectsManager = {
  /**
   * Play a sound effect for previewing
   * @param {string} url
   * @param {() => void} [onEnd]
   * @param {(err: any) => void} [onError]
   * @returns {HTMLAudioElement}
   */
  playPreview: (url, onEnd, onError) => {
    if (previewAudio) {
      previewAudio.pause()
      previewAudio.src = ""
      if (currentOnEnd) {
        currentOnEnd()
      }
      previewAudio = null
      previewUrl = null
    }

    const audio = new Audio(url)
    audio.volume = SFX_VOLUME
    audio.preload = "auto"
    previewAudio = audio
    previewUrl = url
    currentOnEnd = onEnd

    const cleanup = () => {
      if (previewAudio === audio) {
        previewAudio = null
        previewUrl = null
        currentOnEnd = null
      }
      onEnd?.()
    }

    audio.onended = cleanup
    audio.onerror = (e) => {
      cleanup()
      onError?.(e)
    }

    audio.play().catch((err) => {
      cleanup()
      onError?.(err)
    })

    return audio
  },

  /**
   * Stop the active preview
   */
  stopPreview: () => {
    if (previewAudio) {
      previewAudio.pause()
      previewAudio.src = ""
      previewAudio = null
      previewUrl = null
      if (currentOnEnd) {
        const cb = currentOnEnd
        currentOnEnd = null
        cb()
      }
    }
  },

  /**
   * Check if a specific URL is currently being previewed
   * @param {string} url
   * @returns {boolean}
   */
  isPlayingPreview: (url) => {
    return !!(previewAudio && previewUrl === url && !previewAudio.paused)
  },

  /**
   * Play a live room sound effect triggered by group members
   * @param {string} url
   * @returns {Promise<void>}
   */
  playRoomEffect: async (url) => {
    if (!url) return
    try {
      const roomAudio = new Audio(url)
      roomAudio.volume = SFX_VOLUME
      await roomAudio.play()
      roomAudio.onended = () => {
        roomAudio.src = ""
      }
    } catch (err) {
      // Autoplay might be restricted by browser before user interaction
      console.warn("Auto-play sound effect restricted or failed:", err)
    }
  },
}
