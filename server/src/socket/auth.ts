import type { Socket } from 'socket.io';
import { auth } from '@/features/auth/auth';
import { clientUrl } from '@/features/auth/auth.config';

export interface SocketIdentity {
  userId: number;
  sessionId: string;
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
 * Returns null when there is no valid session. Such a socket can still use music rooms the old
 * way (apps up to 1.6.x connect like that), but nothing that reads or writes messages.
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
  return { userId, sessionId: String(session.session.id) };
};
