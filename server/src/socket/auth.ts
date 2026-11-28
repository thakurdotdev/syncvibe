import type { Socket } from 'socket.io';
import { auth } from '@/features/auth/auth';
import { clientUrl } from '@/features/auth/auth.config';
import { describeDevice } from '@/features/auth/sessions';

export interface SocketIdentity {
  userId: number;
  sessionId: string;
  /** The account's name and picture: how rooms show this person. */
  name: string;
  picture: string | null;
  /** How this device is named to your other devices, the same as on the Security page. */
  device: { name: string; mobile: boolean };
}

/** Every socket of one sign-in, so signing a device out can also cut its live connection. */
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

const BROWSER_ORIGINS = [/^https:\/\/([a-z0-9-]+\.)*thakur\.dev$/, /^http:\/\/localhost:5173$/];

const isOurOrigin = (origin: string) =>
  origin === clientUrl || BROWSER_ORIGINS.some((pattern) => pattern.test(origin));

/**
 * Works out who a connecting socket is from its Better Auth session, the same one the HTTP API
 * uses. Browsers send the session cookie with the handshake; the app has no cookie jar, so it
 * passes the cookie in the handshake's `auth`.
 *
 * Returns null when there is no valid session, and such a connection is refused. Throws when the
 * session couldn't be checked.
 */
export const identifySocket = async (socket: Socket): Promise<SocketIdentity | null> => {
  const { headers, auth: handshakeAuth } = socket.handshake;
  const fromApp = typeof handshakeAuth?.cookie === 'string' ? handshakeAuth.cookie : null;

  // A page on another site can open a WebSocket here and the browser would attach our cookie.
  // CORS doesn't cover WebSockets, so the origin is checked by hand.
  if (!fromApp && headers.origin && !isOurOrigin(headers.origin)) return null;

  const cookie = fromApp ?? headers.cookie;
  if (!cookie) return null;

  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!session || session.user.isDeleted) return null;

  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId)) return null;
  // The app names itself in its session's User-Agent; its socket's is the HTTP library's.
  const { name, mobile } = describeDevice(session.session.userAgent ?? headers['user-agent']);
  return {
    userId,
    sessionId: String(session.session.id),
    name: session.user.name,
    picture: session.user.image ?? null,
    device: { name, mobile },
  };
};
