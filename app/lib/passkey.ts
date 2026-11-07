import type * as PasskeysModule from 'react-native-passkeys';
import { authClient, unwrap } from '@/lib/auth-client';

/**
 * Passkeys on iOS and Android. The Better Auth passkey client relies on the browser's WebAuthn
 * API, so this runs the same ceremonies against the same /api/auth/passkey endpoints through the
 * OS credential manager instead. Passkeys made here and on the web app are interchangeable.
 */

export interface Passkey {
  id: string;
  name?: string | null;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  createdAt: string;
}

/** Thrown when the user dismisses the system passkey prompt. Callers should stay quiet. */
export class PasskeyCancelledError extends Error {
  constructor() {
    super('Passkey request was cancelled');
    this.name = 'PasskeyCancelledError';
  }
}

// Loaded lazily: an app binary built before this native module was added would otherwise crash
// on import instead of just hiding passkeys.
let nativeModule: typeof PasskeysModule | null | undefined;
const getNative = (): typeof PasskeysModule | null => {
  if (nativeModule === undefined) {
    try {
      nativeModule = require('react-native-passkeys') as typeof PasskeysModule;
    } catch {
      nativeModule = null;
    }
  }
  return nativeModule;
};

export const isPasskeySupported = (): boolean => {
  try {
    return getNative()?.isSupported() ?? false;
  } catch {
    return false;
  }
};

const isCancellation = (error: unknown) => {
  const { code, name, message } = (error ?? {}) as {
    code?: string;
    name?: string;
    message?: string;
  };
  return /cancel/i.test(`${code ?? ''} ${name ?? ''} ${message ?? ''}`);
};

/** Runs a native ceremony, mapping a dismissed prompt to PasskeyCancelledError. */
const runCeremony = async <T>(ceremony: (native: typeof PasskeysModule) => Promise<T | null>) => {
  const native = getNative();
  if (!native || !native.isSupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }
  try {
    const result = await ceremony(native);
    if (!result) throw new PasskeyCancelledError();
    return result;
  } catch (error) {
    if (error instanceof PasskeyCancelledError || isCancellation(error)) {
      throw new PasskeyCancelledError();
    }
    throw error;
  }
};

type CreationOptions = Parameters<typeof PasskeysModule.create>[0];
type RequestOptions = Parameters<typeof PasskeysModule.get>[0];

/** Signs in with a passkey. The Expo client stores the session cookie from the response. */
export const signInWithPasskey = async () => {
  const options = await unwrap(
    authClient.$fetch<RequestOptions>('/passkey/generate-authenticate-options', {
      method: 'GET',
      throw: false,
    })
  );
  const credential = await runCeremony((native) => native.get(options));
  // The server verifies the assertion itself; extension results aren't part of it.
  const { clientExtensionResults: _ignored, ...response } = credential;
  return unwrap(
    authClient.$fetch('/passkey/verify-authentication', {
      method: 'POST',
      body: { response },
      throw: false,
    })
  );
};

/** Registers a new passkey for the signed-in user. */
export const addPasskey = async (name: string) => {
  const options = await unwrap(
    authClient.$fetch<CreationOptions>('/passkey/generate-register-options', {
      method: 'GET',
      query: { name },
      throw: false,
    })
  );
  const credential = await runCeremony((native) => native.create(options));
  const { clientExtensionResults: _ignored, ...response } = credential;
  return unwrap(
    authClient.$fetch('/passkey/verify-registration', {
      method: 'POST',
      body: { response, name },
      throw: false,
    })
  );
};

export const listPasskeys = () =>
  unwrap(
    authClient.$fetch<Passkey[]>('/passkey/list-user-passkeys', { method: 'GET', throw: false })
  );

export const renamePasskey = (id: string, name: string) =>
  unwrap(
    authClient.$fetch('/passkey/update-passkey', {
      method: 'POST',
      body: { id, name },
      throw: false,
    })
  );

export const deletePasskey = (id: string) =>
  unwrap(
    authClient.$fetch('/passkey/delete-passkey', { method: 'POST', body: { id }, throw: false })
  );
