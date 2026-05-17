import { Check, Copy, LogOut, Music, QrCode, RefreshCw, Search, UserPlus } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const GroupHeader = ({
  currentGroup,
  isRejoining,
  onSearchOpen,
  onQRCodeOpen,
  onLeaveGroup,
  onQueueOpen,
  onInviteOpen,
  queueCount = 0,
}) => {
  const [copied, setCopied] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const shortId = useMemo(
    () => currentGroup?.id?.replace("syncvibe_", "") || "",
    [currentGroup?.id],
  )

  const handleCopy = useCallback(async () => {
    if (!currentGroup?.id) return
    try {
      await navigator.clipboard.writeText(currentGroup.id)
      setCopied(true)
      toast.success("Copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error("Failed to copy")
    }
  }, [currentGroup?.id])

  if (!currentGroup) {
    return (
      <div className="flex items-center gap-2.5 pb-1">
        <div className="liquid-badge p-1.5 rounded-xl">
          <Music className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <h1 className="text-base font-semibold">Group Session</h1>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="liquid-badge p-2 rounded-xl shrink-0">
            <Music className="h-5 w-5 text-primary" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate tracking-tight">
                {currentGroup.name}
              </h1>
              {isRejoining && (
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/50 animate-spin shrink-0" />
              )}
            </div>
          </div>

          <div className="items-center gap-1 px-2.5 py-1.5 rounded-xl liquid-badge shrink-0 hidden md:flex">
            <span className="text-xs font-mono text-muted-foreground">{shortId}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition-all duration-200 cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onQRCodeOpen}
              className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-accent/50 transition-all duration-200 cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onQueueOpen}
                  className="liquid-btn h-9 rounded-xl gap-2 px-3 flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-xs font-medium hidden sm:inline">Queue</span>
                  {queueCount > 0 && (
                    <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {queueCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Queue & Search</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onInviteOpen}
                  className="liquid-btn h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Invite</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowLeaveDialog(true)}
                  className="liquid-btn h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:border-rose-500/20 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Leave Group</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{currentGroup?.name}"? You'll stop listening with the
              group and your session will end.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowLeaveDialog(false); onLeaveGroup() }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default memo(GroupHeader)
