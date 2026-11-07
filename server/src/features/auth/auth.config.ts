const isProduction = process.env.NODE_ENV === 'production';

const APP_SCHEMES = ['syncvibe', 'syncvibe-preview', 'syncvibe-dev'] as const;

export const clientUrl = process.env.CLIENT_URL;

export const trustedOrigins = [
  clientUrl,
  'https://*.thakur.dev',
  ...APP_SCHEMES.map((scheme) => `${scheme}://`),
  ...(isProduction ? [] : ['http://localhost:5173']),
];

export const sessionConfig = {
  expiresIn: 60 * 60 * 24 * 30,
  updateAge: 60 * 60 * 24,
} as const;

// The web app and the API live on different thakur.dev subdomains and share the session cookie.
export const crossSubDomainCookies = isProduction
  ? { enabled: true, domain: process.env.AUTH_COOKIE_DOMAIN || '.thakur.dev' }
  : { enabled: false };

// Passkeys are bound to the web app's host, so existing credentials keep working.
export const passkeyConfig = {
  rpID: new URL(clientUrl).hostname,
  rpName: 'SyncVibe',
  origin: new URL(clientUrl).origin,
};

export const googleClientIds = [
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_MOBILE_CLIENT_ID,
].filter((id): id is string => Boolean(id));

const FIFTEEN_MINUTES = 15 * 60;

export const authRateLimits = {
  '/sign-in/email': { window: FIFTEEN_MINUTES, max: 30 },
  '/sign-up/email': { window: FIFTEEN_MINUTES, max: 30 },
  '/request-password-reset': { window: FIFTEEN_MINUTES, max: 3 },
  '/reset-password': { window: FIFTEEN_MINUTES, max: 5 },
  '/email-otp/send-verification-otp': { window: FIFTEEN_MINUTES, max: 5 },
};

export const PASSWORD_HASH_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 6;
export const RESET_PASSWORD_EXPIRY_SECONDS = 60 * 60;
export const EMAIL_OTP_EXPIRY_SECONDS = 60 * 60;
