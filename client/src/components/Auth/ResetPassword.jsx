import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { CheckCircle2, Eye, EyeOff, Loader2Icon, XCircle, ArrowRight } from "lucide-react"
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
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/reset-password`, {
        token,
        email,
        password,
      })
      setStatus("success")
      toast.success(response.data.message)
    } catch (error) {
      setStatus("error")
      toast.error(error.response?.data?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // Handle invalid reset link state
  if (!isValid) {
    return (
      <div className="flex flex-col justify-center items-center text-center">
        <div className="rounded-2xl bg-red-500/10 p-4 mb-6">
          <XCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Invalid reset link</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          This password reset link is invalid or has expired. Please try requesting a new one.
        </p>
        <Link to="/login" className="w-full">
          <Button variant="outline" className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold cursor-pointer">
            Back to Login
          </Button>
        </Link>
      </div>
    )
  }

  // Handle successful password reset state
  if (status === "success") {
    return (
      <div className="flex flex-col justify-center items-center text-center">
        <div className="rounded-2xl bg-emerald-500/10 p-4 mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Password updated</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Your password has been successfully reset. You can now log in with your new password.
        </p>
        <Link to="/login" className="w-full">
          <Button className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold cursor-pointer">
            Go to Login
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          Reset Password
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Choose a new password for your account.
        </p>
      </div>

      {/* Reset Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
            className="h-12 pl-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors focus:outline-hidden"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="relative">
          <Input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="h-12 pl-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors focus:outline-hidden"
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
          >
            {showConfirm ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>

        {status === "error" && (
          <p className="text-sm text-red-500 text-center">
            This reset link may have expired.{" "}
            <Link to="/login" className="underline underline-offset-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Request a new one
            </Link>
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
          disabled={loading || !password || !confirmPassword}
        >
          {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
          <span>{loading ? "Resetting..." : "Reset Password"}</span>
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>

        <div className="text-sm text-center text-zinc-500 dark:text-zinc-400 mt-6 pt-2">
          <Link to="/login" className="text-zinc-950 dark:text-zinc-50 font-semibold underline-offset-4 hover:underline transition-all">
            Back to Login
          </Link>
        </div>
      </form>
    </>
  )
}

export default ResetPassword
