import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin"
import { GOOGLE_WEB_CLIENT_ID } from "@/constants"

export interface NativeGoogleUser {
  id: string
  email: string
  name: string
  picture?: string
}

export interface NativeGoogleSignInResult {
  token?: string
  user: NativeGoogleUser
}

/**
 * Configure native Google Sign-In with Web Client ID
 */
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  })
}

/**
 * Executes the native Google Sign-In prompt.
 * Returns the authenticated user payload and idToken, or null if the user cancelled.
 */
export const performNativeGoogleSignIn = async (): Promise<NativeGoogleSignInResult | null> => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })

    // Clear any existing native Google session to guarantee the account picker dialog opens every time
    try {
      await GoogleSignin.signOut()
    } catch {
      // Ignore if no session was active
    }

    const response = await GoogleSignin.signIn()

    // Handle v13+ response structure (response.data) as well as legacy structure
    const data = response.data || (response as any)
    const googleUser = data?.user
    const idToken = data?.idToken

    if (!googleUser || !googleUser.email) {
      throw new Error("Failed to retrieve profile information from Google.")
    }

    return {
      token: idToken,
      user: {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name || googleUser.givenName || googleUser.email.split("@")[0],
        picture: googleUser.photo || undefined,
      },
    }
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // User dismissed / cancelled the bottom-sheet
      return null
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      // Sign-in operation already in progress
      return null
    }
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Google Play Services is not available or outdated on this device.")
    }

    throw error
  }
}

/**
 * Signs the user out of the native Google session
 */
export const signOutGoogle = async (): Promise<void> => {
  try {
    await GoogleSignin.signOut()
  } catch (error) {
    console.error("Google sign out error:", error)
  }
}
