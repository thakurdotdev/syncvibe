import { HeaderIconButton } from '@/components/ui/AppHeader';
import { useTheme } from '@/context/ThemeContext';
import { typography } from '@/theme/typography';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

export const WEB_URL = 'https://syncvibe.thakur.dev';

/** Back button, title and one line under it, at the top of every email step. */
export function FormHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <HeaderIconButton icon='chevron-back' label='Back' onPress={onBack} />
      <Text accessibilityRole='header' style={[styles.title, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** Full-width sign-in option: Google, passkey, email. */
export function ProviderButton({
  icon,
  label,
  loading,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole='button'
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      android_ripple={{ color: colors.raised }}
      style={[
        styles.provider,
        { backgroundColor: colors.card, borderColor: colors.border },
        off && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size='small' color={colors.foreground} />
      ) : (
        <>
          <View style={styles.providerIcon}>{icon}</View>
          <Text style={[styles.providerText, { color: colors.foreground }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** "New here? Create an account" style line under a form. */
export function SwitchLink({
  prompt,
  action,
  onPress,
  disabled,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchText, { color: colors.mutedForeground }]}>{prompt} </Text>
      <Pressable onPress={onPress} disabled={disabled} hitSlop={10} accessibilityRole='button'>
        <Text style={[styles.switchAction, { color: colors.foreground }]}>{action}</Text>
      </Pressable>
    </View>
  );
}

export function FormError({ message }: { message: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion='polite' style={[styles.error, { color: colors.destructive }]}>
      {message}
    </Text>
  );
}

const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);
export const openForgotPassword = () => openWeb('/forgot-password');

export function LegalNote() {
  const { colors } = useTheme();
  return (
    <Text style={[styles.legal, { color: colors.mutedForeground }]}>
      By continuing, you agree to our{' '}
      <Text
        accessibilityRole='link'
        style={[styles.legalLink, { color: colors.foreground }]}
        onPress={() => openWeb('/terms-of-services')}
      >
        Terms of Service
      </Text>{' '}
      and{' '}
      <Text
        accessibilityRole='link'
        style={[styles.legalLink, { color: colors.foreground }]}
        onPress={() => openWeb('/privacy-policy')}
      >
        Privacy Policy
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    ...typography.displayMd,
    marginTop: 20,
  },
  subtitle: {
    ...typography.bodyMd,
    marginTop: 6,
  },
  provider: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  providerIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerText: {
    ...typography.labelLg,
    fontSize: 16,
  },
  dimmed: {
    opacity: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 8,
  },
  switchText: {
    ...typography.bodyMd,
  },
  switchAction: {
    ...typography.labelLg,
    fontSize: 14,
  },
  error: {
    ...typography.bodySm,
    textAlign: 'center',
  },
  legal: {
    ...typography.caption,
    textAlign: 'center',
  },
  legalLink: {
    fontWeight: '600',
  },
});
