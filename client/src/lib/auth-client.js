import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/client';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_URL}/api/auth`,
  fetchOptions: { credentials: 'include' },
  plugins: [twoFactorClient(), emailOTPClient(), passkeyClient()],
});

export class AuthError extends Error {
  constructor({ message, code, status }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Better Auth calls resolve to `{ data, error }`. This returns the data, or throws the error so
 * callers can use try/catch like the rest of the app.
 */
export const unwrap = async (request) => {
  const { data, error } = await request;
  if (error) throw new AuthError(error);
  return data;
};

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.message || fallback;

// Passkey prompts the user dismissed are not errors worth showing.
export const isPasskeyCancelled = (error) =>
  ['AUTH_CANCELLED', 'ERROR_CEREMONY_ABORTED', 'REGISTRATION_CANCELLED'].includes(error?.code);

/** Accepts only same-site paths, so `returnTo` cannot send users to another site. */
export const getSafeReturnPath = (value, fallback = '/home') =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;

export const signInWithGoogle = (returnPath) =>
  unwrap(
    authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}${returnPath}`,
      errorCallbackURL: `${window.location.origin}/login`,
    })
  );
