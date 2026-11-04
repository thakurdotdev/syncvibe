import { shouldShowOnboarding } from '@/lib/onboarding';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

export default function Index() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    shouldShowOnboarding()
      .then(setShowOnboarding)
      .catch((error) => {
        // Never block the app on a storage failure.
        console.error('Failed to read onboarding state:', error);
        setShowOnboarding(false);
      });
  }, []);

  if (showOnboarding === null) return null;

  return <Redirect href={showOnboarding ? '/onboarding' : '/(tabs)/home'} />;
}
