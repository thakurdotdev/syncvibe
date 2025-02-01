import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Context } from "@/Context/Context";
import { cn } from "@/lib/utils";
import { yupResolver } from "@hookform/resolvers/yup";
import { startAuthentication } from "@simplewebauthn/browser";
import axios from "axios";
import { KeyRound, Loader2 } from "lucide-react";
import { useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as yup from "yup";
import DotPattern from "../ui/dot-pattern";
import { useEffect } from "react";

const schema = yup
  .object({
    email: yup
      .string()
      .email("Please enter a valid email")
      .required("Email is required"),
  })
  .required();

export const PasskeyLogin = () => {
  const { getProfile } = useContext(Context);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState({});

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: "",
    },
  });

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

  const handleLogin = async (data) => {
    setIsLoading(true);
    setError("");

    try {
      const options = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate`,
        {
          email: data.email,
        },
      );

      if (options.data) {
        const assertionResponse = await startAuthentication({
          optionsJSON: options.data,
        });

        const verificationRes = await axios.post(
          `${
            import.meta.env.VITE_API_URL
          }/api/auth/passkey/authenticate/verify`,
          {
            assertionResponse: assertionResponse,
            email: data.email,
            userData: userData,
          },
          {
            withCredentials: true,
          },
        );

        const verificationResult = verificationRes.data;

        if (verificationResult.verified) {
          await getProfile();
          toast.success("Login successful");
          navigate("/feed");
        }
      }
    } catch (error) {
      if (error?.response?.data?.message) {
        setError(error.response.data.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center max-h-svh h-svh overflow-hidden">
      <DotPattern
        className={cn(
          "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
        )}
      />
      <Card className="w-full max-w-md mx-auto z-10">
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" />
            <CardTitle>Login with Passkey</CardTitle>
          </div>
          <CardDescription className="mt-2">
            Use your device's biometric authentication or security key to sign
            in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleLogin)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your email"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-6 h-6 mr-2 animate-spin" />}
                {isLoading ? "Authenticating..." : "Login with Passkey"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/login")}
              >
                Login with Password
              </Button>
            </form>
          </Form>
          <CardFooter className="flex flex-col mt-3"></CardFooter>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasskeyLogin;
