import React, { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { startRegistration } from "@simplewebauthn/browser"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Loader2,
  LockKeyhole,
  Trash2,
  PlusCircle,
  Shield,
  Smartphone,
  Key,
  Pencil,
  CloudOff,
  CloudyIcon,
} from "lucide-react"
import { Badge } from "../ui/badge"

// WebAuthn error messages for better UX
const getWebAuthnErrorMessage = (error) => {
  const name = error?.name || ""
  const message = error?.message || ""

  switch (name) {
    case "NotAllowedError":
      if (message.includes("timed out")) {
        return "Authentication timed out. Please try again."
      }
      return "Request was cancelled or not allowed. Please try again."
    case "InvalidStateError":
      return "This passkey is already registered on this device."
    case "SecurityError":
      return "Security error. Make sure you are using HTTPS."
    case "NotSupportedError":
      return "Passkeys are not supported on this device or browser."
    case "AbortError":
      return "The operation was cancelled."
    default:
      return error?.response?.data?.message || "An unexpected error occurred. Please try again."
  }
}

const PasskeyManager = ({ getProfile }) => {
  const [passkeys, setPasskeys] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)
  const [deletePasskeyId, setDeletePasskeyId] = useState(null)
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [editingPasskey, setEditingPasskey] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchPasskeys = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/auth/passkey`, {
        withCredentials: true,
      })
      setPasskeys(response.data)
    } catch (error) {
      toast.error("Failed to fetch passkeys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPasskeys()
  }, [fetchPasskeys])

  const handlePasskeyRegister = async () => {
    if (!nickname.trim()) {
      toast.error("Please enter a nickname for your passkey")
      return
    }

    try {
      setIsPasskeyLoading(true)

      // Step 1: Get registration options from server
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/register`,
        {},
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      )

      if (!response.data) {
        throw new Error("Failed to get registration options")
      }

      // Step 2: Create credentials using WebAuthn API
      const attResp = await startRegistration({
        optionsJSON: response.data,
      })

      // Step 3: Verify with server
      const verificationRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/register/verify`,
        {
          attestationResponse: attResp,
          nickname: nickname.trim(),
        },
        { withCredentials: true },
      )

      if (verificationRes.data.verified) {
        toast.success("Passkey registered successfully!")
        getProfile?.()
        fetchPasskeys()
        setIsNicknameDialogOpen(false)
        setNickname("")
      } else {
        toast.error("Registration verification failed")
      }
    } catch (error) {
      console.error("Passkey registration error:", error)
      toast.error(getWebAuthnErrorMessage(error))
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  const handleAddPasskeyClick = () => {
    setNickname("")
    setIsNicknameDialogOpen(true)
  }

  const handleEditPasskey = (passkey) => {
    setEditingPasskey(passkey)
    setNickname(passkey.nickname || "")
  }

  const handleUpdatePasskey = async () => {
    if (!editingPasskey || !nickname.trim()) return

    try {
      setIsUpdating(true)
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/${editingPasskey.authenticatorid}`,
        { nickname: nickname.trim() },
        { withCredentials: true },
      )
      toast.success("Passkey updated successfully")
      fetchPasskeys()
      setEditingPasskey(null)
      setNickname("")
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update passkey")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeletePasskey = async () => {
    if (!deletePasskeyId) return

    try {
      setIsDeleting(true)
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/auth/passkey/${deletePasskeyId}`, {
        withCredentials: true,
      })
      toast.success("Passkey deleted successfully")
      fetchPasskeys()
      getProfile?.()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete passkey")
    } finally {
      setIsDeleting(false)
      setDeletePasskeyId(null)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return formatDate(dateString)
  }

  // Get icon based on device type
  const getDeviceIcon = (deviceType) => {
    // singleDevice = platform authenticator (TouchID, FaceID, Windows Hello)
    // multiDevice = cross-platform/roaming authenticator (security keys, synced passkeys)
    if (deviceType === "singleDevice") {
      return <Smartphone className="h-5 w-5 text-blue-500" />
    }
    return <Key className="h-5 w-5 text-purple-500" />
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Passkeys
          </div>
          <Button
            onClick={handleAddPasskeyClick}
            disabled={isPasskeyLoading}
            className="flex items-center gap-2"
            size="sm"
          >
            {isPasskeyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            Add Passkey
          </Button>
        </CardTitle>
        <CardDescription>
          Passkeys let you sign in securely without a password using biometrics or a security key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : passkeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LockKeyhole className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No passkeys registered</p>
            <p className="text-sm mt-1">Add a passkey to enable fast, secure passwordless login</p>
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div
                key={passkey.authenticatorid}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getDeviceIcon(passkey.credentialDeviceType)}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{passkey.nickname || "Unnamed Passkey"}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${passkey.credentialBackedUp ? "text-green-600 border-green-600" : "text-yellow-600 border-yellow-600"}`}
                      >
                        {passkey.credentialBackedUp ? (
                          <>
                            <CloudyIcon className="h-3 w-3 mr-1" /> Synced
                          </>
                        ) : (
                          <>
                            <CloudOff className="h-3 w-3 mr-1" /> Device-only
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Created {formatDate(passkey.createdat)} · Last used{" "}
                      {formatRelativeTime(passkey.lastUsed)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleEditPasskey(passkey)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => setDeletePasskeyId(passkey.authenticatorid)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Passkey Dialog */}
        <Dialog open={isNicknameDialogOpen} onOpenChange={setIsNicknameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Passkey</DialogTitle>
              <DialogDescription>
                Give your passkey a nickname to help you identify it later (e.g., "MacBook Pro",
                "iPhone 15").
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nickname">Passkey Nickname</Label>
                <Input
                  id="nickname"
                  placeholder="e.g., Work Laptop, iPhone 15"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePasskeyRegister()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsNicknameDialogOpen(false)
                  setNickname("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasskeyRegister}
                disabled={isPasskeyLoading || !nickname.trim()}
              >
                {isPasskeyLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Passkey Dialog */}
        <Dialog open={!!editingPasskey} onOpenChange={() => setEditingPasskey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Passkey</DialogTitle>
              <DialogDescription>Update the nickname for this passkey.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-nickname">Passkey Nickname</Label>
                <Input
                  id="edit-nickname"
                  placeholder="e.g., Work Laptop, iPhone 15"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdatePasskey()}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPasskey(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePasskey} disabled={isUpdating || !nickname.trim()}>
                {isUpdating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletePasskeyId} onOpenChange={() => setDeletePasskeyId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this passkey? This action cannot be undone.
                {passkeys.length === 1 && (
                  <p className="mt-2 text-red-500 font-medium">
                    ⚠️ This is your last passkey. Deleting it will disable passkey authentication.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 hover:bg-red-600"
                onClick={handleDeletePasskey}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

export default PasskeyManager
