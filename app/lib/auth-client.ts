import { expoClient } from '@better-auth/expo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '@/constants';

const clean = (value: string | null | undefined) => (value ?? '').replace(/[;()]/g, ' ').trim();
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Better Auth stores the User-Agent of the request that creates a session. Without this, app
 * sessions show up as "okhttp" on the Security page; the server parses this format instead.
 */
const userAgent = () => {
  const os = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${clean(Device.osVersion)}`.trim();
  const device =
    [capitalize(clean(Device.manufacturer)), clean(Device.modelName)].filter(Boolean).join(' ') ||
    'Phone';
  return `SyncVibe/${Constants.expoConfig?.version ?? '0'} (${os}; ${device})`;
};

// The scheme comes from the app config, so dev, preview and production builds each use their own.
export const authClient = createAuthClient({
  baseURL: `${API_URL}/api/auth`,
  fetchOptions: { headers: { 'User-Agent': userAgent() } },
  plugins: [expoClient({ storagePrefix: 'syncvibe', storage: SecureStore }), twoFactorClient()],
});

/** Session cookie header for calls to the SyncVibe API outside /api/auth. */
export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const cookie = await authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
};

export const hasStoredSession = async (): Promise<boolean> => Boolean(await authClient.getCookie());

// Before Better Auth, the app kept a JWT under this key. The server no longer accepts it.
export const LEGACY_TOKEN_KEY = 'token';

export const hasLegacyToken = async (): Promise<boolean> =>
  Boolean(await AsyncStorage.getItem(LEGACY_TOKEN_KEY));

export const removeLegacyToken = () => AsyncStorage.removeItem(LEGACY_TOKEN_KEY);

/** Better Auth calls resolve to `{ data, error }`. This returns the data or throws the error. */
export const unwrap = async <T>(
  request: Promise<{ data: T | null; error: { message?: string; status?: number } | null }>
): Promise<T> => {
  const { data, error } = await request;
  if (error) {
    throw Object.assign(new Error(error.message || 'Something went wrong. Please try again.'), {
      status: error.status,
    });
  }
  return data as T;
};
