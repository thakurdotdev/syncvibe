import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Context } from "@/Context/Context"
import { yupResolver } from "@hookform/resolvers/yup"
import { startAuthentication } from "@simplewebauthn/browser"
import axios from "axios"
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from "lucide-react"
import { useContext, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import * as yup from "yup"

const schema = yup
  .object({
    email: yup.string().email("Please enter a valid email").required("Email is required"),
  })
  .required()

// WebAuthn error messages for better UX
const getWebAuthnErrorMessage = (error) => {
  const name = error?.name || ""
  const message = error?.message || ""

  switch (name) {
    case "NotAllowedError":
      if (message.includes("timed out")) {
        return "Authentication timed out. Please try again."
      }
      return "Authentication was cancelled or not allowed. Please try again."
    case "SecurityError":
      return "Security error. Make sure you are using HTTPS."
    case "NotSupportedError":
      return "Passkeys are not supported on this device or browser."
    case "AbortError":
      return "The operation was cancelled."
    default:
      return null // Return null for API errors to use the server message
  }
}

export const PasskeyLogin = () => {
  const { getProfile } = useContext(Context)
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userData, setUserData] = useState({})

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: "",
    },
  })

  useEffect(() => {
    getUserData()
  }, [])

  const getUserData = async () => {
    try {
      const data = await axios.get(
        `https://ipinfo.io/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`,
      )
      if (data.status === 200) {
        setUserData(data.data)
      }
    } catch (error) {
      // Silently fail - IP info is optional
      console.debug("Failed to fetch IP info:", error)
    }
  }

  const handleLogin = async (data) => {
    setIsLoading(true)
    setError("")

    try {
      // Step 1: Get authentication options from server
      const options = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate`,
        { email: data.email },
      )

      if (!options.data) {
        throw new Error("Failed to get authentication options")
      }

      // Step 2: Authenticate using WebAuthn API
      const assertionResponse = await startAuthentication({
        optionsJSON: options.data,
      })

      // Step 3: Verify with server
      const verificationRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate/verify`,
        {
          assertionResponse: assertionResponse,
          email: data.email,
          userData: userData,
        },
        { withCredentials: true },
      )

      if (verificationRes.data.verified) {
        await getProfile()
        toast.success("Login successful!")
        navigate("/feed")
      } else {
        setError("Authentication verification failed. Please try again.")
      }
    } catch (error) {
      console.error("Passkey login error:", error)

      // Check for WebAuthn-specific errors first
      const webAuthnError = getWebAuthnErrorMessage(error)
      if (webAuthnError) {
        setError(webAuthnError)
      } else if (error?.response?.data?.message) {
        setError(error.response.data.message)
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <KeyRound className="w-5 h-5 text-zinc-900 dark:text-zinc-50" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Login with Passkey
          </h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Use your device's biometric authentication (Face ID, Touch ID, Windows Hello) or security key to sign in securely.
        </p>
      </div>

      {/* Login Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Email Address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your email"
                    type="email"
                    autoComplete="email webauthn"
                    className="h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <Alert variant="destructive" className="rounded-xl border-red-200/50 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 pt-2">
            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Continue with Passkey
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => navigate("/login")}
            >
              Login with Password
            </Button>
          </div>
        </form>
      </Form>

      <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mt-6">
        Passkeys provide a more secure, phishing-resistant way to sign in without passwords.
      </p>
    </>
  )
}

export default PasskeyLogin
