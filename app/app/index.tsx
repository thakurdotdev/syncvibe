import { useUser } from '@/context/UserContext';
import { takeOnboardingDecision } from '@/lib/onboarding';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

/** Signed in: the app. Signed out: onboarding on a new install, otherwise sign-in. */
export default function Index() {
  const { user, loading } = useUser();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    // At launch this is the check the splash screen already waits for, so nothing blank shows.
    void takeOnboardingDecision().then((show) => {
      if (active) setShowOnboarding(show);
    });
    return () => {
      active = false;
    };
  }, []);

  if (user) return <Redirect href='/(tabs)/home' />;
  if (loading || showOnboarding === null) return null;

  return <Redirect href={showOnboarding ? '/onboarding' : '/sign-in'} />;
}
