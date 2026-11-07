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
import { ArrowRight, KeyRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import * as yup from 'yup';
import {
  AuthHeader,
  AuthSecondary,
  AuthSubmit,
  AuthSwitch,
  authInputClass,
  GoogleButton,
  OrDivider,
  PasswordInput,
} from './AuthUI';
import TwoFactorLogin from './TwoFactorLogin';

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

  // The browser lists the passkeys saved for this site, so no email is needed.
  const handlePasskeySignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.signIn.passkey();
      if (data) {
        await completeSignIn();
      } else if (error && !isPasskeyCancelled(error)) {
        toast.error(getErrorMessage(error, 'Passkey sign-in failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (show2FA) {
    return <TwoFactorLogin onSuccess={completeSignIn} onClose={() => setShow2FA(false)} />;
  }

  return (
    <>
      <AuthHeader title='Welcome back' description='Sign in to pick up where the music left off.' />

      <div className='space-y-3'>
        <GoogleButton onClick={handleGoogleSignIn} disabled={loading} />
        <AuthSecondary onClick={handlePasskeySignIn} disabled={loading}>
          <KeyRound className='h-5 w-5' />
          Continue with passkey
        </AuthSecondary>
      </div>

      <OrDivider />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className='space-y-3'>
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
                    className={authInputClass}
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
                  <PasswordInput
                    {...field}
                    placeholder='Password'
                    autoComplete='current-password'
                    disabled={loading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex justify-end'>
            <Link
              to='/forgot-password'
              className='text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
            >
              Forgot password?
            </Link>
          </div>

          <AuthSubmit
            type='submit'
            loading={loading}
            loadingText='Signing in...'
            disabled={loading}
          >
            Sign in
            <ArrowRight className='h-4 w-4' />
          </AuthSubmit>
        </form>
      </Form>

      <AuthSwitch
        prompt='New to SyncVibe?'
        to={`/register?returnTo=${encodeURIComponent(returnPath)}`}
      >
        Create an account
      </AuthSwitch>
    </>
  );
};

export default Login;
