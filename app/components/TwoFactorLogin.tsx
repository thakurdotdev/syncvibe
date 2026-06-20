import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { API_URL } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TwoFactorLoginProps {
  userId: string | null;
  onSuccess: (token: string) => void;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const TwoFactorLogin = ({ userId, onSuccess, onClose }: TwoFactorLoginProps) => {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.post(`${API_URL}/api/2fa/verify`, {
        userId: userId,
        token: otp,
      });

      if (response.status === 200) {
        setIsVerified(true);
        setTimeout(() => {
          onSuccess(response.data.token);
        }, 1000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
  };

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
              <Ionicons name='shield-checkmark-sharp' size={40} color='#6366f1' />
            </BlurView>
          </View>

          <View>
            <Text style={styles.appTitle}>Two-Factor Verification</Text>
            <Text style={styles.appSubtitle}>Enter the 6-digit code from your authenticator app</Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Input
            placeholder='000000'
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType='number-pad'
            maxLength={6}
            editable={!loading && !isVerified}
            textAlign='center'
            inputStyle={{
              fontSize: 24,
              letterSpacing: 8,
              color: '#FFFFFF',
            }}
            error={!!error}
            errorText={error}
            className='mb-6'
          />

          <Button
            variant='default'
            disabled={loading || otp.length !== 6 || isVerified}
            onPress={handleVerify}
            className='w-full py-4 rounded-xl'
          >
            {loading ? (
              <ActivityIndicator size='small' color='#FFFFFF' />
            ) : isVerified ? (
              <Ionicons name='checkmark-circle' size={20} color='#FFFFFF' />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Verify</Text>
            )}
          </Button>

          <Button
            variant='outline'
            disabled={loading}
            onPress={onClose}
            className='w-full py-4 rounded-xl mt-3'
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
          </Button>
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
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
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

export default TwoFactorLogin;
