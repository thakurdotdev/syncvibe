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
import * as WebBrowser from 'expo-web-browser';
import { authClient, unwrap } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';

interface TwoFactorLoginProps {
  /** Called once the code is accepted and the session cookie is stored. */
  onSuccess: () => void;
  onClose: () => void;
}

const { width, height } = Dimensions.get('window');

export const TwoFactorLogin = ({ onSuccess, onClose }: TwoFactorLoginProps) => {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const isCodeComplete = useBackupCode ? otp.length >= 8 : otp.length === 6;

  const handleVerify = async () => {
    if (!isCodeComplete) {
      setError(useBackupCode ? 'Please enter a backup code' : 'Please enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // The two-factor cookie set by the password step identifies the pending sign-in.
      await unwrap(
        useBackupCode
          ? authClient.twoFactor.verifyBackupCode({ code: otp })
          : authClient.twoFactor.verifyTotp({ code: otp })
      );

      setIsVerified(true);
      setTimeout(onSuccess, 1000);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string) => {
    const cleaned = useBackupCode
      ? text.replace(/[^A-Za-z0-9-]/g, '').slice(0, 24)
      : text.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
  };

  const toggleBackupCode = () => {
    setUseBackupCode((prev) => !prev);
    setOtp('');
    setError('');
  };

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
              <Ionicons name='shield-checkmark-sharp' size={40} color={colors.primary} />
            </BlurView>
          </View>

          <View>
            <Text style={[styles.appTitle, { color: colors.foreground }]}>
              Two-Factor Verification
            </Text>
            <Text style={[styles.appSubtitle, { color: colors.mutedForeground }]}>
              {useBackupCode
                ? 'Enter one of the backup codes you saved when you set up two-factor'
                : 'Enter the 6-digit code from your authenticator app'}
            </Text>
          </View>
        </View>

        <View style={styles.formContainer}>
          <Input
            variant='outline'
            placeholder={useBackupCode ? 'xxxxx-xxxxx' : '000000'}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType={useBackupCode ? 'default' : 'number-pad'}
            autoCapitalize='none'
            autoCorrect={false}
            autoComplete={useBackupCode ? 'off' : 'one-time-code'}
            textContentType={useBackupCode ? 'none' : 'oneTimeCode'}
            maxLength={useBackupCode ? 24 : 6}
            editable={!loading && !isVerified}
            textAlign='center'
            inputStyle={{
              fontSize: useBackupCode ? 20 : 24,
              letterSpacing: useBackupCode ? 2 : 8,
              color: colors.foreground,
            }}
            error={!!error}
            errorText={error}
            className='mb-6'
          />

          <Button
            variant='default'
            disabled={loading || !isCodeComplete || isVerified}
            onPress={handleVerify}
            className='w-full py-4 rounded-xl'
            textStyle={{ fontWeight: '600', fontSize: 16 }}
          >
            {loading ? (
              <ActivityIndicator size='small' color={colors.primaryForeground} />
            ) : isVerified ? (
              <Ionicons name='checkmark-circle' size={20} color={colors.primaryForeground} />
            ) : (
              'Verify'
            )}
          </Button>

          <Button
            variant='ghost'
            disabled={loading || isVerified}
            onPress={toggleBackupCode}
            className='w-full mt-3'
          >
            {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
          </Button>

          <Button
            variant='outline'
            disabled={loading}
            onPress={onClose}
            className='w-full py-4 rounded-xl mt-3'
            textStyle={{ fontWeight: '600', fontSize: 16 }}
          >
            Cancel
          </Button>
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
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
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

export default TwoFactorLogin;
