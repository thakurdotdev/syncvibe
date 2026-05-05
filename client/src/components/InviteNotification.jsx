import { memo, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Check, Music2, X } from "lucide-react"

const INVITE_TIMEOUT = 60000

const InviteNotification = ({ invite, onAccept, onDecline }) => {
  const [timeLeft, setTimeLeft] = useState(INVITE_TIMEOUT / 1000)

  useEffect(() => {
    if (!invite) {
      setTimeLeft(INVITE_TIMEOUT / 1000)
      return
    }

    setTimeLeft(INVITE_TIMEOUT / 1000)
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onDecline(invite)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [invite, onDecline])

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)]"
        >
          <div className="relative rounded-2xl liquid-glass text-card-foreground overflow-hidden">
            {/* Animated Timer Bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-muted/30">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: INVITE_TIMEOUT / 1000, ease: "linear" }}
              />
            </div>

            <div className="p-5 pt-6">
              {/* Header section */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar className="h-12 w-12 border-2 border-border shadow-sm">
                      <AvatarImage src={invite.inviterPic} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                        {invite.inviterName?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <motion.span 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-card" 
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold tracking-tight text-foreground truncate">
                      {invite.inviterName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-primary/40" />
                      <p className="text-xs text-muted-foreground font-medium">Invited you to sync</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDecline(invite)}
                  className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 cursor-pointer active:scale-90"
                  type="button"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Session Info Card */}
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors group cursor-default">
                <div className="h-9 w-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  <Music2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-bold leading-tight">Syncing with</p>
                  <p className="text-sm font-semibold truncate text-foreground/90 mt-0.5">{invite.groupName}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-3">
                <Button
                  onClick={() => onDecline(invite)}
                  variant="ghost"
                  className="flex-1 h-10 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer active:scale-[0.98]"
                >
                  Ignore
                </Button>
                <Button
                  onClick={() => onAccept(invite)}
                  className="flex-1 h-10 text-sm font-bold gap-2 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 cursor-pointer active:scale-[0.98]"
                >
                  <Check className="h-4 w-4 stroke-[3px]" />
                  Join Session
                </Button>
              </div>

              {/* Footer Info */}
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="flex gap-0.5">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="h-1 w-1 rounded-full bg-primary"
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium italic">
                  Expires in <span className="text-foreground tabular-nums font-bold">{timeLeft}s</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default memo(InviteNotification)