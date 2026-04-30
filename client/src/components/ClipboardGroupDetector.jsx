import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Users } from "lucide-react"
import { useGroupMusic } from "@/Context/GroupMusicContext"

const ClipboardGroupDetector = () => {
  const { currentGroup, joinGroup } = useGroupMusic()
  const navigate = useNavigate()
  const toastId = useRef(null)
  const hasChecked = useRef(false)

  useEffect(() => {
    if (currentGroup && toastId.current) {
      toast.dismiss(toastId.current)
      toastId.current = null
    }
  }, [currentGroup])

  useEffect(() => {
    if (hasChecked.current || currentGroup) return
    hasChecked.current = true

    const checkClipboard = async () => {
      try {
        if (!navigator.clipboard?.readText) return

        const text = await navigator.clipboard.readText()
        const trimmed = text?.trim()
        if (!trimmed || !/^syncvibe_\d{4,}$/.test(trimmed)) return

        toastId.current = toast(
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Group invite detected</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{trimmed}</p>
            </div>
          </div>,
          {
            duration: Infinity,
            action: {
              label: "Join",
              onClick: () => {
                joinGroup(trimmed)
                navigate("/music/sync")
              },
            },
          },
        )
      } catch { }
    }

    const timer = setTimeout(checkClipboard, 1000)
    return () => clearTimeout(timer)
  }, [currentGroup, joinGroup, navigate])

  return null
}

export default ClipboardGroupDetector
