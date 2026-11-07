import { useUser } from '@/context/UserContext';
import { authClient, unwrap } from '@/lib/auth-client';
import { performNativeGoogleSignIn } from '@/lib/googleAuth';

export const googleLoginErrorMessage = (err: any): string =>
  err?.response?.data?.message || err?.message || 'Google sign-in failed. Please try again.';

/**
 * Returns a function that runs the whole Google login: the native dialog, signing in to
 * Better Auth with the Google ID token, and loading the profile. It resolves false if the user
 * dismissed the dialog, and throws on failure (use googleLoginErrorMessage for the text to show).
 */
export const useGoogleLogin = () => {
  const { getProfile } = useUser();

  return async (): Promise<boolean> => {
    const authResult = await performNativeGoogleSignIn();
    if (!authResult) return false;

    // The Expo auth client stores the session cookie from this response.
    await unwrap(
      authClient.signIn.social({ provider: 'google', idToken: { token: authResult.token } })
    );

    // getProfile reports its own errors, so a slow or failed profile load doesn't fail sign-in.
    await getProfile();
    return true;
  };
};
