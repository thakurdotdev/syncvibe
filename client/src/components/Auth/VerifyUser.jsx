import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useProfile } from '@/Context/Context';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';

const RESEND_DELAY_SECONDS = 60;

const VerifyUser = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(
    location?.state?.codeSent ? RESEND_DELAY_SECONDS : 0
  );
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState(location?.state?.email || '');
  const [showOtpInput, setShowOtpInput] = useState(!!location?.state?.email);

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  const sendOTP = useCallback(async () => {
    if (resendTimer > 0 || !email) return;

    try {
      setLoading(true);
      await unwrap(
        authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'email-verification' })
      );
      toast.success('OTP sent successfully');
      setResendTimer(RESEND_DELAY_SECONDS);
      setShowOtpInput(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [email, resendTimer]);

  // A verified code also signs the user in.
  const handleVerify = useCallback(async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      await unwrap(authClient.emailOtp.verifyEmail({ email: email.trim(), otp }));
      await getProfile();
      toast.success('Email verified successfully');
      navigate('/home', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [email, otp, navigate, getProfile]);

  return (
    <>
      <div className='mb-8'>
        <h1 className='text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-2'>
          Email Verification
        </h1>
        <p className='text-sm text-muted-foreground'>
          {showOtpInput
            ? 'Enter the 6-digit verification code sent to your email address.'
            : 'Enter your email to receive a verification code.'}
        </p>
      </div>

      <div className='flex flex-col gap-6'>
        {!showOtpInput ? (
          <div className='space-y-4'>
            <Input
              type='email'
              placeholder='Enter your email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className='h-12 px-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-transparent transition-all'
              autoComplete='email'
            />
            <Button
              onClick={sendOTP}
              disabled={loading || !email}
              className='w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer'
            >
              {loading ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <ArrowRight className='h-4 w-4' />
              )}
              <span>Get Verification Code</span>
            </Button>
          </div>
        ) : (
          <>
            <div className='flex justify-center'>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                className='gap-2 justify-center'
              >
                <InputOTPGroup className='gap-2'>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className='rounded-xl border border-border bg-card text-foreground h-12 w-12 text-center text-lg focus-visible:ring-ring focus:border-border'
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className='flex flex-col gap-4'>
              <Button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className='w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer'
              >
                {loading ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className='h-4 w-4' />
                    <span>Verify Email</span>
                  </>
                )}
              </Button>

              <div className='flex items-center justify-between text-sm mt-2'>
                <span className='text-muted-foreground'>Didn't receive the code?</span>
                <Button
                  variant='link'
                  onClick={sendOTP}
                  disabled={resendTimer > 0 || loading}
                  className='p-0 h-auto font-semibold text-foreground hover:underline transition-all'
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default VerifyUser;
