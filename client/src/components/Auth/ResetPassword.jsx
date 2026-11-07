import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, KeyRound, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { AuthHeader, AuthStatus, AuthSubmit, PasswordInput } from './AuthUI';

const ResetPassword = () => {
  document.title = 'SyncVibe - Reset Password';
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const isValid = Boolean(token);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await unwrap(authClient.resetPassword({ token, newPassword: password }));
      setStatus('success');
      toast.success('Your password has been reset. You can now sign in.');
    } catch (error) {
      setStatus('error');
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!isValid) {
    return (
      <AuthStatus
        icon={XCircle}
        tone='destructive'
        title='This link has expired'
        description='Password reset links work once and expire after an hour. Request a new one to try again.'
      >
        <Button asChild variant='outline' size='lg' className='press w-full rounded-xl bg-card'>
          <Link to='/forgot-password'>Request a new link</Link>
        </Button>
      </AuthStatus>
    );
  }

  if (status === 'success') {
    return (
      <AuthStatus
        icon={CheckCircle2}
        title='Password updated'
        description='Your password has been reset. Sign in with your new password.'
      >
        <Button asChild size='lg' className='press w-full rounded-xl'>
          <Link to='/login'>Go to sign in</Link>
        </Button>
      </AuthStatus>
    );
  }

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title='Set a new password'
        description='Choose a new password for your account.'
      />

      <form onSubmit={handleSubmit} className='space-y-3'>
        <PasswordInput
          placeholder='New password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete='new-password'
          autoFocus
        />
        <PasswordInput
          placeholder='Confirm new password'
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          autoComplete='new-password'
        />

        {status === 'error' && (
          <p className='text-center text-sm text-destructive'>
            This reset link may have expired.{' '}
            <Link
              to='/forgot-password'
              className='font-semibold text-foreground underline underline-offset-4'
            >
              Request a new one
            </Link>
          </p>
        )}

        <AuthSubmit
          type='submit'
          loading={loading}
          loadingText='Saving...'
          disabled={loading || !password || !confirmPassword}
        >
          Save password
          <ArrowRight className='h-4 w-4' />
        </AuthSubmit>
      </form>

      <p className='mt-6 text-center text-sm'>
        <Link
          to='/login'
          className='font-semibold text-foreground underline-offset-4 hover:underline'
        >
          Back to sign in
        </Link>
      </p>
    </>
  );
};

export default ResetPassword;
