import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
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

/**
 * Native errors read "Call to function 'ReactNativePasskeys.create' has been rejected.
 * → Caused by: <reason>". Only the reason is useful, and some reasons need a hint.
 */
const describeNativeError = (error: unknown): Error => {
  const raw = error instanceof Error ? error.message : String(error);
  const reason =
    raw
      .split(/Caused by:\s*/)
      .pop()
      ?.trim() || raw;
  if (/SecurityError|cannot be validated|RP ID/i.test(reason)) {
    return new Error(
      'This device couldn’t verify SyncVibe for passkeys yet. Check your connection and try again in a few minutes.'
    );
  }
  if (/NotConfigured/i.test(reason)) {
    return new Error(
      'No passkey provider is set up. Turn on Google Password Manager under Settings › Passwords & accounts.'
    );
  }
  if (/NoCredentials/i.test(reason)) return new Error('No SyncVibe passkey on this device.');
  if (/InvalidStateError|previously registered/i.test(reason)) {
    return new Error('This device already has a passkey for your account.');
  }
  return new Error(`Passkey failed: ${reason}`);
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
    console.warn('Passkey ceremony failed:', error);
    throw describeNativeError(error);
  }
};

type CreationOptions = Parameters<typeof PasskeysModule.create>[0];
type RequestOptions = Parameters<typeof PasskeysModule.get>[0];
type Registration = NonNullable<Awaited<ReturnType<typeof PasskeysModule.create>>>;
type Assertion = NonNullable<Awaited<ReturnType<typeof PasskeysModule.get>>>;

/**
 * Android: hand Credential Manager the server's WebAuthn JSON as-is and parse its JSON reply
 * (createJson/getJson come from patches/react-native-passkeys@0.4.2.patch). The library's own
 * path rebuilds the request from Kotlin objects with Gson, which breaks in minified builds.
 */
interface AndroidPasskeys {
  createJson(request: string): Promise<string | null>;
  getJson(request: string): Promise<string | null>;
}
const androidNative =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<AndroidPasskeys>('ReactNativePasskeys')
    : null;

const createCredential = async (
  native: typeof PasskeysModule,
  options: CreationOptions
): Promise<Registration | null> => {
  if (!androidNative?.createJson) return native.create(options);
  const json = await androidNative.createJson(JSON.stringify(options));
  return json ? (JSON.parse(json) as Registration) : null;
};

const getCredential = async (
  native: typeof PasskeysModule,
  options: RequestOptions
): Promise<Assertion | null> => {
  if (!androidNative?.getJson) return native.get(options);
  const json = await androidNative.getJson(JSON.stringify(options));
  return json ? (JSON.parse(json) as Assertion) : null;
};

/** Signs in with a passkey. The Expo client stores the session cookie from the response. */
export const signInWithPasskey = async () => {
  const options = await unwrap(
    authClient.$fetch<RequestOptions>('/passkey/generate-authenticate-options', {
      method: 'GET',
      throw: false,
    })
  );
  const credential = await runCeremony((native) => getCredential(native, options));
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
  const credential = await runCeremony((native) => createCredential(native, options));
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
