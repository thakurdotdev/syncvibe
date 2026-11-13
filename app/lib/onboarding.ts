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

const checkSafely = () =>
  shouldShowOnboarding().catch((error) => {
    // Never block the app on a storage failure.
    console.error('Failed to read onboarding state:', error);
    return false;
  });

let startupCheck: Promise<boolean> | null = null;
let startupCheckTaken = false;

/** The check made at launch. The root layout keeps the splash screen up until it settles. */
export const onboardingCheckAtLaunch = () => (startupCheck ??= checkSafely());

/**
 * For the `/` route. The first visit reuses the launch check; later ones check again, because
 * finishing onboarding or signing in changes the answer.
 */
export const takeOnboardingDecision = (): Promise<boolean> => {
  if (startupCheckTaken) return checkSafely();
  startupCheckTaken = true;
  return onboardingCheckAtLaunch();
};
