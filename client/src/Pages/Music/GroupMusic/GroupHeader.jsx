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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, Copy, ListMusic, LogOut, Music, QrCode, RefreshCw, Search, UserPlus } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-accent/50 shrink-0">
            <Music className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold truncate">
                {currentGroup.name}
              </h1>
              {isRejoining && (
                <RefreshCw className="h-3 w-3 text-muted-foreground/50 animate-spin shrink-0" />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={onSearchOpen}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button
            onClick={onInviteOpen}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <UserPlus className="h-4 w-4" />
          </Button>

          <Button
            onClick={onQueueOpen}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground relative"
          >
            <ListMusic className="h-4 w-4" />
            {queueCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-medium flex items-center justify-center">
                {queueCount}
              </span>
            )}
          </Button>

          <div className="hidden sm:flex items-center gap-0.5 px-2 py-1 h-7 rounded-full bg-accent/40 border border-border/30">
            <span className="text-[11px] font-mono text-muted-foreground/60">{shortId}</span>
            <Button onClick={handleCopy} variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-foreground">
              {copied ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
            </Button>
            <Button onClick={onQRCodeOpen} variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/50 hover:text-foreground">
              <QrCode className="h-2.5 w-2.5" />
            </Button>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowLeaveDialog(true)}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowLeaveDialog(false); onLeaveGroup() }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
