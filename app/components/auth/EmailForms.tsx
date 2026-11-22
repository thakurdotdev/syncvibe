import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { authClient, unwrap } from '@/lib/auth-client';
import { typography } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormError, FormHeader, openForgotPassword, SwitchLink } from './AuthBits';

// Same rules as the server (server/src/features/auth/sign-up-policy.ts), checked here first.
const NAME_PATTERN = /^[a-zA-Z\s]{2,50}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const RESEND_SECONDS = 60;

const messageOf = (error: unknown, fallback: string) =>
  (error as { message?: string })?.message || fallback;

/** Loads the profile after Better Auth stored the session; the auth gate then opens the app. */
export type CompleteSignIn = () => Promise<void>;

const Field = forwardRef<TextInput, InputProps>(({ inputStyle, ...props }, ref) => {
  const { colors } = useTheme();
  return (
    <Input
      ref={ref}
      variant='filled'
      size='lg'
      autoCapitalize='none'
      autoCorrect={false}
      {...props}
      inputStyle={[{ color: colors.foreground }, inputStyle]}
    />
  );
});
Field.displayName = 'Field';

const PasswordField = forwardRef<TextInput, InputProps>((props, ref) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      secureTextEntry={!visible}
      rightIcon={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          accessibilityRole='button'
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.mutedForeground}
          />
        </Pressable>
      }
      {...props}
    />
  );
});
PasswordField.displayName = 'PasswordField';

interface SignInFormProps {
  onBack: () => void;
  onRegister: () => void;
  onTwoFactor: () => void;
  completeSignIn: CompleteSignIn;
}

