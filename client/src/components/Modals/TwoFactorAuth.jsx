import axios from 'axios';
import { CheckCircle, Loader2, Shield, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

const TwoFactorAuth = ({ isOpen, onClose, userId, onSuccess, isSetup = false }) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (isOpen && isSetup) {
      setup2FA();
    }
  }, [isOpen, isSetup]);

  const setup2FA = async () => {
    try {
      setSetupLoading(true);
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/2fa/setup`,
        {},
        { withCredentials: true }
      );

      if (response.status === 200) {
        setQrCode(response.data.qrCode);
      }
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      toast.error('Failed to setup 2FA. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/2fa/verify`,
        {
          userId: userId,
          token: otp,
        },
        { withCredentials: true }
      );

      if (response.status === 200) {
        toast.success(isSetup ? '2FA enabled successfully!' : 'Login successful!');
        setIsEnabled(true);
        setTimeout(() => {
          onSuccess(response.data.token);
          onClose();
        }, 1000);
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      toast.error(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOtp('');
    setQrCode('');
    setIsEnabled(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-blue-500' />
            {isSetup ? 'Setup Two-Factor Authentication' : 'Two-Factor Authentication'}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          {isSetup && (
            <Card>
              <CardContent className='p-4'>
                <div className='text-center space-y-4'>
                  <div className='flex items-center justify-center gap-2 text-sm text-gray-600'>
                    <Smartphone className='h-4 w-4' />
                    <span>Scan QR code with your authenticator app</span>
                  </div>

                  {setupLoading ? (
                    <div className='flex items-center justify-center py-8'>
                      <Loader2 className='h-8 w-8 animate-spin text-blue-500' />
                    </div>
                  ) : qrCode ? (
                    <div className='flex justify-center'>
                      <img src={qrCode} alt='2FA QR Code' className='w-48 h-48 border rounded-lg' />
                    </div>
                  ) : (
                    <div className='py-8 text-center text-gray-500'>Failed to generate QR code</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-gray-700'>
                {isSetup
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter verification code'}
              </label>
              <Input
                type='text'
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder='000000'
                className='mt-2 text-center text-lg tracking-widest'
                maxLength={6}
                disabled={loading || isEnabled}
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={loading || otp.length !== 6 || isEnabled}
              className='w-full'
            >
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Verifying...
                </>
              ) : isEnabled ? (
                <>
                  <CheckCircle className='mr-2 h-4 w-4' />
                  Verified
                </>
              ) : (
                'Verify'
              )}
            </Button>

            {isSetup && (
              <p className='text-xs text-gray-500 text-center'>
                After verification, 2FA will be enabled for your account
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorAuth;
