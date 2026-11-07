import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { AuthHeader, AuthStatus, AuthSubmit, authInputClass, TextAction } from './AuthUI';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = 'SyncVibe - Forgot Password';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await unwrap(
        authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        })
      );
      setSent(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthStatus
        icon={Mail}
        title='Check your email'
        description={`If an account exists for ${email.trim()}, we've sent a password reset link. It expires in 1 hour.`}
      >
        <Button asChild variant='outline' size='lg' className='press w-full rounded-xl'>
          <Link to='/login'>Back to sign in</Link>
        </Button>
        <p className='mt-4 text-sm text-muted-foreground'>
          Didn&apos;t get it? Check your spam folder or{' '}
          <TextAction onClick={() => setSent(false)} className='text-foreground'>
            try again
          </TextAction>
        </p>
      </AuthStatus>
    );
  }

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title='Forgot your password?'
        description="Enter your account's email and we'll send you a link to set a new one."
      />

      <form onSubmit={handleSubmit} className='space-y-3'>
        <Input
          type='email'
          placeholder='Email'
          aria-label='Email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete='email'
          className={authInputClass}
        />
        <AuthSubmit
          type='submit'
          loading={loading}
          loadingText='Sending...'
          disabled={loading || !email.trim()}
        >
          Send reset link
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

export default ForgotPassword;
