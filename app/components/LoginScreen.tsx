import PressableScale from '@/components/ui/PressableScale';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import { googleLoginErrorMessage, useGoogleLogin } from '@/hooks/useGoogleLogin';
import { authClient, unwrap } from '@/lib/auth-client';
import { isPasskeySupported, PasskeyCancelledError, signInWithPasskey } from '@/lib/passkey';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './ui/input';
import { Button } from './ui/button';
import TwoFactorLogin from './TwoFactorLogin';

const { width, height } = Dimensions.get('window');
const PROFILE_FAILED = "You're signed in, but your profile didn't load. Please try again.";

const LoginScreen = () => {
  const { getProfile } = useUser();
  const { colors, theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [show2FA, setShow2FA] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const passkeysSupported = isPasskeySupported();

  const signInWithGoogle = useGoogleLogin();

  // Signed in, but without a profile the app would still look signed out. Say so instead of
  // leaving the spinner up; signing in again is safe.
  const finishLogin = async () => {
    setIsLoggingIn(true);
    if (!(await getProfile())) throw new Error(PROFILE_FAILED);
    navigateAfterLogin();
  };

  const navigateAfterLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      if (await signInWithGoogle()) {
        setIsLoggingIn(true);
        navigateAfterLogin();
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(googleLoginErrorMessage(err));
      setIsLoggingIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setError('');
    setPasskeyLoading(true);
    try {
      await signInWithPasskey();
      await finishLogin();
    } catch (err: any) {
      if (!(err instanceof PasskeyCancelledError)) {
        setError(err.message || 'Passkey sign-in failed. Please try again.');
      }
      setIsLoggingIn(false);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const validate = () => {
    let isValid = true;
    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Email is invalid');
      isValid = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleEmailLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const result = await unwrap(authClient.signIn.email({ email, password }));

      if (result && 'twoFactorRedirect' in result && result.twoFactorRedirect) {
        setShow2FA(true);
      } else {
        await finishLogin();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      setIsLoggingIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = async () => {
    setShow2FA(false);
    try {
      await finishLogin();
    } catch (err: any) {
      setError(err.message);
      setIsLoggingIn(false);
    }
  };

  const handle2FAClose = () => {
    setShow2FA(false);
  };

  if (isLoggingIn) {
    return (
      <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text
            style={[styles.appTitle, { color: colors.foreground, marginTop: 24, fontSize: 18 }]}
          >
            Syncing your vibe...
          </Text>
        </View>
      </View>
    );
  }

  if (show2FA) {
    return <TwoFactorLogin onSuccess={handle2FASuccess} onClose={handle2FAClose} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.outerContainer, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom + 80, 100),
          },
        ]}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <View
            style={[
              styles.logoWrapper,
              {
                borderColor: colors.border,
                backgroundColor: theme === 'light' ? '#FFFFFF' : colors.card,
                shadowColor: colors.primary,
              },
            ]}
          >
            <BlurView intensity={theme === 'light' ? 10 : 40} tint={theme} style={styles.logoBlur}>
              <Image
                source={require('../assets/syncvibe.png')}
                style={styles.logo}
                resizeMode='contain'
                fadeDuration={0}
              />
            </BlurView>
          </View>

          <View>
            <Text style={[styles.appTitle, { color: colors.foreground }]}>Welcome to SyncVibe</Text>
            <Text style={[styles.appSubtitle, { color: colors.mutedForeground }]}>
              Sign in to discover music
            </Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Input
            variant='outline'
            placeholder='Email'
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='username'
            textContentType='username'
            error={!!emailError}
            errorText={emailError}
            className='mb-4'
            inputStyle={{ color: colors.foreground }}
          />

          <Input
            variant='outline'
            placeholder='Password'
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete='password'
            textContentType='password'
            rightIcon={
              <PressableScale onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.mutedForeground}
                />
              </PressableScale>
            }
            error={!!passwordError}
            errorText={passwordError}
            className='mb-6'
            inputStyle={{ color: colors.foreground }}
          />

          <Button
            variant='default'
            isLoading={loading}
            onPress={handleEmailLogin}
            className='w-full py-4 rounded-xl'
            textStyle={{ fontWeight: '600', fontSize: 16 }}
          >
            Login
          </Button>
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.buttonContainer}>
          <PressableScale
            style={[
              styles.googleButton,
              {
                backgroundColor: theme === 'light' ? colors.secondary : colors.card,
                borderColor: colors.border,
              },
              loading && styles.buttonDisabled,
            ]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Image
              source={require('../assets/images/google.png')}
              style={styles.googleIcon}
              fadeDuration={0}
            />
            {loading ? (
              <ActivityIndicator size='small' color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            )}
          </PressableScale>

          {passkeysSupported && (
            <PressableScale
              style={[
                styles.googleButton,
                styles.secondaryButton,
                {
                  backgroundColor: theme === 'light' ? colors.secondary : colors.card,
                  borderColor: colors.border,
                },
                passkeyLoading && styles.buttonDisabled,
              ]}
              onPress={handlePasskeySignIn}
              disabled={loading || passkeyLoading}
              accessibilityRole='button'
              accessibilityLabel='Continue with passkey'
            >
              <Ionicons
                name='finger-print'
                size={20}
                color={colors.foreground}
                style={styles.googleIcon}
              />
              {passkeyLoading ? (
                <ActivityIndicator size='small' color={colors.mutedForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.foreground }]}>
                  Continue with passkey
                </Text>
              )}
            </PressableScale>
          )}

          {error ? (
            <View
              style={[
                styles.errorContainer,
                {
                  backgroundColor: theme === 'light' ? '#FEE2E2' : 'rgba(239, 68, 68, 0.15)',
                  borderColor: colors.destructive,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            By continuing, you agree to our{' '}
            <Text
              style={[styles.footerLink, { color: colors.primary }]}
              onPress={async () => {
                await WebBrowser.openBrowserAsync('https://syncvibe.thakur.dev/terms-of-services');
              }}
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={[styles.footerLink, { color: colors.primary }]}
              onPress={async () => {
                await WebBrowser.openBrowserAsync('https://syncvibe.thakur.dev/privacy-policy');
              }}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 50,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  appSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  formContainer: {
    width: '100%',
    marginVertical: 10,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 14,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButton: {
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    width: '100%',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    fontWeight: '500',
  },
});

export default LoginScreen;
