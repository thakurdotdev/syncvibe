import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { yupResolver } from "@hookform/resolvers/yup"
import axios from "axios"
import { memo, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import * as yup from "yup"
import googleIcon from "/google.png?url"

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

const validationSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must not exceed 50 characters"),

  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address")
    .max(255, "Email must not exceed 255 characters"),

  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      PASSWORD_PATTERN,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
})

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
})

const RegisterForm = memo(({ onSubmit, loading }) => {
  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
    mode: "onChange",
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Name" {...field} autoComplete="name" disabled={loading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="email"
                  placeholder="Email"
                  {...field}
                  autoComplete="email"
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
                <Input
                  type="password"
                  placeholder="Password"
                  {...field}
                  autoComplete="new-password"
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </Button>
      </form>
    </Form>
  )
})

RegisterForm.displayName = "RegisterForm"

const Register = () => {
  document.title = "Register - SyncVibe"
  window.scrollTo(0, 0)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleFormSubmit = useCallback(
    async (data) => {
      setLoading(true)
      try {
        const response = await api.post("/api/register", data)

        if (response.status === 201) {
          toast.success(response.data.message)
          navigate("/verify", {
            state: { email: data.email, name: data.name },
            replace: true,
          })
        }
      } catch (error) {
        handleError(error)
      } finally {
        setLoading(false)
      }
    },
    [navigate],
  )

  const handleError = useCallback((error) => {
    const errorMessage =
      error.response?.data?.message || error.message || "An error occurred. Please try again."
    toast.error(errorMessage)
  }, [])

  const handleGoogleLogin = useCallback(() => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`
  }, [])

  return (
    <div className="min-h-dvh flex flex-col justify-center items-center p-6 bg-[#050505] relative overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md z-10 bg-white/3 border-white/8 backdrop-blur-xs">
        <CardHeader>
          <CardTitle className="text-2xl text-center font-bold">Create your account</CardTitle>
        </CardHeader>

        <CardContent>
          <RegisterForm onSubmit={handleFormSubmit} loading={loading} />
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              Login
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            className="w-full"
            disabled={loading}
          >
            <img src={googleIcon} alt="Google" className="w-4 h-4 mr-2" />
            Login with Google
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default Register
