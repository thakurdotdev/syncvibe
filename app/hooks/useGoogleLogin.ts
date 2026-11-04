import { API_URL } from '@/constants';
import { useUser } from '@/context/UserContext';
import { performNativeGoogleSignIn } from '@/lib/googleAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const googleLoginErrorMessage = (err: any): string =>
  err?.response?.data?.message || err?.message || 'Google sign-in failed. Please try again.';

/**
 * Returns a function that runs the whole Google login: the native dialog, the exchange for a
 * SyncVibe token, and saving the session. It resolves false if the user dismissed the dialog,
 * and throws on failure (use googleLoginErrorMessage for the text to show).
 */
export const useGoogleLogin = () => {
  const { getProfile, setUser } = useUser();

  return async (): Promise<boolean> => {
    const authResult = await performNativeGoogleSignIn();
    if (!authResult) return false;

    const { data } = await axios.post(`${API_URL}/api/auth/google/mobile`, {
      token: authResult.token,
      user: authResult.user,
    });

    await AsyncStorage.multiSet([
      ['token', data.token],
      ['@user_profile', JSON.stringify(data.user)],
    ]);
    setUser(data.user);

    // Keep the profile synced in the background without blocking navigation.
    getProfile().catch(console.error);
    return true;
  };
};
