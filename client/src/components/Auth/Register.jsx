import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authClient, getErrorMessage, signInWithGoogle, unwrap } from '@/lib/auth-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { memo, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as yup from 'yup';
import googleIcon from '/google.png?url';
import { Eye, EyeOff, Loader2Icon, ArrowRight } from 'lucide-react';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const validationSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),

  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must not exceed 255 characters'),

  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      PASSWORD_PATTERN,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

const RegisterForm = memo(({ onSubmit, loading }) => {
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder='Name'
                  {...field}
                  autoComplete='name'
                  disabled={loading}
                  className='h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type='email'
                  placeholder='Email'
                  {...field}
                  autoComplete='email'
                  disabled={loading}
                  className='h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
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
                    type={showPassword ? 'text' : 'password'}
                    placeholder='Password'
                    {...field}
                    autoComplete='new-password'
                    disabled={loading}
                    className='h-12 pl-4 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
                  />
                  <button
                    type='button'
                    className='absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground transition-colors focus:outline-hidden'
                    onClick={() => setShowPassword(!showPassword)}
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

        <Button
          type='submit'
          className='w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2'
          disabled={loading}
        >
          {loading && <Loader2Icon className='h-4 w-4 animate-spin' />}
          <span>{loading ? 'Registering...' : 'Register'}</span>
          {!loading && <ArrowRight className='h-4 w-4' />}
        </Button>
      </form>
    </Form>
  );
});

RegisterForm.displayName = 'RegisterForm';

const Register = () => {
  document.title = 'Register - SyncVibe';
  window.scrollTo(0, 0);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleFormSubmit = useCallback(
    async ({ name, email, password }) => {
      setLoading(true);
      try {
        await unwrap(authClient.signUp.email({ name: name.trim(), email, password }));
        toast.success('Account created. Check your email for the verification code.');
        navigate('/verify', { state: { email, codeSent: true }, replace: true });
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithGoogle('/home');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Google sign-in failed'));
      setLoading(false);
    }
  }, []);

  return (
    <>
      <div className='mb-8'>
        <h1 className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-2'>
          Create your account
        </h1>
        <p className='text-sm text-muted-foreground'>
          Join SyncVibe today! Please enter your details.
        </p>
      </div>

      {/* Social Sign-in Buttons */}
      <div className='space-y-3'>
        <Button
          variant='outline'
          onClick={handleGoogleLogin}
          className='w-full h-12 rounded-xl border border-border bg-card hover:bg-muted dark:hover:bg-raised text-foreground font-medium transition-all shadow-xs flex items-center justify-center gap-2.5 cursor-pointer'
          disabled={loading}
        >
          <img src={googleIcon} alt='Google' className='w-5 h-5 object-contain' />
          Sign in with Google
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

      {/* Register Form */}
      <RegisterForm onSubmit={handleFormSubmit} loading={loading} />

      {/* Bottom Link for mobile/fallback */}
      <div className='text-sm text-center text-muted-foreground mt-6'>
        Already have an account?{' '}
        <Link
          to='/login'
          className='text-foreground font-semibold underline-offset-4 hover:underline transition-all'
        >
          Login
        </Link>
      </div>
    </>
  );
};

export default Register;
