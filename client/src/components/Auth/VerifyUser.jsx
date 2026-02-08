import React, { useState, useEffect, useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Loader2, ArrowRight } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import DotPattern from "../ui/dot-pattern"
import { cn } from "@/lib/utils"

// API client configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
})

const VerifyUser = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [otp, setOtp] = useState("")
  const [email, setEmail] = useState(location?.state?.email || "")
  const [showOtpInput, setShowOtpInput] = useState(!!location?.state?.email)

  useEffect(() => {
    let timer
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [resendTimer])

  const handleError = useCallback((error) => {
    const errorMessage =
      error.response?.data?.message || error.message || "An error occurred. Please try again."
    toast.error(errorMessage)
  }, [])

  const sendOTP = useCallback(async () => {
    if (resendTimer > 0 || !email) return

    try {
      setLoading(true)
      const response = await api.post("/api/sendotp/user", { email })

      if (response.status === 200) {
        toast.success("OTP sent successfully")
        setResendTimer(60)
        setShowOtpInput(true)
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }, [email, resendTimer, handleError])

  const handleVerify = useCallback(async () => {
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP")
      return
    }

    try {
      setLoading(true)
      const response = await api.post("/api/verify/user", { email, otp })

      if (response.status === 200) {
        toast.success("Email verified successfully")
        navigate("/login", { replace: true })
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }, [email, otp, navigate, handleError])

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background/95">
      <DotPattern
        className={cn(
          "mask-[radial-gradient(550px_circle_at_center,white,transparent)]",
          "opacity-50",
        )}
      />
      <Card className="w-full max-w-md z-10 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Email Verification</CardTitle>
          <CardDescription className="text-center">
            {showOtpInput
              ? "Enter the 6-digit code sent to your email"
              : "Enter your email to receive a verification code"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-6">
            {!showOtpInput ? (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full"
                  autoComplete="email"
                />
                <Button className="w-full" onClick={sendOTP} disabled={loading || !email}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Get Verification Code
                </Button>
              </div>
            ) : (
              <>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  className="gap-2 justify-center"
                >
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <div className="flex flex-col gap-4">
                  <Button
                    onClick={handleVerify}
                    disabled={loading || otp.length !== 6}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Verify Email
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Didn't receive the code?</span>
                    <Button
                      variant="link"
                      onClick={sendOTP}
                      disabled={resendTimer > 0 || loading}
                      className="p-0 h-auto"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default VerifyUser
