import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Shield, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"

const DisableTwoFactor = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleDisable = async () => {
    if (!password.trim()) {
      toast.error("Please enter your password to disable 2FA")
      return
    }

    try {
      setLoading(true)
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/2fa/disable`,
        { password },
        { withCredentials: true },
      )

      if (response.status === 200) {
        toast.success("Two-Factor Authentication disabled successfully")
        onSuccess()
        onClose()
        setPassword("")
      }
    } catch (error) {
      console.error("Disable 2FA error:", error)
      toast.error(error.response?.data?.message || "Failed to disable 2FA")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPassword("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Disable Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-orange-800 dark:text-orange-200">
                  Security Warning
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Disabling 2FA will reduce your account security. You'll only need your password to
                  log in.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Enter your password to confirm
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="mt-2"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleDisable}
                disabled={loading || !password.trim()}
                variant="destructive"
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disabling...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Disable 2FA
                  </>
                )}
              </Button>
              <Button onClick={handleClose} variant="outline" disabled={loading} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DisableTwoFactor
