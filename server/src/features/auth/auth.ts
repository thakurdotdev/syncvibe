import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { emailOTP, twoFactor } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { User } from '@/models/index';
import { getClientLocation } from '@/utils/helpers';
import { passwordResetMailSender, resendOtp, verifiedMailSender } from '@/utils/resend';
import {
  clientUrl,
  crossSubDomainCookies,
  EMAIL_OTP_EXPIRY_SECONDS,
  googleClientIds,
  MIN_PASSWORD_LENGTH,
  passkeyConfig,
  RESET_PASSWORD_EXPIRY_SECONDS,
  authRateLimits,
  sessionConfig,
  trustedOrigins,
} from './auth.config';
import { authDatabase } from './database';
import { loginActivity } from './login-activity.plugin';
import { createRedisRateLimitStorage } from './rate-limit-storage';
import { hashPassword, verifyPassword } from './password';
import { signUpPolicy } from './sign-up-policy';
import { generateUniqueUsername } from './username';

// A user created in the same sign-up transaction is not visible to Sequelize yet, and is active.
const assertAccountIsActive = async (userId: string | number): Promise<void> => {
  const user = await User.findByPk(userId, { attributes: ['isDeleted'] });
  if (user?.isDeleted) {
    throw new APIError('FORBIDDEN', { message: 'This account has been deleted or banned' });
  }
};

export const auth = betterAuth({
  appName: 'SyncVibe',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authDatabase,
  trustedOrigins,

  user: {
    modelName: 'users',
    // users.id is a generated copy of users.userid, added by sql/003_better_auth.sql.
    fields: {
      emailVerified: 'verified',
      image: 'profilepic',
    },
    additionalFields: {
      username: { type: 'string', required: false, input: false },
      bio: { type: 'string', required: false, input: false },
      isDeleted: { type: 'boolean', required: false, input: false, defaultValue: false },
    },
  },
  session: {
    modelName: 'sessions',
    ...sessionConfig,
    // Column added by sql/004_session_location.sql.
    additionalFields: { location: { type: 'string', required: false, input: false } },
  },
  account: {
    modelName: 'accounts',
    accountLinking: { enabled: true, trustedProviders: ['google'] },
  },
  verification: { modelName: 'verifications' },

  emailAndPassword: {
    enabled: true,
    // New users sign in by verifying the code emailed to them.
    autoSignIn: false,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    password: { hash: hashPassword, verify: verifyPassword },
    resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRY_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await passwordResetMailSender(user.email, resetUrl);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user) => {
      const username = (user as { username?: string }).username ?? user.name;
      await verifiedMailSender(user.email, username).catch((error) =>
        console.error('Failed to send welcome email:', error)
      );
    },
  },

  socialProviders: {
    google: {
      clientId: googleClientIds,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  hooks: { before: signUpPolicy },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, username: await generateUniqueUsername(user.name || user.email) },
        }),
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          await assertAccountIsActive(session.userId);
          // Cloudflare's city/region/country headers on the sign-in request.
          const headers = ctx?.headers ? Object.fromEntries(ctx.headers.entries()) : null;
          const location = headers ? getClientLocation({ headers }) : 'Unknown';
          return { data: { ...session, location: location === 'Unknown' ? null : location } };
        },
      },
    },
  },

  plugins: [
    expo(),
    emailOTP({
      otpLength: 6,
      expiresIn: EMAIL_OTP_EXPIRY_SECONDS,
      storeOTP: 'hashed',
      overrideDefaultEmailVerification: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === 'email-verification') await resendOtp(email, otp);
      },
    }),
    twoFactor({
      issuer: 'SyncVibe',
      allowPasswordless: true,
      schema: { twoFactor: { modelName: 'two_factors' } },
    }),
    passkey({
      ...passkeyConfig,
      schema: { passkey: { modelName: 'passkeys' } },
    }),
    loginActivity(),
  ],

  // Email OTP is used only to verify addresses. Its sign-in, reset and email-change flows stay off.
  disabledPaths: [
    '/sign-in/email-otp',
    '/email-otp/request-password-reset',
    '/forget-password/email-otp',
    '/email-otp/reset-password',
    '/email-otp/request-email-change',
    '/email-otp/change-email',
  ],

  rateLimit: { customRules: authRateLimits, customStorage: createRedisRateLimitStorage() },

  advanced: {
    database: { generateId: 'serial' },
    crossSubDomainCookies,
    ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
