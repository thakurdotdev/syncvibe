import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { googleLoginErrorMessage, useGoogleLogin } from '@/hooks/useGoogleLogin';
import { LANGUAGES } from '@/lib/languages';
import { typography } from '@/theme/typography';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const RING_MS = 2700;
const RING_COUNT = 3;
const LOGO_SIZE = 96;

const Ring = memo(function Ring({ index, active }: { index: number; active: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    progress.value = 0;
    progress.value = withDelay(
      (index * RING_MS) / RING_COUNT,
      withRepeat(withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.quad) }), -1)
    );
    return () => cancelAnimation(progress);
  }, [active, index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.9 }],
  }));

  return <Animated.View style={[styles.ring, { borderColor: colors.foreground }, style]} />;
});

const summarise = (selected: Set<string>) => {
  const names = LANGUAGES.filter(({ id }) => selected.has(id)).map(({ label }) => label);
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
};

interface SignInStepProps {
  active: boolean;
  languages: Set<string>;
  onSkip: () => void;
}

/**
 * Last step. Onboarding finishes on its own once a user exists, so a successful login here, or on
 * the email screen, needs no navigation of its own.
 */
export function SignInStep({ active, languages, onSkip }: SignInStepProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const signInWithGoogle = useGoogleLogin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(googleLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoStage}>
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <Ring key={index} index={index} active={active} />
          ))}
          <Image
            source={require('../../assets/syncvibe.png')}
            style={styles.logo}
            resizeMode='contain'
            accessibilityIgnoresInvertColors
          />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Keep your vibe with you</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in to save playlists and history, and to listen with friends in rooms.
        </Text>
        <View style={[styles.tuned, { backgroundColor: colors.raised }]}>
          <Text style={[styles.tunedText, { color: colors.foreground }]}>
            Tuned to {summarise(languages)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {error ? (
          <Text
            accessibilityLiveRegion='polite'
            style={[styles.error, { color: colors.destructive }]}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={handleGoogle}
          disabled={loading}
          accessibilityRole='button'
          accessibilityLabel='Continue with Google'
          accessibilityState={{ disabled: loading, busy: loading }}
          android_ripple={{ color: colors.raised }}
          style={[
            styles.google,
            { backgroundColor: colors.card, borderColor: colors.border },
            loading && styles.disabled,
          ]}
        >
          {loading ? (
            <ActivityIndicator size='small' color={colors.foreground} />
          ) : (
            <>
              <Image source={require('../../assets/images/google.png')} style={styles.googleIcon} />
              <Text style={[styles.googleText, { color: colors.foreground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>

        <Button
          variant='outline'
          size='lg'
          disabled={loading}
          onPress={() => router.push('/login')}
          style={styles.fullWidth}
        >
          Continue with email
        </Button>
        <Button
          variant='ghost'
          size='default'
          disabled={loading}
          onPress={onSkip}
          style={styles.fullWidth}
        >
          Skip for now
        </Button>

        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          By continuing, you agree to our{' '}
          <Text
            accessibilityRole='link'
            style={[styles.legalLink, { color: colors.foreground }]}
            onPress={() =>
              WebBrowser.openBrowserAsync('https://syncvibe.thakur.dev/terms-of-services')
            }
          >
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text
            accessibilityRole='link'
            style={[styles.legalLink, { color: colors.foreground }]}
            onPress={() =>
              WebBrowser.openBrowserAsync('https://syncvibe.thakur.dev/privacy-policy')
            }
          >
            Privacy Policy
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
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
    marginBottom: 44,
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
  error: {
    ...typography.bodySm,
    textAlign: 'center',
  },
  google: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullWidth: {
    width: '100%',
  },
  legal: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 4,
  },
  legalLink: {
    fontWeight: '600',
  },
});
