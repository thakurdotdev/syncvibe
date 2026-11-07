import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { User } from '@/models/index';

/** How a session signed in, by the Better Auth route that created it. Stored on the session. */
const LOGIN_METHOD_BY_PATH: Record<string, string> = {
  '/sign-in/email': 'password',
  '/sign-in/social': 'google',
  '/callback/:id': 'google',
  '/passkey/verify-authentication': 'passkey',
  '/two-factor/verify-totp': 'password-2fa',
  '/two-factor/verify-backup-code': 'backup-code',
  '/email-otp/verify-email': 'email-code',
};

export const loginMethodForPath = (path: string | undefined): string | null =>
  (path && LOGIN_METHOD_BY_PATH[path]) || null;

/**
 * Updates users.lastLogin on successful sign-ins. Registered after the two-factor plugin, so a
 * sign-in that still waits for its second factor has no session yet and is not counted.
 */
export const loginActivity = () =>
  ({
    id: 'login-activity',
    hooks: {
      after: [
        {
          matcher: (ctx) => Boolean(ctx.path && ctx.path in LOGIN_METHOD_BY_PATH),
          handler: createAuthMiddleware(async (ctx) => {
            const newSession = ctx.context.newSession;
            if (!newSession) return;
            await User.update(
              { lastLogin: new Date() },
              { where: { userid: Number(newSession.user.id) } }
            ).catch((error) => console.error('Failed to record last login:', error));
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
