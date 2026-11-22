import { useUser } from '@/context/UserContext';
import { markOnboardingComplete } from '@/lib/onboarding';
import { type Href, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

/** Where signed-out people sign in. Signing in there opens the app. */
const AUTH_ROUTES = new Set(['onboarding', 'sign-in']);
/** Open without an account. `/` (no segment) decides where to go by itself. */
const PUBLIC_ROUTES = new Set([...AUTH_ROUTES, 'oauthredirect']);

/**
 * The app needs an account. Every other screen sends a signed-out person to `/` (onboarding or
 * sign-in), including after logging out or when the session ends on the server, and a sign-in
 * from either auth screen lands on Home. The screens themselves never navigate after signing in.
 */
export function useAuthGate() {
  const { user, loading } = useUser();
  const router = useRouter();
  const first = (useSegments() as string[])[0];

  useEffect(() => {
    if (loading || first === undefined) return;
    const leaveTo = (href: Href) => {
      if (router.canDismiss()) router.dismissAll();
      router.replace(href);
    };
    if (user && AUTH_ROUTES.has(first)) {
      void markOnboardingComplete();
      leaveTo('/(tabs)/home');
    } else if (!user && !PUBLIC_ROUTES.has(first)) {
      leaveTo('/');
    }
  }, [user, loading, first, router]);
}
