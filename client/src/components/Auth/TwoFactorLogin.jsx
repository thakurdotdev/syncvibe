import { useState } from 'react';
import { CheckCircle, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const TOTP_LENGTH = 6;
const BACKUP_CODE_LENGTH = 11;

const MODES = {
  totp: {
    description: 'Enter the 6-digit code from your authenticator app.',
    placeholder: '000000',
    toggleLabel: 'Use a backup code instead',
    normalize: (value) => value.replace(/\D/g, '').slice(0, TOTP_LENGTH),
    isComplete: (code) => code.length === TOTP_LENGTH,
    verify: (code) => authClient.twoFactor.verifyTotp({ code }),
  },
  backup: {
    description: 'Enter one of the backup codes you saved when you turned on 2FA.',
    placeholder: 'XXXXX-XXXXX',
    toggleLabel: 'Use your authenticator app instead',
    normalize: (value) => value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, BACKUP_CODE_LENGTH),
    isComplete: (code) => code.length === BACKUP_CODE_LENGTH,
    verify: (code) => authClient.twoFactor.verifyBackupCode({ code }),
  },
};

const TwoFactorLogin = ({ onSuccess, onClose }) => {
  const [modeName, setModeName] = useState('totp');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const mode = MODES[modeName];
  const canSubmit = mode.isComplete(code) && !loading && !isVerified;

  const switchMode = () => {
    setModeName((current) => (current === 'totp' ? 'backup' : 'totp'));
    setCode('');
  };

  const handleVerify = async () => {
    if (!canSubmit) return;

    setLoading(true);
    try {
      await unwrap(mode.verify(code));
      setIsVerified(true);
      await onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Invalid verification code'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') handleVerify();
  };

  return (
    <>
      <div className='mb-8'>
        <div className='flex items-center gap-2.5 mb-2'>
          <div className='p-2 rounded-xl bg-muted dark:bg-card border border-border'>
            <Shield className='w-5 h-5 text-foreground' />
          </div>
          <h1 className='text-2xl sm:text-3xl font-semibold tracking-tight text-foreground'>
            Two-Factor Auth
          </h1>
        </div>
        <p className='text-sm text-muted-foreground mt-2'>{mode.description}</p>
      </div>

      <div className='space-y-4'>
        <Input
          type='text'
          value={code}
          onChange={(event) => setCode(mode.normalize(event.target.value))}
          placeholder={mode.placeholder}
          className='text-center text-xl tracking-[0.5em] font-semibold h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
          autoComplete='one-time-code'
          disabled={loading || isVerified}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <button
          type='button'
          onClick={switchMode}
          disabled={loading || isVerified}
          className='text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors'
        >
          {mode.toggleLabel}
        </button>

        <div className='space-y-3 pt-2'>
          <Button
            onClick={handleVerify}
            disabled={!canSubmit}
            className='w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer'
          >
            {loading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                <span>Verifying...</span>
              </>
            ) : isVerified ? (
              <>
                <CheckCircle className='mr-2 h-4 w-4' />
                <span>Verified</span>
              </>
            ) : (
              <span>Verify</span>
            )}
          </Button>

          <Button
            variant='outline'
            onClick={onClose}
            className='w-full h-12 rounded-xl border border-border bg-card hover:bg-muted dark:hover:bg-raised text-foreground font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer'
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
};

export default TwoFactorLogin;
