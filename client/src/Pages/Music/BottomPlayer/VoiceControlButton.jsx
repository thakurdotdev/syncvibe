import { AnimatePresence, motion } from "framer-motion"
import { Mic, MicOff, X } from "lucide-react"
import { memo, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useVoiceControl } from "@/hooks/useVoiceControl"
import { useVoiceCommandExecutor } from "@/hooks/useVoiceCommandExecutor"

const PulsingRing = memo(() => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <motion.div
      className="absolute w-full h-full rounded-full border-2 border-primary"
      initial={{ scale: 1, opacity: 0.8 }}
      animate={{ scale: 1.5, opacity: 0 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
    />
    <motion.div
      className="absolute w-full h-full rounded-full border-2 border-primary"
      initial={{ scale: 1, opacity: 0.6 }}
      animate={{ scale: 1.3, opacity: 0 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
    />
  </div>
))

const AudioWave = memo(() => (
  <div className="flex items-center gap-0.5 h-4">
    {[0, 0.1, 0.2, 0.3, 0.2].map((delay, i) => (
      <motion.div
        key={i}
        className="w-0.5 bg-primary rounded-full"
        animate={{ height: ["8px", "16px", "8px"] }}
        transition={{ duration: 0.6, repeat: Infinity, delay }}
      />
    ))}
  </div>
))

const VoiceControlButton = memo(({ className }) => {
  const { executeCommand } = useVoiceCommandExecutor()

  const handleCommand = useCallback(
    (intent) => {
      if (!intent) return

      const result = executeCommand(intent)

      if (result.success) {
        toast.success(result.message, { duration: 2000 })
      } else {
        toast.error(result.message || "Command not recognized", { duration: 2000 })
      }
    },
    [executeCommand],
  )

  const { isListening, isSupported, transcript, error, startListening, stopListening } =
    useVoiceControl({ onCommand: handleCommand })

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  if (!isSupported) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 opacity-50 cursor-not-allowed">
              <MicOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Voice control not supported in this browser
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("relative", className)}>
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-md border border-border rounded-lg px-3 py-2 shadow-lg min-w-[160px]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <AudioWave />
                <span className="text-xs font-medium text-primary">Listening...</span>
              </div>
              {transcript && (
                <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                  "{transcript}"
                </p>
              )}
              {error && <p className="text-xs text-destructive">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              {isListening && <PulsingRing />}
              <Button
                variant={isListening ? "default" : "ghost"}
                size="icon"
                onClick={handleClick}
                className={cn(
                  "h-9 w-9 relative z-10 transition-colors",
                  isListening && "bg-primary text-primary-foreground",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isListening ? "listening" : "idle"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isListening ? <X className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isListening ? "Stop listening" : "Voice control"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
})

PulsingRing.displayName = "PulsingRing"
AudioWave.displayName = "AudioWave"
VoiceControlButton.displayName = "VoiceControlButton"
export default VoiceControlButton