export function SignInForm({ onBack, onRegister, onTwoFactor, completeSignIn }: SignInFormProps) {
  const { colors } = useTheme();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setError('');
    setLoading(true);
    try {
      const result = await unwrap(authClient.signIn.email({ email: trimmed, password }));
      if (result && 'twoFactorRedirect' in result && result.twoFactorRedirect) {
        onTwoFactor();
      } else {
        await completeSignIn();
      }
    } catch (err) {
      setError(messageOf(err, 'Sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <FormHeader
        title='Welcome back'
        subtitle='Sign in with your email and password.'
        onBack={onBack}
      />
      <View style={styles.fields}>
        <Field
          placeholder='Email'
          value={email}
          onChangeText={setEmail}
          keyboardType='email-address'
          autoComplete='email'
          textContentType='username'
          returnKeyType='next'
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!loading}
        />
        <PasswordField
          ref={passwordRef}
          placeholder='Password'
          value={password}
          onChangeText={setPassword}
          autoComplete='password'
          textContentType='password'
          returnKeyType='go'
          onSubmitEditing={submit}
          editable={!loading}
        />
      </View>
      <Pressable
        onPress={openForgotPassword}
        hitSlop={8}
        accessibilityRole='link'
        style={styles.forgot}
      >
        <Text style={[styles.forgotText, { color: colors.mutedForeground }]}>Forgot password?</Text>
      </Pressable>
      <View style={styles.actions}>
        <FormError message={error} />
        <Button size='lg' isLoading={loading} disabled={loading} onPress={submit}>
          Sign in
        </Button>
        <SwitchLink
          prompt='New to SyncVibe?'
          action='Create an account'
          onPress={onRegister}
          disabled={loading}
        />
      </View>
    </View>
  );
}

interface RegisterFormProps {
  onBack: () => void;
  onSignIn: () => void;
  /** The account exists and a code is on its way to this address. */
  onCodeSent: (email: string) => void;
}

export function RegisterForm({ onBack, onSignIn, onCodeSent }: RegisterFormProps) {
  const { colors } = useTheme();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!NAME_PATTERN.test(trimmedName)) {
      return setError('Use 2 to 50 letters and spaces for your name.');
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) return setError('Enter a valid email address.');
    if (!PASSWORD_PATTERN.test(password)) {
      return setError(
        'Use 8 or more characters with an uppercase and a lowercase letter, a number and one of @$!%*?&.'
      );
    }
    setError('');
    setLoading(true);
    try {
      await unwrap(authClient.signUp.email({ name: trimmedName, email: trimmedEmail, password }));
      onCodeSent(trimmedEmail);
    } catch (err) {
      setError(messageOf(err, 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <FormHeader
        title='Create your account'
        subtitle='Save playlists, keep your history and listen with friends in rooms.'
        onBack={onBack}
      />
      <View style={styles.fields}>
        <Field
          placeholder='Name'
          value={name}
          onChangeText={setName}
          autoCapitalize='words'
          autoComplete='name'
          textContentType='name'
          returnKeyType='next'
          onSubmitEditing={() => emailRef.current?.focus()}
          editable={!loading}
        />
        <Field
          ref={emailRef}
          placeholder='Email'
          value={email}
          onChangeText={setEmail}
          keyboardType='email-address'
          autoComplete='email'
          textContentType='emailAddress'
          returnKeyType='next'
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!loading}
        />
        <PasswordField
          ref={passwordRef}
          placeholder='Password'
          value={password}
          onChangeText={setPassword}
          autoComplete='new-password'
          textContentType='newPassword'
          returnKeyType='go'
          onSubmitEditing={submit}
          editable={!loading}
        />
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        At least 8 characters, with upper and lower case, a number and a symbol.
      </Text>
      <View style={styles.actions}>
        <FormError message={error} />
        <Button size='lg' isLoading={loading} disabled={loading} onPress={submit}>
          Create account
        </Button>
        <SwitchLink
          prompt='Already have an account?'
          action='Sign in'
          onPress={onSignIn}
          disabled={loading}
        />
      </View>
    </View>
  );
}

/** A code field: digits only for email and authenticator codes, letters too for backup codes. */
function CodeField({
  value,
  onChange,
  onSubmit,
  backup = false,
  editable,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  backup?: boolean;
  editable: boolean;
}) {
  return (
    <Field
      placeholder={backup ? 'Backup code' : '000000'}
      value={value}
      onChangeText={(text) =>
        onChange(
          backup
            ? text.replace(/[^A-Za-z0-9-]/g, '').slice(0, 24)
            : text.replace(/\D/g, '').slice(0, 6)
        )
      }
      keyboardType={backup ? 'default' : 'number-pad'}
      autoComplete={backup ? 'off' : 'one-time-code'}
      textContentType='oneTimeCode'
      returnKeyType='go'
      onSubmitEditing={onSubmit}
      editable={editable}
      inputStyle={[styles.code, backup && styles.backupCode]}
    />
  );
}

interface VerifyFormProps {
  email: string;
  onBack: () => void;
  completeSignIn: CompleteSignIn;
}

/** A verified code also signs the new account in (autoSignInAfterVerification). */
export function VerifyForm({ email, onBack, completeSignIn }: VerifyFormProps) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Sign-up has just sent the first code.
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const verify = async () => {
    if (code.length !== 6) return setError('Enter the 6-digit code from your email.');
    setError('');
    setLoading(true);
    try {
      await unwrap(authClient.emailOtp.verifyEmail({ email, otp: code }));
      await completeSignIn();
    } catch (err) {
      setError(messageOf(err, 'That code didn’t work. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    try {
      await unwrap(authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' }));
      setNotice('A new code is on its way.');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(messageOf(err, 'Could not send a new code. Please try again.'));
    }
  };

  return (
    <View>
      <FormHeader
        title='Check your email'
        subtitle={`Enter the 6-digit code we sent to ${email}.`}
        onBack={onBack}
      />
      <CodeField value={code} onChange={setCode} onSubmit={verify} editable={!loading} />
      <View style={styles.actions}>
        <FormError message={error} />
        {notice && !error ? (
          <Text style={[styles.notice, { color: colors.mutedForeground }]}>{notice}</Text>
        ) : null}
        <Button
          size='lg'
          isLoading={loading}
          disabled={loading || code.length !== 6}
          onPress={verify}
        >
          Verify and continue
        </Button>
        {wait > 0 ? (
          <Text style={[styles.notice, { color: colors.mutedForeground }]}>
            Resend code in {wait}s
          </Text>
        ) : (
          <SwitchLink
            prompt='Didn’t get it?'
            action='Send a new code'
            onPress={resend}
            disabled={loading}
          />
        )}
      </View>
    </View>
  );
}

interface TwoFactorFormProps {
  onBack: () => void;
  completeSignIn: CompleteSignIn;
}

/** Second step after a password, for accounts with an authenticator app. */
export function TwoFactorForm({ onBack, completeSignIn }: TwoFactorFormProps) {
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const complete = backup ? code.length >= 8 : code.length === 6;

  const verify = async () => {
    if (!complete) {
      return setError(backup ? 'Enter a backup code.' : 'Enter the 6-digit code.');
    }
    setError('');
    setLoading(true);
    try {
      // The two-factor cookie from the password step identifies this sign-in.
      await unwrap(
        backup
          ? authClient.twoFactor.verifyBackupCode({ code })
          : authClient.twoFactor.verifyTotp({ code })
      );
      await completeSignIn();
    } catch (err) {
      setError(messageOf(err, 'That code didn’t work. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <FormHeader
        title='Two-step verification'
        subtitle={
          backup
            ? 'Enter one of the backup codes you saved.'
            : 'Enter the 6-digit code from your authenticator app.'
        }
        onBack={onBack}
      />
      <CodeField
        key={backup ? 'backup' : 'totp'}
        value={code}
        onChange={setCode}
        onSubmit={verify}
        backup={backup}
        editable={!loading}
      />
      <View style={styles.actions}>
        <FormError message={error} />
        <Button size='lg' isLoading={loading} disabled={loading || !complete} onPress={verify}>
          Verify
        </Button>
        <SwitchLink
          prompt={backup ? 'Have your app?' : 'No access to your app?'}
          action={backup ? 'Use a code' : 'Use a backup code'}
          onPress={() => {
            setBackup((b) => !b);
            setCode('');
            setError('');
          }}
          disabled={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: 12,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    ...typography.labelMd,
  },
  hint: {
    ...typography.caption,
    marginTop: 10,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
  notice: {
    ...typography.bodySm,
    textAlign: 'center',
    paddingVertical: 8,
  },
  code: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 10,
    fontWeight: '600',
  },
  backupCode: {
    fontSize: 18,
    letterSpacing: 2,
  },
});
