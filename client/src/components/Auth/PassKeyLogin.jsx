import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/Context/Context';
import {
  authClient,
  getErrorMessage,
  getSafeReturnPath,
  isPasskeyCancelled,
} from '@/lib/auth-client';
import { AlertCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export const PasskeyLogin = () => {
  const { getProfile } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnPath = getSafeReturnPath(searchParams.get('returnTo'));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // The browser lists the passkeys saved for this site, so no email is needed.
  const handleLogin = async () => {
    setIsLoading(true);
    setError('');

    const { data, error: signInError } = await authClient.signIn.passkey();

    if (data) {
      await getProfile();
      toast.success('Login successful!');
      navigate(returnPath);
      return;
    }

    setError(
      isPasskeyCancelled(signInError)
        ? 'Authentication was cancelled. Please try again.'
        : getErrorMessage(signInError, 'Passkey sign-in failed. Please try again.')
    );
    setIsLoading(false);
  };

  return (
    <>
      <div className='mb-8'>
        <div className='flex items-center gap-2.5 mb-2'>
          <div className='p-2 rounded-xl bg-muted dark:bg-card border border-border'>
            <KeyRound className='w-5 h-5 text-foreground' />
          </div>
          <h1 className='text-2xl sm:text-3xl font-semibold tracking-tight text-foreground'>
            Login with Passkey
          </h1>
        </div>
        <p className='text-sm text-muted-foreground mt-2'>
          Use your device's biometric authentication (Face ID, Touch ID, Windows Hello) or security
          key to sign in securely.
        </p>
      </div>

      <div className='space-y-4'>
        {error && (
          <Alert
            variant='destructive'
            className='rounded-xl border-destructive/50 bg-destructive/50 dark:bg-destructive/20'
          >
            <AlertCircle className='h-4 w-4' />
            <AlertDescription className='text-xs'>{error}</AlertDescription>
          </Alert>
        )}

        <div className='space-y-3 pt-2'>
          <Button
            type='button'
            onClick={handleLogin}
            className='w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer'
            disabled={isLoading}
          >
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
            variant='outline'
            className='w-full h-12 rounded-xl border border-border bg-card hover:bg-muted dark:hover:bg-raised text-foreground font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer'
            onClick={() => navigate('/login')}
          >
            Login with Password
          </Button>
        </div>
      </div>

      <p className='text-xs text-muted-foreground text-center mt-6'>
        Passkeys provide a more secure, phishing-resistant way to sign in without passwords.
      </p>
    </>
  );
};

export default PasskeyLogin;
