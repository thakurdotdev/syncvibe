import { Passkeys, type PasskeyErrorCode } from '@/modules/passkeys';
import { authClient, unwrap } from '@/lib/auth-client';

/**
 * Passkeys on Android. The Better Auth passkey client relies on the browser's WebAuthn API, so
 * this runs the same ceremonies against the same /api/auth/passkey endpoints through Android's
 * Credential Manager (modules/passkeys). Passkeys made here and on the web app are interchangeable.
 * There is no iOS app yet; on iOS `isPasskeySupported` is false and the UI hides passkeys.
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

export const isPasskeySupported = (): boolean => {
  try {
    return Passkeys?.isSupported() ?? false;
  } catch {
    return false;
  }
};

const MESSAGES: Partial<Record<PasskeyErrorCode, string>> = {
  ERR_PASSKEY_ALREADY_REGISTERED: 'This device already has a passkey for your account.',
  ERR_PASSKEY_NO_CREDENTIALS: 'No SyncVibe passkey on this device.',
  ERR_PASSKEY_NOT_CONFIGURED:
    'No passkey provider is set up. Turn on Google Password Manager under Settings › Passwords & accounts.',
  ERR_PASSKEY_NOT_SUPPORTED: 'Passkeys are not supported on this device.',
  ERR_PASSKEY_SECURITY:
    'This device couldn’t verify SyncVibe for passkeys. Check your connection and try again.',
};

/** Runs a native ceremony and turns its error codes into messages people can act on. */
const runCeremony = async (ceremony: (native: NonNullable<typeof Passkeys>) => Promise<string>) => {
  if (!Passkeys || !isPasskeySupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }
  let json: string;
  try {
    json = await ceremony(Passkeys);
  } catch (error) {
    const { code, message } = (error ?? {}) as { code?: string; message?: string };
    if (code === 'ERR_PASSKEY_CANCELLED') throw new PasskeyCancelledError();
    console.warn('Passkey ceremony failed:', error);
    throw new Error(
      MESSAGES[code as PasskeyErrorCode] ?? `Passkey failed: ${message || code || 'unknown error'}`
    );
  }
  // The server verifies the credential itself; extension results aren't part of it.
  const { clientExtensionResults: _ignored, ...response } = JSON.parse(json) as Record<
    string,
    unknown
  >;
  return response;
};

type WebAuthnOptions = Record<string, unknown>;

/** Signs in with a passkey. The Expo client stores the session cookie from the response. */
export const signInWithPasskey = async () => {
  const options = await unwrap(
    authClient.$fetch<WebAuthnOptions>('/passkey/generate-authenticate-options', {
      method: 'GET',
      throw: false,
    })
  );
  const response = await runCeremony((native) => native.get(JSON.stringify(options)));
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
    authClient.$fetch<WebAuthnOptions>('/passkey/generate-register-options', {
      method: 'GET',
      query: { name },
      throw: false,
    })
  );
  // `hints` is newer than Android's WebAuthn parser, and the server only ever sends an empty list.
  const { hints: _hints, ...request } = options;
  const response = await runCeremony((native) => native.create(JSON.stringify(request)));
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
