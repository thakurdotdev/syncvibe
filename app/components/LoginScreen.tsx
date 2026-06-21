import { API_URL } from '@/constants';
import { useUser } from '@/context/UserContext';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Google from 'expo-auth-session/providers/google';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
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

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

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
  const [twoFactorUserId, setTwoFactorUserId] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: '752661424495-r0jl8s9kc6h4dsvd9ur121hci61vnch9.apps.googleusercontent.com',
    webClientId: '752661424495-hdf62mg8mfuje1c2f5pkoimj2rch0hjl.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      setLoading(true);
      const { authentication } = response;
      handleSignInWithGoogle(authentication?.accessToken);
    } else if (response?.type === 'error') {
      console.error('Auth Error:', response.error);
      setError(`Authentication error: ${response.error?.message || 'Unknown error'}`);
    }
  }, [response]);

  const handleSignInWithGoogle = async (accessToken: string | undefined) => {
    try {
      if (!accessToken) {
        throw new Error('No access token received');
      }

      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        throw new Error(`Google API error (${userInfoResponse.status}): ${errorText}`);
      }

      const googleUserInfo = await userInfoResponse.json();

      const backendResponse = await axios.post(`${API_URL}/api/auth/google/mobile`, {
        user: googleUserInfo,
      });

      const token = backendResponse.data.token;
      await AsyncStorage.setItem('token', token);

      setIsLoggingIn(true);
      await getProfile();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setError(`Authentication failed: ${error.message}`);
      setIsLoggingIn(false);
    } finally {
      setLoading(false);
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
      const response = await axios.post(`${API_URL}/api/login`, {
        email,
        password,
      });

      if (response.status === 200) {
        if (response.data.twoFactorRequired) {
          setTwoFactorUserId(response.data.userId);
          setShow2FA(true);
        } else {
          const token = response.data.token;
          await AsyncStorage.setItem('token', token);
          setIsLoggingIn(true);
          await getProfile();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setIsLoggingIn(false);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = async (token: string) => {
    setShow2FA(false);
    setTwoFactorUserId(null);
    await AsyncStorage.setItem('token', token);
    setIsLoggingIn(true);
    try {
      await getProfile();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch profile. Please try again.');
      setIsLoggingIn(false);
    }
  };

  const handle2FAClose = () => {
    setShow2FA(false);
    setTwoFactorUserId(null);
  };

  if (isLoggingIn) {
    return (
      <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text style={[styles.appTitle, { color: colors.foreground, marginTop: 24, fontSize: 18 }]}>
            Syncing your vibe...
          </Text>
        </View>
      </View>
    );
  }

  if (show2FA) {
    return (
      <TwoFactorLogin
        userId={twoFactorUserId}
        onSuccess={handle2FASuccess}
        onClose={handle2FAClose}
      />
    );
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
                source={require('../assets/syncvibe-cropped.png')}
                style={styles.logo}
                resizeMode='contain'
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
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
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
          <TouchableOpacity
            style={[
              styles.googleButton,
              {
                backgroundColor: theme === 'light' ? colors.secondary : colors.card,
                borderColor: colors.border,
              },
              loading && styles.buttonDisabled,
            ]}
            onPress={() => {
              setError('');
              promptAsync();
            }}
            disabled={!request || loading}
            activeOpacity={0.8}
          >
            <Image source={require('../assets/images/google.png')} style={styles.googleIcon} />
            {loading ? (
              <ActivityIndicator size='small' color={colors.mutedForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            )}
          </TouchableOpacity>

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
