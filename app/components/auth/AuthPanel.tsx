import { CachedImage } from '@/components/ui/CachedImage';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { googleLoginErrorMessage, useGoogleLogin } from '@/hooks/useGoogleLogin';
import { LANGUAGES } from '@/lib/languages';
import { isPasskeySupported, PasskeyCancelledError, signInWithPasskey } from '@/lib/passkey';
import { typography } from '@/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { FormError, LegalNote, ProviderButton, SwitchLink } from './AuthBits';
import { RegisterForm, SignInForm, TwoFactorForm, VerifyForm } from './EmailForms';

const RING_MS = 2700;
const RING_COUNT = 3;
const LOGO_SIZE = 88;
const PROFILE_FAILED = "You're signed in, but your profile didn't load. Please try again.";

type Step =
  | { name: 'choose' }
  | { name: 'signin' }
  | { name: 'register' }
  | { name: 'verify'; email: string }
  | { name: 'two-factor' };

const Ring = memo(function Ring({ index, active }: { index: number; active: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    progress.set(0);
    progress.set(
      withDelay(
        (index * RING_MS) / RING_COUNT,
        withRepeat(withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.quad) }), -1)
      )
    );
    return () => cancelAnimation(progress);
  }, [active, index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - progress.get()),
    transform: [{ scale: 1 + progress.get() * 0.9 }],
  }));

  return <Animated.View style={[styles.ring, { borderColor: colors.foreground }, style]} />;
});

const summarise = (selected: Set<string>) => {
  const names = LANGUAGES.filter(({ id }) => selected.has(id)).map(({ label }) => label);
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
};

interface AuthPanelProps {
  /** Runs the logo animation only while this is on screen. */
  active: boolean;
  /** Languages picked during onboarding, shown as a reminder. */
  languages?: Set<string>;
  /** True while an email step is open, so the onboarding pager can stop swiping. */
  onFormOpenChange?: (open: boolean) => void;
}

/**
 * The only way into the app: Google, passkey, email sign-in and creating an account. It never
 * navigates itself; once a profile loads, the auth gate in app/_layout.tsx opens the app.
 */
export function AuthPanel({ active, languages, onFormOpenChange }: AuthPanelProps) {
  const { colors } = useTheme();
  const { getProfile } = useUser();
  const signInWithGoogle = useGoogleLogin();
  const passkeys = isPasskeySupported();
  const [step, setStep] = useState<Step>({ name: 'choose' });
  const [busy, setBusy] = useState<'google' | 'passkey' | null>(null);
  const [error, setError] = useState('');

  const formOpen = step.name !== 'choose';
  useEffect(() => onFormOpenChange?.(formOpen), [formOpen, onFormOpenChange]);

  const back = useCallback(() => {
    setStep((current) => (current.name === 'verify' ? { name: 'register' } : { name: 'choose' }));
  }, []);

  // Registered after the onboarding screen's own handler, so it runs first.
  useEffect(() => {
    if (!formOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [formOpen, back]);

  const completeSignIn = useCallback(async () => {
    if (!(await getProfile())) throw new Error(PROFILE_FAILED);
  }, [getProfile]);

  const handleGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(googleLoginErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handlePasskey = async () => {
    setError('');
    setBusy('passkey');
    try {
      await signInWithPasskey();
      await completeSignIn();
    } catch (err) {
      if (!(err instanceof PasskeyCancelledError)) {
        setError((err as Error).message || 'Passkey sign-in failed. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  if (formOpen) {
    return (
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.form}
      >
        <Animated.View key={step.name} entering={FadeIn.duration(200)}>
          {step.name === 'signin' && (
            <SignInForm
              onBack={back}
              onRegister={() => setStep({ name: 'register' })}
              onTwoFactor={() => setStep({ name: 'two-factor' })}
              completeSignIn={completeSignIn}
            />
          )}
          {step.name === 'register' && (
            <RegisterForm
              onBack={back}
              onSignIn={() => setStep({ name: 'signin' })}
              onCodeSent={(email) => setStep({ name: 'verify', email })}
            />
          )}
          {step.name === 'verify' && (
            <VerifyForm email={step.email} onBack={back} completeSignIn={completeSignIn} />
          )}
          {step.name === 'two-factor' && (
            <TwoFactorForm onBack={back} completeSignIn={completeSignIn} />
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
    );
  }

  const tuned = languages && languages.size > 0 ? summarise(languages) : '';

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoStage}>
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <Ring key={index} index={index} active={active} />
          ))}
          <CachedImage
            source={require('../../assets/syncvibe.png')}
            style={styles.logo}
            contentFit='contain'
            accessibilityIgnoresInvertColors
          />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Keep your vibe with you</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in or create an account to save playlists and history, and to listen with friends in
          rooms.
        </Text>
        {tuned ? (
          <View style={[styles.tuned, { backgroundColor: colors.raised }]}>
            <Text style={[styles.tunedText, { color: colors.foreground }]}>Tuned to {tuned}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <FormError message={error} />
        <ProviderButton
          label='Continue with Google'
          loading={busy === 'google'}
          disabled={busy !== null}
          onPress={handleGoogle}
          icon={
            <CachedImage
              source={require('../../assets/images/google.png')}
              style={styles.providerImage}
            />
          }
        />
        {passkeys && (
          <ProviderButton
            label='Continue with passkey'
            loading={busy === 'passkey'}
            disabled={busy !== null}
            onPress={handlePasskey}
            icon={<Ionicons name='finger-print' size={20} color={colors.foreground} />}
          />
        )}
        <ProviderButton
          label='Continue with email'
          disabled={busy !== null}
          onPress={() => {
            setError('');
            setStep({ name: 'signin' });
          }}
          icon={<Ionicons name='mail-outline' size={20} color={colors.foreground} />}
        />
        <SwitchLink
          prompt='New to SyncVibe?'
          action='Create an account'
          disabled={busy !== null}
          onPress={() => {
            setError('');
            setStep({ name: 'register' });
          }}
        />
        <LegalNote />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  form: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 1.5,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },
  title: {
    ...typography.displayLg,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMd,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  tuned: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tunedText: {
    ...typography.labelMd,
  },
  actions: {
    gap: 10,
  },
  providerImage: {
    width: 20,
    height: 20,
  },
});
