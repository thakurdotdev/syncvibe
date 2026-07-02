import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import axios from "axios"
import { ArrowRight, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

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
    <>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          Email Verification
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {showOtpInput
            ? "Enter the 6-digit verification code sent to your email address."
            : "Enter your email to receive a verification code."}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {!showOtpInput ? (
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
              autoComplete="email"
            />
            <Button
              onClick={sendOTP}
              disabled={loading || !email}
              className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>Get Verification Code</span>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                className="gap-2 justify-center"
              >
                <InputOTPGroup className="gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 h-12 w-12 text-center text-lg focus-visible:ring-zinc-450 focus:border-zinc-500" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    <span>Verify Email</span>
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-zinc-500 dark:text-zinc-400">Didn't receive the code?</span>
                <Button
                  variant="link"
                  onClick={sendOTP}
                  disabled={resendTimer > 0 || loading}
                  className="p-0 h-auto font-semibold text-zinc-950 dark:text-zinc-50 hover:underline transition-all"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default VerifyUser
