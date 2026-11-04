import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_STORAGE_KEY } from '@/lib/languages';

export const ONBOARDING_STORAGE_KEY = '@onboarding_complete';

export const markOnboardingComplete = () => AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1');

/**
 * Onboarding is for new installs. A session or a saved language means this person was already
 * using the app before onboarding existed, so they skip it too.
 */
export const shouldShowOnboarding = async (): Promise<boolean> => {
  const stored = await AsyncStorage.multiGet([
    ONBOARDING_STORAGE_KEY,
    'token',
    LANGUAGE_STORAGE_KEY,
  ]);
  return stored.every(([, value]) => !value);
};
