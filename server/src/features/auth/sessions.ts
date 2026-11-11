import type { Request, Response } from 'express';
import { UAParser } from 'ua-parser-js';
import { disconnectSession } from '@/utils/socket-emitter';
import { auth } from './auth';

/**
 * Signed-in devices for the Security page. Better Auth's own /list-sessions only answers for
 * sessions under a day old (its "fresh session" rule) and returns every session's token, which is
 * that device's credential. These routes return descriptions keyed by session id instead, and
 * look the token up on the server when a session is revoked.
 */

type SessionKind = 'app' | 'browser' | 'unknown';

interface DeviceSession {
  id: string;
  kind: SessionKind;
  /** e.g. "Galaxy M06", "Chrome on Windows". */
  name: string;
  /** e.g. "SyncVibe 1.6.4 · Android 16", "Android 16". */
  detail: string | null;
  mobile: boolean;
  ipAddress: string | null;
  /** City, region and country from Cloudflare when this session signed in. */
  location: string | null;
  /** password, password-2fa, backup-code, google, passkey or email-code. Null for older sessions. */
  loginMethod: string | null;
  createdAt: string;
  /** Moves forward at most once a day, when Better Auth extends the session. */
  lastActiveAt: string;
  isCurrent: boolean;
}

// Sent by the app's auth client: "SyncVibe/<version> (<OS> <version>; <device>)".
const APP_AGENT = /^SyncVibe\/(\S+) \(([^;)]+);\s*([^)]+)\)/;
// App sessions from before the app sent its own User-Agent carry the HTTP library's.
const OLD_APP_AGENT = /okhttp|Dalvik|CFNetwork|Expo/i;

export const describeDevice = (userAgent: string | null | undefined) => {
  if (!userAgent)
    return { kind: 'unknown' as const, name: 'Unknown device', detail: null, mobile: false };

  const app = APP_AGENT.exec(userAgent);
  if (app) {
    return {
      kind: 'app' as const,
      name: app[3]!.trim(),
      detail: `SyncVibe ${app[1]} · ${app[2]}`,
      mobile: true,
    };
  }
  if (OLD_APP_AGENT.test(userAgent)) {
    return { kind: 'app' as const, name: 'SyncVibe app', detail: null, mobile: true };
  }

  const { browser, os, device } = new UAParser(userAgent).getResult();
  const osName = [os.name, os.version].filter(Boolean).join(' ') || null;
  return {
    kind: 'browser' as const,
    name: [browser.name || 'Browser', os.name && `on ${os.name}`].filter(Boolean).join(' '),
    detail: osName,
    mobile: device.type === 'mobile' || device.type === 'tablet',
  };
};

const firstIp = (ip: string | null | undefined) => ip?.split(',')[0]?.trim() || null;

const userSessions = async (req: Request) => {
  const ctx = await auth.$context;
  const now = Date.now();
  const sessions = await ctx.internalAdapter.listSessions(String(req.user!.userid));
  return sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
};

export const listDeviceSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions: DeviceSession[] = (await userSessions(req)).map((session) => ({
      id: String(session.id),
      ...describeDevice(session.userAgent),
      ipAddress: firstIp(session.ipAddress),
      location: (session as { location?: string | null }).location ?? null,
      loginMethod: (session as { loginMethod?: string | null }).loginMethod ?? null,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActiveAt: new Date(session.updatedAt).toISOString(),
      isCurrent: String(session.id) === req.sessionId,
    }));
    sessions.sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) || b.lastActiveAt.localeCompare(a.lastActiveAt)
    );
    res.status(200).json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ message: 'Failed to load your signed-in devices' });
  }
};

/** Signs out one other device. The current one signs out through the normal log-out flow. */
export const revokeDeviceSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    if (id === req.sessionId) {
      res.status(400).json({ message: 'Use Log out to sign out of this device' });
      return;
    }

    const session = (await userSessions(req)).find((s) => String(s.id) === id);
    if (!session) {
      res.status(404).json({ message: 'That device is already signed out' });
      return;
    }

    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteSession(session.token);
    disconnectSession(String(session.id));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ message: 'Failed to sign out that device' });
  }
};

/** Signs out every device except the one making the request. */
export const revokeOtherDeviceSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const ctx = await auth.$context;
    const others = (await userSessions(req)).filter((s) => String(s.id) !== req.sessionId);
    await Promise.all(others.map((s) => ctx.internalAdapter.deleteSession(s.token)));
    others.forEach((s) => disconnectSession(String(s.id)));
    res.status(200).json({ success: true, revoked: others.length });
  } catch (error) {
    console.error('Error revoking other sessions:', error);
    res.status(500).json({ message: 'Failed to sign out your other devices' });
  }
};
