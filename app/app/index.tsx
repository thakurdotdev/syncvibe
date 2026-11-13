import { takeOnboardingDecision } from '@/lib/onboarding';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

export default function Index() {
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

  if (showOnboarding === null) return null;

  return <Redirect href={showOnboarding ? '/onboarding' : '/(tabs)/home'} />;
}
