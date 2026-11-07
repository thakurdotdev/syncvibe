import { useState } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { CheckCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import {
  AuthHeader,
  AuthSecondary,
  AuthSubmit,
  authInputClass,
  OtpField,
  TextAction,
} from './AuthUI';

const TOTP_LENGTH = 6;
const BACKUP_CODE_LENGTH = 11;

const MODES = {
  totp: {
    description: 'Enter the 6-digit code from your authenticator app.',
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

  const handleSubmit = (event) => {
    event.preventDefault();
    handleVerify();
  };

  return (
    <>
      <AuthHeader icon={ShieldCheck} title='Two-step verification' description={mode.description} />

      <form onSubmit={handleSubmit} className='space-y-6'>
        {modeName === 'totp' ? (
          <OtpField
            value={code}
            onChange={setCode}
            pattern={REGEXP_ONLY_DIGITS}
            disabled={loading || isVerified}
            autoFocus
          />
        ) : (
          <Input
            value={code}
            onChange={(event) => setCode(mode.normalize(event.target.value))}
            placeholder={mode.placeholder}
            className={cn(authInputClass, 'text-center font-mono text-lg tracking-[0.2em]')}
            autoComplete='one-time-code'
            disabled={loading || isVerified}
            autoFocus
          />
        )}

        <div className='space-y-3'>
          <AuthSubmit
            type='submit'
            loading={loading}
            loadingText='Verifying...'
            disabled={!canSubmit}
          >
            {isVerified ? (
              <>
                <CheckCircle className='h-4 w-4' />
                Verified
              </>
            ) : (
              'Verify'
            )}
          </AuthSubmit>
          <AuthSecondary type='button' onClick={onClose} disabled={loading}>
            Back to sign in
          </AuthSecondary>
        </div>

        <div className='text-center'>
          <TextAction onClick={switchMode} disabled={loading || isVerified}>
            {mode.toggleLabel}
          </TextAction>
        </div>
      </form>
    </>
  );
};

export default TwoFactorLogin;
