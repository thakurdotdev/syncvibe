import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { CheckCircle2, Eye, EyeOff, Loader2Icon, XCircle } from "lucide-react"
import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

const ResetPassword = () => {
  document.title = "SyncVibe - Reset Password"
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const isValid = token && email

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/reset-password`,
        { token, email, password },
      )
      setStatus("success")
      toast.success(response.data.message)
    } catch (error) {
      setStatus("error")
      toast.error(error.response?.data?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (!isValid) {
    return (
      <div className="min-h-svh flex flex-col justify-center items-center p-6 bg-[#050505] relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[120px]" />
        <Card className="w-full max-w-sm bg-white/3 border-white/8 backdrop-blur-xs">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <div className="rounded-full bg-red-500/10 p-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold">Invalid reset link</h2>
            <p className="text-sm text-muted-foreground text-center">
              This password reset link is invalid or has expired.
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-2">
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="min-h-svh flex flex-col justify-center items-center p-6 bg-[#050505] relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
        <Card className="w-full max-w-sm bg-white/3 border-white/8 backdrop-blur-xs">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold">Password reset successful</h2>
            <p className="text-sm text-muted-foreground text-center">
              Your password has been updated. You can now log in with your new password.
            </p>
            <Link to="/login">
              <Button className="mt-2">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col justify-center items-center p-6 bg-[#050505] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px]" />

      <Card className="w-full max-w-sm z-10 bg-white/3 border-white/8 backdrop-blur-xs">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Choose a new password for your account
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {status === "error" && (
              <p className="text-sm text-red-500 text-center">
                This reset link may have expired.{" "}
                <Link to="/login" className="underline underline-offset-4">
                  Request a new one
                </Link>
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !password || !confirmPassword}
            >
              {loading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Resetting..." : "Reset Password"}
            </Button>

            <div className="text-sm text-center text-muted-foreground">
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ResetPassword
