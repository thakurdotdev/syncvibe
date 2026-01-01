import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Context } from '@/Context/Context';
import { cn } from '@/lib/utils';
import { yupResolver } from '@hookform/resolvers/yup';
import { startAuthentication } from '@simplewebauthn/browser';
import axios from 'axios';
import { KeyRound, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useContext, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as yup from 'yup';
import DotPattern from '../ui/dot-pattern';

const schema = yup
  .object({
    email: yup.string().email('Please enter a valid email').required('Email is required'),
  })
  .required();

// WebAuthn error messages for better UX
const getWebAuthnErrorMessage = (error) => {
  const name = error?.name || '';
  const message = error?.message || '';

  switch (name) {
    case 'NotAllowedError':
      if (message.includes('timed out')) {
        return 'Authentication timed out. Please try again.';
      }
      return 'Authentication was cancelled or not allowed. Please try again.';
    case 'SecurityError':
      return 'Security error. Make sure you are using HTTPS.';
    case 'NotSupportedError':
      return 'Passkeys are not supported on this device or browser.';
    case 'AbortError':
      return 'The operation was cancelled.';
    default:
      return null; // Return null for API errors to use the server message
  }
};

export const PasskeyLogin = () => {
  const { getProfile } = useContext(Context);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState({});

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      email: '',
    },
  });

  useEffect(() => {
    getUserData();
  }, []);

  const getUserData = async () => {
    try {
      const data = await axios.get(
        `https://ipinfo.io/json?token=${import.meta.env.VITE_IPINFO_TOKEN}`
      );
      if (data.status === 200) {
        setUserData(data.data);
      }
    } catch (error) {
      // Silently fail - IP info is optional
      console.debug('Failed to fetch IP info:', error);
    }
  };

  const handleLogin = async (data) => {
    setIsLoading(true);
    setError('');

    try {
      // Step 1: Get authentication options from server
      const options = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate`,
        { email: data.email }
      );

      if (!options.data) {
        throw new Error('Failed to get authentication options');
      }

      // Step 2: Authenticate using WebAuthn API
      const assertionResponse = await startAuthentication({
        optionsJSON: options.data,
      });

      // Step 3: Verify with server
      const verificationRes = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/passkey/authenticate/verify`,
        {
          assertionResponse: assertionResponse,
          email: data.email,
          userData: userData,
        },
        { withCredentials: true }
      );

      if (verificationRes.data.verified) {
        await getProfile();
        toast.success('Login successful!');
        navigate('/feed');
      } else {
        setError('Authentication verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Passkey login error:', error);

      // Check for WebAuthn-specific errors first
      const webAuthnError = getWebAuthnErrorMessage(error);
      if (webAuthnError) {
        setError(webAuthnError);
      } else if (error?.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='flex items-center justify-center max-h-svh h-svh overflow-hidden relative bg-[#050505]'>
      {/* Subtle glow */}
      <div className='absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px]' />
      <div className='absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[120px]' />
      <Card className='w-full max-w-md mx-auto z-10 bg-white/[0.03] border-white/[0.08] backdrop-blur-sm'>
        <CardHeader className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <div className='p-2 rounded-lg bg-primary/10'>
              <KeyRound className='w-6 h-6 text-primary' />
            </div>
            <CardTitle>Login with Passkey</CardTitle>
          </div>
          <CardDescription className='mt-2'>
            Use your device's biometric authentication (Face ID, Touch ID, Windows Hello) or
            security key to sign in securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className='space-y-6'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Enter your email'
                        type='email'
                        autoComplete='email webauthn'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className='space-y-3'>
                <Button type='submit' className='w-full' disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className='w-5 h-5 mr-2 animate-spin' />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className='w-5 h-5 mr-2' />
                      Continue with Passkey
                    </>
                  )}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  className='w-full'
                  onClick={() => navigate('/login')}
                >
                  Login with Password
                </Button>
              </div>
            </form>
          </Form>
          <CardFooter className='flex flex-col mt-3 px-0'>
            <p className='text-xs text-muted-foreground text-center'>
              Passkeys provide a more secure, phishing-resistant way to sign in without passwords.
            </p>
          </CardFooter>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasskeyLogin;
