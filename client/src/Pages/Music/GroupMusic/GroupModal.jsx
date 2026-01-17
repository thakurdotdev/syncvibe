import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { QrCode, Plus, Users, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import QRScanner from "./QRScanner"

const GroupModal = ({ isOpen, onClose, onCreateGroup, onJoinGroup }) => {
  const [newGroupName, setNewGroupName] = useState("")
  const [groupId, setGroupId] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)

  const handleCreate = async () => {
    if (!newGroupName.trim()) return
    setIsCreating(true)
    await onCreateGroup(newGroupName)
    setNewGroupName("")
    setIsCreating(false)
  }

  const handleJoin = async () => {
    if (!groupId.trim()) return
    setIsJoining(true)
    await onJoinGroup(groupId)
    setGroupId("")
    setIsJoining(false)
  }

  const handleQRScan = (scannedGroupId) => {
    setGroupId(scannedGroupId)
    onJoinGroup(scannedGroupId)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Group Session
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="join" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="join" className="rounded-full">
                Join Group
              </TabsTrigger>
              <TabsTrigger value="create" className="rounded-full">
                Create Group
              </TabsTrigger>
            </TabsList>

            <TabsContent value="join" className="space-y-4">
              {/* QR Scanner Option */}
              <div
                onClick={() => setIsScannerOpen(true)}
                className={cn(
                  "group relative p-6 rounded-xl cursor-pointer",
                  "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
                  "border border-primary/20 hover:border-primary/40",
                  "transition-all duration-300 hover:shadow-lg hover:shadow-primary/10",
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <QrCode className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Scan QR Code</h3>
                    <p className="text-sm text-muted-foreground">
                      Quick join by scanning a group QR code
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <span className="relative px-4 text-sm text-muted-foreground bg-background">
                  or enter group ID
                </span>
              </div>

              {/* Manual ID Entry */}
              <div className="space-y-3">
                <Input
                  placeholder="Enter group ID (e.g., syncvibe_123456)"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="rounded-full h-12 px-5"
                  onKeyPress={(e) => e.key === "Enter" && handleJoin()}
                />
                <Button
                  onClick={handleJoin}
                  disabled={!groupId.trim() || isJoining}
                  className="w-full rounded-full h-12 text-base font-medium"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Join Group
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-3 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Group Name</label>
                  <Input
                    placeholder="Enter a name for your group"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="rounded-full h-12 px-5"
                    onKeyPress={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={!newGroupName.trim() || isCreating}
                  className="w-full rounded-full h-12 text-base font-medium"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Group
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground pt-2">
                  A unique group ID and QR code will be generated for sharing
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <QRScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleQRScan}
      />
    </>
  )
}

export default GroupModal
