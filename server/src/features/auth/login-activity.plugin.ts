import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { LoginLog, User } from '@/models/index';
import { getClientIp, getClientLocation, parseUserAgent } from '@/utils/helpers';

const LOGIN_TYPE_BY_PATH: Record<string, string> = {
  '/sign-in/email': 'Using Password',
  '/sign-in/social': 'Google Mobile',
  '/callback/:id': 'Google OAuth',
  '/passkey/verify-authentication': 'Using Passkey',
  '/two-factor/verify-totp': 'Using Password',
  '/two-factor/verify-backup-code': 'Using Backup Code',
  '/email-otp/verify-email': 'Email Verification',
};

const TWO_FACTOR_PATHS = new Set(['/two-factor/verify-totp', '/two-factor/verify-backup-code']);
// Set by the two-factor plugin between the password step and the code step of a sign-in.
const TWO_FACTOR_SIGN_IN_COOKIE = 'two_factor';

const recordLogin = async (userId: number, loginType: string, headers: Headers): Promise<void> => {
  const source = { headers: Object.fromEntries(headers.entries()) };
  const [browser, os] = parseUserAgent(source);

  await Promise.all([
    User.update({ lastLogin: new Date() }, { where: { userid: userId } }),
    process.env.NODE_ENV === 'production'
      ? LoginLog.create({
          userid: userId,
          loginType,
          ipaddress: getClientIp(source),
          location: getClientLocation(source),
          browser: browser || 'Unknown',
          os: os || 'Unknown',
        })
      : null,
  ]);
};

/**
 * Records successful sign-ins. Registered after the two-factor plugin, so a sign-in that still
 * waits for its second factor has no session yet and is not counted.
 */
export const loginActivity = () =>
  ({
    id: 'login-activity',
    hooks: {
      after: [
        {
          matcher: (ctx) => Boolean(ctx.path && ctx.path in LOGIN_TYPE_BY_PATH),
          handler: createAuthMiddleware(async (ctx) => {
            const newSession = ctx.context.newSession;
            if (!newSession || !ctx.headers) return;

            // Verifying a code also happens while turning 2FA on, which is not a sign-in.
            if (TWO_FACTOR_PATHS.has(ctx.path)) {
              const cookieName = ctx.context.createAuthCookie(TWO_FACTOR_SIGN_IN_COOKIE).name;
              if (!ctx.getCookie(cookieName)) return;
            }

            const loginType = LOGIN_TYPE_BY_PATH[ctx.path]!;
            await recordLogin(Number(newSession.user.id), loginType, ctx.headers).catch((error) =>
              console.error('Failed to record login activity:', error)
            );
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
