import { API_URL } from '@/constants';
import { useUser } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Google from 'expo-auth-session/providers/google';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
      <View style={styles.outerContainer}>
        <LinearGradient
          colors={['#000000', '#121212', '#1A1A1A']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.accentOverlay, styles.accentTopRight]} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color='#6366f1' />
          <Text style={[styles.appTitle, { marginTop: 24, fontSize: 18 }]}>
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
      style={styles.outerContainer}
    >
      <LinearGradient
        colors={['#000000', '#121212', '#1A1A1A']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.accentOverlay, styles.accentTopRight]} />

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
          <View style={styles.logoWrapper}>
            <BlurView intensity={40} tint='dark' style={styles.logoBlur}>
              <Image
                source={require('../assets/syncvibe-cropped.png')}
                style={styles.logo}
                resizeMode='contain'
              />
            </BlurView>
          </View>

          <View>
            <Text style={styles.appTitle}>Welcome to SyncVibe</Text>
            <Text style={styles.appSubtitle}>Sign in to discover music</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Input
            placeholder='Email'
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            error={!!emailError}
            errorText={emailError}
            className='mb-4'
            inputStyle={{ color: '#FFFFFF' }}
          />

          <Input
            placeholder='Password'
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize='none'
            autoCorrect={false}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color='#888888'
                />
              </TouchableOpacity>
            }
            error={!!passwordError}
            errorText={passwordError}
            className='mb-6'
            inputStyle={{ color: '#FFFFFF' }}
          />

          <Button
            variant='default'
            isLoading={loading}
            onPress={handleEmailLogin}
            className='w-full py-4 rounded-xl'
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Login</Text>
          </Button>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.buttonContainer}>
          <BlurView
            intensity={20}
            tint='dark'
            style={styles.buttonBlurContainer}
            className='rounded-full'
          >
            <TouchableOpacity
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={() => {
                setError('');
                promptAsync();
              }}
              disabled={!request || loading}
              activeOpacity={0.8}
            >
              <Image source={require('../assets/images/google.png')} style={styles.googleIcon} />
              {loading ? (
                <ActivityIndicator size='small' color='#5B5B5B' />
              ) : (
                <Text style={styles.buttonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>
          </BlurView>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.footerLink}
              onPress={async () => {
                await WebBrowser.openBrowserAsync('https://syncvibe.thakur.dev/terms-of-services');
              }}
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={styles.footerLink}
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
  accentOverlay: {
    position: 'absolute',
    width: width * 0.8,
    height: height * 0.4,
    opacity: 0.15,
    borderRadius: 300,
  },
  accentTopRight: {
    top: -height * 0.05,
    right: -width * 0.2,
    backgroundColor: '#6366f1',
    transform: [{ rotate: '30deg' }],
  },
  accentBottomLeft: {
    bottom: -height * 0.05,
    left: -width * 0.2,
    backgroundColor: '#4f46e5',
    transform: [{ rotate: '-20deg' }],
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
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
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  appSubtitle: {
    fontSize: 15,
    color: '#AAAAAA',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#888888',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonBlurContainer: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    color: '#333333',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  footerText: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#6366f1',
    fontWeight: '500',
  },
});

export default LoginScreen;
