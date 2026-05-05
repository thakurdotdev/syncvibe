import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import axios from "axios"
import { Loader2Icon, Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

const ForgotPassword = () => {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("Please enter your email address")
      return
    }

    setLoading(true)
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/forgot-password`,
        { email: email.trim() },
      )
      setSent(true)
      toast.success(response.data.message)
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (value) => {
    setOpen(value)
    if (!value) {
      setEmail("")
      setSent(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        >
          Forgot password?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>{sent ? "Check your email" : "Reset your password"}</DialogTitle>
          <DialogDescription>
            {sent
              ? "We've sent a password reset link to your email. It expires in 1 hour."
              : "Enter the email associated with your account and we'll send you a reset link."}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <Mail className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Didn't receive the email? Check your spam folder or{" "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline cursor-pointer"
                onClick={() => setSent(false)}
              >
                try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
              {loading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ForgotPassword
