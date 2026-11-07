import { Input } from '@/components/ui/input';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useProfile } from '@/Context/Context';
import { authClient, getErrorMessage, unwrap } from '@/lib/auth-client';
import { AuthHeader, AuthSubmit, authInputClass, OtpField, TextAction } from './AuthUI';

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
      <AuthHeader
        icon={MailCheck}
        title='Verify your email'
        description={
          showOtpInput
            ? `Enter the 6-digit code we sent to ${email.trim() || 'your email'}.`
            : 'Enter your email and we will send you a verification code.'
        }
      />

      {!showOtpInput ? (
        <form
          className='space-y-3'
          onSubmit={(event) => {
            event.preventDefault();
            sendOTP();
          }}
        >
          <Input
            type='email'
            placeholder='Email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className={authInputClass}
            autoComplete='email'
          />
          <AuthSubmit type='submit' loading={loading} disabled={loading || !email}>
            Send code
            <ArrowRight className='h-4 w-4' />
          </AuthSubmit>
        </form>
      ) : (
        <div className='space-y-6'>
          <OtpField value={otp} onChange={setOtp} autoFocus />

          <AuthSubmit
            onClick={handleVerify}
            loading={loading}
            loadingText='Verifying...'
            disabled={loading || otp.length !== 6}
          >
            Verify email
          </AuthSubmit>

          <div className='flex items-center justify-center gap-1.5 text-sm text-muted-foreground'>
            Didn't get it?
            <TextAction
              onClick={sendOTP}
              disabled={resendTimer > 0 || loading}
              className='text-foreground'
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </TextAction>
          </div>
        </div>
      )}
    </>
  );
};

export default VerifyUser;
