import React, { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Shield, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"

const TwoFactorLogin = ({ userId, onSuccess, onClose }) => {
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit code")
      return
    }

    try {
      setLoading(true)
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/2fa/verify`,
        {
          userId: userId,
          token: otp,
        },
        { withCredentials: true },
      )

      if (response.status === 200) {
        setIsVerified(true)
        toast.success("Login successful!")
        setTimeout(() => {
          onSuccess(response.data.token)
        }, 1000)
      }
    } catch (error) {
      console.error("2FA verification error:", error)
      toast.error(error.response?.data?.message || "Invalid verification code")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && otp.length === 6 && !loading) {
      handleVerify()
    }
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Shield className="w-5 h-5 text-zinc-900 dark:text-zinc-50" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Two-Factor Auth
          </h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="text-center text-xl tracking-[0.5em] font-semibold h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
          maxLength={6}
          disabled={loading || isVerified}
          onKeyPress={handleKeyPress}
          autoFocus
        />

        <div className="space-y-3 pt-2">
          <Button
            onClick={handleVerify}
            disabled={loading || otp.length !== 6 || isVerified}
            className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : isVerified ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                <span>Verified</span>
              </>
            ) : (
              <span>Verify</span>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  )
}

export default TwoFactorLogin
