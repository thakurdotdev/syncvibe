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
import { Check, Copy, ListMusic, LogOut, Music, QrCode, RefreshCw, Search } from "lucide-react"
import { memo, useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

// Memoized Title Section - More compact on mobile
const TitleSection = memo(({ currentGroup, isRejoining }) => (
  <div className="flex items-center gap-2">
    <div className="p-1.5 rounded-lg bg-primary/10">
      <Music className="h-5 w-5 text-primary" />
    </div>
    <div className="min-w-0">
      <h1 className="text-base md:text-xl font-bold truncate">
        {currentGroup?.name || "Group Session"}
      </h1>
      {isRejoining && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Reconnecting...</span>
        </div>
      )}
    </div>
  </div>
))

// Memoized Group ID with actions
const GroupIdSection = memo(({ groupId, onCopy, onQRCodeOpen, copied }) => {
  const shortId = useMemo(() => groupId?.replace("syncvibe_", "") || "", [groupId])

  return (
    <div className="flex items-center justify-center gap-1 px-2 py-1 h-8 rounded-full bg-accent/50 border border-border/50 w-full sm:w-auto">
      <span className="text-xs font-mono font-medium">{shortId}</span>
      <Button onClick={onCopy} variant="ghost" size="icon" className="h-6 w-6">
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      </Button>
      <Button onClick={onQRCodeOpen} variant="ghost" size="icon" className="h-6 w-6">
        <QrCode className="h-3 w-3" />
      </Button>
    </div>
  )
})

// Main GroupHeader Component
const GroupHeader = ({
  currentGroup,
  isRejoining,
  onSearchOpen,
  onQRCodeOpen,
  onLeaveGroup,
  onQueueOpen,
  queueCount = 0,
}) => {
  const [copied, setCopied] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

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

  const handleLeaveClick = useCallback(() => {
    setShowLeaveDialog(true)
  }, [])

  const handleLeaveConfirm = useCallback(() => {
    setShowLeaveDialog(false)
    onLeaveGroup()
  }, [onLeaveGroup])

  const handleLeaveCancel = useCallback(() => {
    setShowLeaveDialog(false)
  }, [])

  if (!currentGroup) {
    return (
      <div className="flex items-center gap-2 pb-2">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Music className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-lg font-bold">Group Session</h1>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2 pb-2">
        {/* Row 1: Title + Leave Button */}
        <div className="flex items-center justify-between">
          <TitleSection currentGroup={currentGroup} isRejoining={isRejoining} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleLeaveClick}
                  variant="destructive"
                  size="icon"
                  className="rounded-full h-8 w-8 shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave Group</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Row 2: Action Buttons - Full width grid on mobile */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
          {/* Search Button */}
          <Button
            onClick={onSearchOpen}
            variant="outline"
            size="sm"
            className="rounded-full h-8 gap-1.5 w-full sm:w-auto justify-center"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </Button>

          {/* Queue Button */}
          <Button
            onClick={onQueueOpen}
            variant="outline"
            size="sm"
            className="rounded-full h-8 gap-1.5 w-full sm:w-auto justify-center"
          >
            <ListMusic className="h-3.5 w-3.5" />
            <span>Queue</span>
            {queueCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs ml-0.5">
                {queueCount}
              </Badge>
            )}
          </Button>

          {/* Group ID Section */}
          <GroupIdSection
            groupId={currentGroup.id}
            onCopy={handleCopy}
            onQRCodeOpen={onQRCodeOpen}
            copied={copied}
          />
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
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
            <AlertDialogCancel onClick={handleLeaveCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveConfirm}
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
