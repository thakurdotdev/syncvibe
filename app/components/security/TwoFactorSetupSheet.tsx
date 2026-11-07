import SwipeableModal from '@/components/SwipeableModal';
import PressableScale from '@/components/ui/PressableScale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { authClient, unwrap } from '@/lib/auth-client';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SheetLayout } from './SheetLayout';

type Step = 'password' | 'setup' | 'codes';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const secretFromUri = (totpURI: string) => /[?&]secret=([^&]+)/i.exec(totpURI)?.[1] ?? '';
const groupKey = (secret: string) => secret.match(/.{1,4}/g)?.join(' ') ?? secret;

/**
 * Turns on authenticator-app 2FA: confirm the password (if the account has one), add the key to
 * an authenticator, prove it with a code, then save the backup codes. Nothing changes on the
 * account until the code is verified, so closing early is safe. Give it a new `key` for each
 * opening so it starts over.
 */
export default function TwoFactorSetupSheet({
  isVisible,
  hasPassword,
  onClose,
  onEnabled,
}: {
  isVisible: boolean;
  hasPassword: boolean;
  onClose: () => void;
  onEnabled: () => void;
}) {
  const { colors } = useTheme();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpURI, setTotpURI] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  // Accounts without a password go straight to fetching the key, so they start out loading.
  const [loading, setLoading] = useState(!hasPassword);
  const [error, setError] = useState('');

  const secret = secretFromUri(totpURI);

  const requestKey = async (withPassword?: string) => {
    try {
      const result = await unwrap(
        authClient.twoFactor.enable({
          method: 'totp',
          ...(withPassword ? { password: withPassword } : {}),
        })
      );
      if (result.method !== 'totp') throw new Error('Could not start setup. Please try again.');
      setTotpURI(result.totpURI);
      setBackupCodes(result.backupCodes);
      setStep('setup');
    } catch (err: any) {
      setError(err.message || 'Could not start setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const start = (withPassword?: string) => {
    setLoading(true);
    setError('');
    void requestKey(withPassword);
  };

  // The parent remounts this sheet for each opening, so this asks for one key per setup.
  const requested = useRef(false);
  useEffect(() => {
    if (!isVisible || hasPassword || requested.current) return;
    requested.current = true;
    void requestKey();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, hasPassword]);

  const verify = async () => {
    setLoading(true);
    setError('');
    try {
      await unwrap(authClient.twoFactor.verifyTotp({ code }));
      setStep('codes');
    } catch (err: any) {
      setError(err.message || 'That code didn’t work. Check the time on your phone and try again.');
    } finally {
      setLoading(false);
    }
  };

  const openAuthenticator = async () => {
    try {
      await Linking.openURL(totpURI);
    } catch {
      toast('No authenticator app found. Enter the setup key instead.', { type: 'info' });
    }
  };

  const copy = async (value: string, message: string) => {
    await Clipboard.setStringAsync(value);
    toast(message, { type: 'success' });
  };

  const finish = () => {
    onEnabled();
    onClose();
  };

  return (
    <SwipeableModal
      isVisible={isVisible}
      onClose={step === 'codes' ? finish : onClose}
      maxHeight='92%'
      scrollable
      useScrollView
    >
      {step === 'password' && (
        <SheetLayout
          icon='shield'
          title='Turn on two-factor'
          description={
            hasPassword
              ? 'Confirm your password to add an authenticator app to your account.'
              : 'Preparing your setup key…'
          }
        >
          {hasPassword ? (
            <>
              <Input
                variant='filled'
                placeholder='Password'
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize='none'
                autoComplete='current-password'
                textContentType='password'
                leftIcon={<Feather name='lock' size={18} color={colors.mutedForeground} />}
                error={!!error}
                errorText={error}
                onSubmitEditing={() => password && start(password)}
                returnKeyType='go'
              />
              <Button
                size='lg'
                isLoading={loading}
                disabled={!password}
                onPress={() => start(password)}
              >
                Continue
              </Button>
            </>
          ) : error ? (
            <>
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
              <Button size='lg' variant='secondary' onPress={() => start()}>
                Try again
              </Button>
            </>
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          )}
        </SheetLayout>
      )}

      {step === 'setup' && (
        <SheetLayout
          icon='smartphone'
          title='Add to your authenticator'
          description='Use Google Authenticator, 1Password, Authy or any app that supports one-time codes.'
        >
          <Button
            size='lg'
            variant='secondary'
            onPress={openAuthenticator}
            icon={<Feather name='external-link' size={17} color={colors.secondaryForeground} />}
          >
            Open authenticator app
          </Button>

          <View style={[styles.keyBox, { backgroundColor: colors.raised }]}>
            <View style={styles.keyText}>
              <Text style={[styles.caption, { color: colors.mutedForeground }]}>
                Or enter this setup key
              </Text>
              <Text style={[styles.key, { color: colors.foreground }]} selectable>
                {groupKey(secret)}
              </Text>
            </View>
            <PressableScale
              onPress={() => copy(secret, 'Setup key copied')}
              accessibilityRole='button'
              accessibilityLabel='Copy setup key'
              hitSlop={8}
              style={styles.copy}
            >
              <Feather name='copy' size={18} color={colors.primary} />
            </PressableScale>
          </View>

          <Text style={[styles.caption, styles.codeLabel, { color: colors.mutedForeground }]}>
            Then enter the 6-digit code it shows
          </Text>
          <Input
            variant='filled'
            placeholder='000000'
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
            keyboardType='number-pad'
            autoComplete='one-time-code'
            textContentType='oneTimeCode'
            maxLength={6}
            textAlign='center'
            inputStyle={styles.codeInput}
            error={!!error}
            errorText={error}
          />
          <Button size='lg' isLoading={loading} disabled={code.length !== 6} onPress={verify}>
            Verify and turn on
          </Button>
        </SheetLayout>
      )}

      {step === 'codes' && (
        <SheetLayout
          icon='check-circle'
          title='Save your backup codes'
          description='Two-factor is on. If you lose your phone, each of these codes signs you in once. Keep them somewhere safe.'
        >
          <View style={[styles.codes, { backgroundColor: colors.raised }]}>
            {backupCodes.map((backupCode) => (
              <Text key={backupCode} style={[styles.backupCode, { color: colors.foreground }]}>
                {backupCode}
              </Text>
            ))}
          </View>
          <Button
            size='lg'
            variant='secondary'
            onPress={() => copy(backupCodes.join('\n'), 'Backup codes copied')}
            icon={<Feather name='copy' size={17} color={colors.secondaryForeground} />}
          >
            Copy codes
          </Button>
          <Button size='lg' onPress={finish}>
            I’ve saved them
          </Button>
        </SheetLayout>
      )}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  spinner: { paddingVertical: 24 },
  error: { fontSize: 14, fontWeight: '500' },
  keyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
  },
  keyText: { flex: 1, gap: 4 },
  caption: { fontSize: 13, fontWeight: '500' },
  key: { fontFamily: MONO, fontSize: 15, letterSpacing: 0.5 },
  copy: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  codeLabel: { marginTop: 8 },
  codeInput: { fontSize: 22, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  codes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backupCode: {
    width: '50%',
    textAlign: 'center',
    paddingVertical: 7,
    fontFamily: MONO,
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
