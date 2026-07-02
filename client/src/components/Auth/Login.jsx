import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useProfile } from "@/Context/Context"
import { yupResolver } from "@hookform/resolvers/yup"
import { startAuthentication, browserSupportsWebAuthnAutofill } from "@simplewebauthn/browser"
import axios from "axios"
import { Eye, EyeOff, KeyRound, Loader2Icon, ArrowRight } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import * as yup from "yup"
import TwoFactorLogin from "./TwoFactorLogin"
import ForgotPassword from "./ForgotPassword"
import googleIcon from "/google.png?url"

const validationSchema = yup.object().shape({
  email: yup.string().required("Email is required").email("Email is Invalid"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
})

const Login = () => {
  document.title = "SyncVibe - Login"
  window.scrollTo(0, 0)
  const { user, setUser, loading: loadingPro, getProfile } = useProfile()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [userData, setUserData] = useState({})
  const [show2FA, setShow2FA] = useState(false)
  const [twoFactorUserId, setTwoFactorUserId] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnPath = searchParams.get("returnTo") || "/feed"
  const passkeyAuthStarted = useRef(false)

  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  useEffect(() => {
    if (!loadingPro && user?.email) {
      navigate(returnPath)
    }
  }, [loadingPro, user, navigate, returnPath])

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
      console.debug("Failed to fetch IP info:", error)
    }
  }

  // Handle passkey authentication with conditional UI (autofill)
  const handlePasskeyAuth = useCallback(
    async (assertionResponse, email) => {
      try {
        setLoading(true)
        const verificationRes = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate/verify`,
          {
            assertionResponse,
            email,
            userData,
          },
          { withCredentials: true },
        )

        if (verificationRes.data.verified) {
          await getProfile()
          toast.success("Logged in with passkey!")
          navigate(returnPath)
        }
      } catch (error) {
        console.error("Passkey auth error:", error)
        toast.error(error.response?.data?.message || "Passkey authentication failed")
      } finally {
        setLoading(false)
      }
    },
    [userData, getProfile, navigate, returnPath],
  )

  // Initialize conditional UI (passkey autofill) on mount
  useEffect(() => {
    let isMounted = true

    const initConditionalUI = async () => {
      if (passkeyAuthStarted.current) return

      try {
        const supportsAutofill = await browserSupportsWebAuthnAutofill()
        if (!supportsAutofill || !isMounted) return

        passkeyAuthStarted.current = true

        const optionsRes = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate/conditional`,
        )

        if (!isMounted) return

        const assertionResponse = await startAuthentication({
          optionsJSON: optionsRes.data,
          useBrowserAutofill: true,
        })

        if (assertionResponse && isMounted) {
          await handlePasskeyAuth(assertionResponse, null)
        }
      } catch (error) {
        // AbortError is expected when user navigates away or doesn't select a passkey
        if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
          console.error("Passkey autofill error:", error.message)
        }
        passkeyAuthStarted.current = false
      }
    }

    initConditionalUI()

    return () => {
      isMounted = false
      passkeyAuthStarted.current = false
    }
  }, [handlePasskeyAuth])

  const handleFormSubmit = async (data) => {
    setLoading(true)
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/login`,
        {
          ...data,
          userData: userData,
        },
        { withCredentials: true },
      )

      if (response.status === 200) {
        if (response.data.twoFactorRequired) {
          setTwoFactorUserId(response.data.userId)
          setShow2FA(true)
          toast.info("Please enter your 2FA code")
        } else {
          getProfile()
          navigate(returnPath)
          toast.success("Logged in successfully")
        }
      }
    } catch (error) {
      handleError(error)
    } finally {
      setLoading(false)
    }
  }

  const handleError = (error) => {
    const errorMessage =
      error.response?.data?.message || error.message || "An error occurred. Please try again."
    toast.error(errorMessage)
  }

  const handle2FASuccess = (token) => {
    setShow2FA(false)
    setTwoFactorUserId(null)
    getProfile()
    navigate(returnPath)
    toast.success("Logged in successfully")
  }

  const handle2FAClose = () => {
    setShow2FA(false)
    setTwoFactorUserId(null)
  }

  const togglePasswordVisibility = () => setShowPassword(!showPassword)

  // Show 2FA step if required
  if (show2FA) {
    return (
      <TwoFactorLogin
        userId={twoFactorUserId}
        onSuccess={handle2FASuccess}
        onClose={handle2FAClose}
      />
    )
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Welcome back! Please enter your details.
        </p>
      </div>

      {/* Social Sign-in Buttons */}
      <div className="space-y-3">
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google?client=${window.location.origin}`
          }}
          className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer"
          disabled={loading}
        >
          <img src={googleIcon} alt="Google" className="w-5 h-5 object-contain" />
          Sign in with Google
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate("/passkey-login")}
          className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer"
          disabled={loading}
        >
          <KeyRound className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          Sign in with Passkey
        </Button>
      </div>

      {/* Or Separator */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-zinc-50/40 dark:bg-[#050505] px-2.5 text-zinc-400 dark:text-zinc-500 font-medium">
            or
          </span>
        </div>
      </div>

      {/* Login Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="Email"
                    autoComplete="username webauthn"
                    className="h-12 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      autoComplete="current-password"
                      className="h-12 pl-4 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-650 focus-visible:border-transparent transition-all"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors focus:outline-hidden"
                      onClick={togglePasswordVisibility}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-1">
            <ForgotPassword />
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl bg-zinc-950 dark:bg-zinc-50 text-white dark:text-zinc-950 hover:bg-zinc-900 dark:hover:bg-zinc-200 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
            disabled={loading}
          >
            {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
            <span>{loading ? "Logging in..." : "Sign in"}</span>
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      </Form>

      {/* Bottom Link for mobile/fallback */}
      <div className="text-sm text-center text-zinc-500 dark:text-zinc-400 mt-6">
        New to SyncVibe?{" "}
        <Link
          to={`/register?returnTo=${encodeURIComponent(returnPath)}`}
          className="text-zinc-950 dark:text-zinc-50 font-semibold underline-offset-4 hover:underline transition-all"
        >
          Create an account
        </Link>
      </div>
    </>
  )
}

export default Login
