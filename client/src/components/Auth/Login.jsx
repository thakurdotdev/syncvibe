import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import axios from "axios";
import * as yup from "yup";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import LoadingScreen from "../Loader";
import googleIcon from "/google.png?url";
import { toast } from "sonner";
import DotPattern from "../ui/dot-pattern";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { KeyRound } from "lucide-react";
import { useProfile } from "@/Context/Context";
import { Loader2Icon } from "lucide-react";

const validationSchema = yup.object().shape({
  email: yup.string().required("Email is required").email("Email is Invalid"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
});

const Login = () => {
  document.title = "SyncVibe - Login";
  window.scrollTo(0, 0);
  const { user, setUser, loading: loadingPro, getProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userData, setUserData] = useState({});
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = searchParams.get("returnTo") || "/feed";

  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loadingPro && user?.email) {
      navigate(returnPath);
    }
  }, [loadingPro, user, navigate, returnPath]);

  useEffect(() => {
    getUserData();
  }, []);

  const getUserData = async () => {
    try {
      const data = await axios.get(
        `https://ipinfo.io/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`,
      );
      if (data.status === 200) {
        setUserData(data.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleFormSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/login`,
        {
          ...data,
          userData: userData,
        },
        { withCredentials: true },
      );

      if (response.status === 200) {
        getProfile();
        navigate(returnPath);
        toast.success("Logged in successfully");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginGuest = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/guestLogin`,
        {
          userData: userData,
        },
        { withCredentials: true },
      );

      if (response.status === 200) {
        getProfile();
        navigate(returnPath);
        toast.success("Logged in as guest");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (error) => {
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      "An error occurred. Please try again.";
    toast.error(errorMessage);
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
      <div className="flex flex-col justify-center items-center max-md:p-5 h-svh overflow-hidden relative">
        <DotPattern
          className={cn(
            "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
          )}
        />
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-purple-600/30 filter blur-[100px] animate-pulse"></div>
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-pink-600/20 filter blur-[120px] animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full bg-blue-600/20 filter blur-[80px] animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <Card className="w-full max-w-sm z-10">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Login to SyncVibe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleFormSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} type="email" placeholder="Email" />
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
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            onClick={togglePasswordVisibility}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to={`/register?returnTo=${encodeURIComponent(returnPath)}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                Register
              </Link>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google?client=${window.location.origin}`;
              }}
              className="w-full"
              disabled={loading}
            >
              <img src={googleIcon} alt="Google" className="w-4 h-4 mr-2" />
              Login with Google
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/passkey-login")}
              className="w-full mt-2"
              disabled={loading}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Login with Passkey
            </Button>
          </CardFooter>
        </Card>
      </div>
  );
};

export default Login;
