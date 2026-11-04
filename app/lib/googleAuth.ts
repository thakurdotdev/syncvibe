import {
  GoogleOneTapSignIn,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from 'react-native-nitro-google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@/constants';

export interface NativeGoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface NativeGoogleSignInResult {
  token: string;
  user: NativeGoogleUser;
}

let configured = false;

const ensureConfigured = () => {
  if (configured) return;
  GoogleOneTapSignIn.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
};

/**
 * Opens Google's account dialog, which lists every account on the device and offers "add account".
 * Returns the ID token and profile, or null if the user dismissed it.
 */
export const performNativeGoogleSignIn = async (): Promise<NativeGoogleSignInResult | null> => {
  ensureConfigured();

  try {
    await GoogleOneTapSignIn.checkPlayServices(true);

    const response = await GoogleOneTapSignIn.presentExplicitSignIn();

    if (isNoSavedCredentialFoundResponse(response)) {
      throw new Error('No Google account was found on this device.');
    }
    if (!isSuccessResponse(response)) return null;

    const { idToken, user } = response.data;

    if (!user.email) {
      throw new Error('Failed to retrieve profile information from Google.');
    }

    return {
      token: idToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.givenName || user.email.split('@')[0],
        picture: user.photo || undefined,
      },
    };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is not available or outdated on this device.');
      }
      if (error.code === statusCodes.DEVELOPER_ERROR) {
        throw new Error("Google sign-in isn't set up for this build of the app.");
      }
    }

    throw error;
  }
};

/**
 * Clears the native Google session and saved credential state.
 */
export const signOutGoogle = async (): Promise<void> => {
  try {
    ensureConfigured();
    await GoogleOneTapSignIn.signOut();
  } catch (error) {
    console.error('Google sign out error:', error);
  }
};
