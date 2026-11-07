import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { authClient, getErrorMessage, signInWithGoogle, unwrap } from '@/lib/auth-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { memo, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as yup from 'yup';
import { ArrowRight } from 'lucide-react';
import {
  AuthHeader,
  AuthSubmit,
  AuthSwitch,
  authInputClass,
  GoogleButton,
  OrDivider,
  PasswordInput,
} from './AuthUI';

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
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-3'>
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
                  className={authInputClass}
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
                  className={authInputClass}
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
                  placeholder='Password'
                  {...field}
                  autoComplete='new-password'
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <AuthSubmit
          type='submit'
          loading={loading}
          loadingText='Creating account...'
          disabled={loading}
        >
          Create account
          <ArrowRight className='h-4 w-4' />
        </AuthSubmit>
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
      <AuthHeader
        title='Create your account'
        description='Save playlists, keep your history and listen with friends in rooms.'
      />

      <GoogleButton onClick={handleGoogleLogin} disabled={loading} />

      <OrDivider />

      <RegisterForm onSubmit={handleFormSubmit} loading={loading} />

      <AuthSwitch prompt='Already have an account?' to='/login'>
        Sign in
      </AuthSwitch>
    </>
  );
};

export default Register;
