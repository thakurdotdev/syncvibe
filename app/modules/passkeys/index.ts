import { requireOptionalNativeModule } from 'expo';

export type PasskeyErrorCode =
  | 'ERR_PASSKEY_CANCELLED'
  | 'ERR_PASSKEY_ALREADY_REGISTERED'
  | 'ERR_PASSKEY_NO_CREDENTIALS'
  | 'ERR_PASSKEY_NOT_CONFIGURED'
  | 'ERR_PASSKEY_NOT_SUPPORTED'
  | 'ERR_PASSKEY_NOT_ALLOWED'
  | 'ERR_PASSKEY_SECURITY'
  | 'ERR_PASSKEY_INVALID_REQUEST'
  | 'ERR_PASSKEY_DOM'
  | 'ERR_PASSKEY_UNKNOWN';

interface PasskeysNative {
  isSupported(): boolean;
  /** WebAuthn creation options JSON in, registration response JSON out. */
  create(requestJson: string): Promise<string>;
  /** WebAuthn request options JSON in, authentication response JSON out. */
  get(requestJson: string): Promise<string>;
}

/** Android only. Null on iOS, and on app builds made before this module existed. */
export const Passkeys = requireOptionalNativeModule<PasskeysNative>('SyncVibePasskeys');
