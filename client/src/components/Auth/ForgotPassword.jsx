import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { AuthSubmit, authInputClass, TextAction } from './AuthUI';

const ForgotPassword = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { message } = await unwrap(
        authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        })
      );
      setSent(true);
      toast.success(message);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (value) => {
    setOpen(value);
    if (!value) {
      setEmail('');
      setSent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <TextAction>Forgot password?</TextAction>
      </DialogTrigger>
      <DialogContent className='rounded-2xl sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{sent ? 'Check your email' : 'Reset your password'}</DialogTitle>
          <DialogDescription>
            {sent
              ? "We've sent a password reset link to your email. It expires in 1 hour."
              : "Enter the email associated with your account and we'll send you a reset link."}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className='flex flex-col items-center gap-4 py-4'>
            <span className='grid h-14 w-14 place-items-center rounded-2xl border bg-raised'>
              <Mail className='h-6 w-6' />
            </span>
            <p className='text-sm text-muted-foreground text-center'>
              Didn't receive the email? Check your spam folder or{' '}
              <TextAction onClick={() => setSent(false)} className='text-foreground'>
                try again
              </TextAction>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-4'>
            <Input
              type='email'
              placeholder='Enter your email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete='email'
              className={authInputClass}
              autoFocus
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPassword;
