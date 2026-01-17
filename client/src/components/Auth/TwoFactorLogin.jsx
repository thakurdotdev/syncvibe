import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
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
    <div className="flex flex-col justify-center items-center min-h-[400px] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Shield className="h-8 w-8 text-blue-500" />
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <p className="text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-lg tracking-widest"
              maxLength={6}
              disabled={loading || isVerified}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || otp.length !== 6 || isVerified}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : isVerified ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Verified
              </>
            ) : (
              "Verify"
            )}
          </Button>

          <Button variant="outline" onClick={onClose} className="w-full" disabled={loading}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default TwoFactorLogin
