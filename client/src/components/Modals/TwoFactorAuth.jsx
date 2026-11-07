import QRCode from 'qrcode';
import { Check, Copy, Loader2, Shield, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

const STEPS = { password: 'password', scan: 'scan', backupCodes: 'backupCodes' };

/**
 * Turns on 2FA in three steps: confirm the password, scan the QR code and enter a code from the
 * app, then save the backup codes. Accounts without a password skip the first step.
 */
const TwoFactorAuth = ({ isOpen, onClose, onSuccess, hasPassword }) => {
  const [step, setStep] = useState(STEPS.password);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startSetup = async (currentPassword) => {
    setLoading(true);
    try {
      const { totpURI, backupCodes: codes } = await unwrap(
        authClient.twoFactor.enable(currentPassword ? { password: currentPassword } : {})
      );
      setQrCode(await QRCode.toDataURL(totpURI, { width: 192, margin: 1 }));
      setBackupCodes(codes);
      setPassword('');
      setStep(STEPS.scan);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to set up 2FA. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Accounts without a password go straight to the QR code.
    if (isOpen && !hasPassword && step === STEPS.password) startSetup();
  }, [isOpen, hasPassword, step]);

  const handlePasswordSubmit = (event) => {
    event.preventDefault();
    if (password) startSetup(password);
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setLoading(true);
    try {
      await unwrap(authClient.twoFactor.verifyTotp({ code }));
      setStep(STEPS.backupCodes);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Invalid verification code'));
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
  };

  const reset = () => {
    setStep(STEPS.password);
    setPassword('');
    setCode('');
    setQrCode('');
    setBackupCodes([]);
    setCopied(false);
  };

  const handleClose = () => {
    const finished = step === STEPS.backupCodes;
    reset();
    onClose();
    if (finished) onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-foreground' />
            Setup Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        {step === STEPS.password && hasPassword && (
          <form onSubmit={handlePasswordSubmit} className='space-y-4'>
            <label className='text-sm font-medium text-foreground' htmlFor='two-factor-password'>
              Enter your password to continue
            </label>
            <Input
              id='two-factor-password'
              type='password'
              autoComplete='current-password'
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              autoFocus
            />
            <Button type='submit' disabled={loading || !password} className='w-full'>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Continue
            </Button>
          </form>
        )}

        {step === STEPS.password && !hasPassword && (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-8 w-8 animate-spin text-foreground' />
          </div>
        )}

        {step === STEPS.scan && (
          <div className='space-y-6'>
            <Card>
              <CardContent className='p-4'>
                <div className='text-center space-y-4'>
                  <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                    <Smartphone className='h-4 w-4' />
                    <span>Scan QR code with your authenticator app</span>
                  </div>
                  <div className='flex justify-center'>
                    <img src={qrCode} alt='2FA QR Code' className='w-48 h-48 border rounded-lg' />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className='space-y-4'>
              <label className='text-sm font-medium text-foreground' htmlFor='two-factor-code'>
                Enter the 6-digit code from your authenticator app
              </label>
              <Input
                id='two-factor-code'
                type='text'
                inputMode='numeric'
                autoComplete='one-time-code'
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(event) => event.key === 'Enter' && handleVerify()}
                placeholder='000000'
                className='text-center text-lg tracking-widest'
                disabled={loading}
              />
              <Button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className='w-full'
              >
                {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Verify
              </Button>
            </div>
          </div>
        )}

        {step === STEPS.backupCodes && (
          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              2FA is on. Save these backup codes somewhere safe. Each one signs you in once if you
              lose access to your authenticator app.
            </p>
            <div className='grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted p-4 font-mono text-sm'>
              {backupCodes.map((backupCode) => (
                <span key={backupCode}>{backupCode}</span>
              ))}
            </div>
            <Button variant='outline' onClick={copyBackupCodes} className='w-full'>
              {copied ? <Check className='mr-2 h-4 w-4' /> : <Copy className='mr-2 h-4 w-4' />}
              {copied ? 'Copied' : 'Copy codes'}
            </Button>
            <Button onClick={handleClose} className='w-full'>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorAuth;
