import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useProfile } from '@/Context/Context';
import {
  authClient,
  getErrorMessage,
  getSafeReturnPath,
  isPasskeyCancelled,
  signInWithGoogle,
  unwrap,
} from '@/lib/auth-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import * as yup from 'yup';
import ForgotPassword from './ForgotPassword';
import TwoFactorLogin from './TwoFactorLogin';
import googleIcon from '/google.png?url';

const validationSchema = yup.object().shape({
  email: yup.string().required('Email is required').email('Email is Invalid'),
  password: yup
    .string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

const Login = () => {
  document.title = 'SyncVibe - Login';
  window.scrollTo(0, 0);
  const { user, loading: loadingPro, getProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = getSafeReturnPath(searchParams.get('returnTo'));

  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!loadingPro && user?.email) {
      navigate(returnPath);
    }
  }, [loadingPro, user, navigate, returnPath]);

  const completeSignIn = useCallback(async () => {
    await getProfile();
    navigate(returnPath);
    toast.success('Logged in successfully');
  }, [getProfile, navigate, returnPath]);

  // Offers saved passkeys in the email field's autofill list, where the browser supports it.
  useEffect(() => {
    if (!window.PublicKeyCredential?.isConditionalMediationAvailable) return;

    let active = true;
    window.PublicKeyCredential.isConditionalMediationAvailable().then(async (available) => {
      if (!available || !active) return;

      const { data, error } = await authClient.signIn.passkey({ autoFill: true });
      if (!active) return;
      if (data) {
        await completeSignIn();
      } else if (error && !isPasskeyCancelled(error)) {
        toast.error(getErrorMessage(error, 'Passkey sign-in failed'));
      }
    });

    return () => {
      active = false;
    };
  }, [completeSignIn]);

  const handleFormSubmit = async ({ email, password }) => {
    setLoading(true);
    try {
      const result = await unwrap(authClient.signIn.email({ email, password }));
      if (result.twoFactorRedirect) {
        setShow2FA(true);
        toast.info('Please enter your 2FA code');
        return;
      }
      await completeSignIn();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(returnPath);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Google sign-in failed'));
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  if (show2FA) {
    return <TwoFactorLogin onSuccess={completeSignIn} onClose={() => setShow2FA(false)} />;
  }

  return (
    <>
      <div className='mb-8'>
        <h1 className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-2'>
          Welcome back
        </h1>
        <p className='text-sm text-muted-foreground'>Welcome back! Please enter your details.</p>
      </div>

      {/* Social Sign-in Buttons */}
      <div className='space-y-3'>
        <Button
          variant='outline'
          onClick={handleGoogleSignIn}
          className='w-full h-12 rounded-xl border border-border bg-card hover:bg-muted dark:hover:bg-raised text-foreground font-medium transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer'
          disabled={loading}
        >
          <img src={googleIcon} alt='Google' className='w-5 h-5 object-contain' />
          Sign in with Google
        </Button>

        <Button
          variant='outline'
          onClick={() => navigate('/passkey-login')}
          className='w-full h-12 rounded-xl border border-border bg-card hover:bg-muted dark:hover:bg-raised text-foreground font-medium transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer'
          disabled={loading}
        >
          <KeyRound className='w-5 h-5 text-muted-foreground' />
          Sign in with Passkey
        </Button>
      </div>

      {/* Or Separator */}
      <div className='relative my-6'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t border-border' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-muted/40 dark:bg-background px-2.5 text-muted-foreground font-medium'>
            or
          </span>
        </div>
      </div>

      {/* Login Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className='space-y-4'>
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    type='email'
                    placeholder='Email'
                    autoComplete='username webauthn'
                    className='h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className='relative'>
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      placeholder='Password'
                      autoComplete='current-password'
                      className='h-12 pl-4 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
                      disabled={loading}
                    />
                    <button
                      type='button'
                      className='absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground transition-colors focus:outline-hidden'
                      onClick={togglePasswordVisibility}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex justify-end pt-1'>
            <ForgotPassword />
          </div>

          <Button
            type='submit'
            className='w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2'
            disabled={loading}
          >
            {loading && <Loader2Icon className='h-4 w-4 animate-spin' />}
            <span>{loading ? 'Logging in...' : 'Sign in'}</span>
            {!loading && <ArrowRight className='h-4 w-4' />}
          </Button>
        </form>
      </Form>

      {/* Bottom Link for mobile/fallback */}
      <div className='text-sm text-center text-muted-foreground mt-6'>
        New to SyncVibe?{' '}
        <Link
          to={`/register?returnTo=${encodeURIComponent(returnPath)}`}
          className='text-foreground font-semibold underline-offset-4 hover:underline transition-all'
        >
          Create an account
        </Link>
      </div>
    </>
  );
};

export default Login;
