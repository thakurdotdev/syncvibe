import type { AxiosInstance } from 'axios';

/** One signed-in device, as described by GET /api/user/sessions. */
export interface DeviceSession {
  id: string;
  kind: 'app' | 'browser' | 'unknown';
  /** e.g. "Samsung SM-M066B", "Chrome on Windows". */
  name: string;
  /** e.g. "SyncVibe 1.6.4 · Android 16", "Windows 10". */
  detail: string | null;
  mobile: boolean;
  ipAddress: string | null;
  /** City, region and country where it signed in, from Cloudflare. */
  location: string | null;
  /** password, password-2fa, backup-code, google, passkey or email-code. Null for older sessions. */
  loginMethod: string | null;
  createdAt: string;
  /** Moves forward at most once a day. */
  lastActiveAt: string;
  isCurrent: boolean;
}

const messageOf = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const run = async <T>(request: Promise<{ data: T }>, fallback: string) => {
  try {
    return (await request).data;
  } catch (error) {
    throw new Error(messageOf(error, fallback));
  }
};

export const listSessions = async (api: AxiosInstance) =>
  (
    await run(
      api.get<{ sessions: DeviceSession[] }>('/api/user/sessions'),
      'Couldn’t load your signed-in devices'
    )
  ).sessions;

export const revokeSession = (api: AxiosInstance, id: string) =>
  run(api.delete(`/api/user/sessions/${encodeURIComponent(id)}`), 'Couldn’t sign out that device');

export const revokeOtherSessions = (api: AxiosInstance) =>
  run(
    api.delete<{ revoked: number }>('/api/user/sessions'),
    'Couldn’t sign out your other devices'
  );

const LOGIN_METHODS: Record<string, string> = {
  password: 'Password',
  'password-2fa': 'Password + 2FA',
  'backup-code': 'Backup code',
  google: 'Google',
  passkey: 'Passkey',
  'email-code': 'Email code',
};

/** e.g. "Passkey". Null for sessions from before the method was recorded. */
export const loginMethodLabel = (session: DeviceSession) =>
  (session.loginMethod && LOGIN_METHODS[session.loginMethod]) || null;

export const sessionIcon = (session: DeviceSession) =>
  session.kind === 'unknown' ? 'help-circle' : session.mobile ? 'smartphone' : 'monitor';

const DAY = 24 * 60 * 60 * 1000;

/** Day-level wording, since the server only records activity about once a day. */
export const formatLastActive = (value: string) => {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / DAY);
  if (days <= 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  if (days < 7) return `Active ${days} days ago`;
  return `Active ${new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

export const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
