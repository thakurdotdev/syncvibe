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
import { Button } from "@/components/ui/button"
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
        <div className="p-1.5 rounded-lg bg-accent/50">
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
          <div className="p-2 rounded-xl bg-primary/10 shrink-0">
            <Music className="h-5 w-5 text-primary" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">
                {currentGroup.name}
              </h1>
              {isRejoining && (
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/50 animate-spin shrink-0" />
              )}
            </div>
          </div>

          <div className="items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/50 border border-border/30 shrink-0 hidden md:flex">
            <span className="text-xs font-mono text-muted-foreground">{shortId}</span>
            <button
              onClick={handleCopy}
              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent/80 transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onQRCodeOpen}
              className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent/80 transition-colors cursor-pointer"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onQueueOpen}
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg gap-2 px-3 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-xs">Queue</span>
                  {queueCount > 0 && (
                    <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {queueCount}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Queue & Search</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onInviteOpen}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Invite</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowLeaveDialog(true)}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
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
