import { useCallback, useEffect, useRef, useState } from "react"
import { parseVoiceIntent } from "@/lib/voiceIntentParser"

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export const useVoiceControl = ({ onCommand, timeout = 5000 } = {}) => {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState(null)
  const [lastIntent, setLastIntent] = useState(null)

  const recognitionRef = useRef(null)
  const timeoutRef = useRef(null)
  const onCommandRef = useRef(onCommand)
  const isListeningRef = useRef(false)

  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    isListeningRef.current = isListening
  }, [isListening])

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition()
    setIsSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsListening(true)
        setError(null)
        setTranscript("")
      }

      recognition.onresult = (event) => {
        const current = event.resultIndex
        const result = event.results[current]
        const transcriptText = result[0].transcript

        setTranscript(transcriptText)

        if (result.isFinal) {
          const intent = parseVoiceIntent(transcriptText)
          setLastIntent(intent)
          onCommandRef.current?.(intent)
        }
      }

      recognition.onerror = (event) => {
        if (event.error === "aborted") return
        const errorMessages = {
          "no-speech": "No speech detected",
          "audio-capture": "Microphone not available",
          "not-allowed": "Microphone access denied",
          network: "Network error",
        }
        setError(errorMessages[event.error] || "An error occurred")
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return

    setError(null)
    setTranscript("")
    setLastIntent(null)

    try {
      recognitionRef.current.start()
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current && isListeningRef.current) {
          recognitionRef.current.stop()
          setError("Listening timed out")
        }
      }, timeout)
    } catch (err) {
      if (err.name !== "InvalidStateError") {
        setError("Failed to start listening")
      }
    }
  }, [timeout])

  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }
  }, [])

  const reset = useCallback(() => {
    setTranscript("")
    setError(null)
    setLastIntent(null)
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    error,
    lastIntent,
    startListening,
    stopListening,
    reset,
  }
}
