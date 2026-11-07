import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasStoredSession, LEGACY_TOKEN_KEY } from '@/lib/auth-client';
import { LANGUAGE_STORAGE_KEY } from '@/lib/languages';

export const ONBOARDING_STORAGE_KEY = '@onboarding_complete';

export const markOnboardingComplete = () => AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1');

/**
 * Onboarding is for new installs. A session or a saved language means this person was already
 * using the app before onboarding existed, so they skip it too.
 */
export const shouldShowOnboarding = async (): Promise<boolean> => {
  const [stored, signedIn] = await Promise.all([
    AsyncStorage.multiGet([ONBOARDING_STORAGE_KEY, LEGACY_TOKEN_KEY, LANGUAGE_STORAGE_KEY]),
    hasStoredSession(),
  ]);
  return !signedIn && stored.every(([, value]) => !value);
};
