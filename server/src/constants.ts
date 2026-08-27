export const UserLoginType = {
  GOOGLE: 'GOOGLE',
  EMAIL_PASSWORD: 'EMAIL_PASSWORD',
  PASSKEY_LOGIN: 'PASSKEY_LOGIN',
} as const;

export type UserLoginType = (typeof UserLoginType)[keyof typeof UserLoginType];

export const COOKIE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const getCookieExpiryDate = (): Date => new Date(Date.now() + COOKIE_EXPIRY_MS);

export const CookieExpiryDate = new Date(Date.now() + COOKIE_EXPIRY_MS);

export const JWT_EXPIRY = '30d' as const;
export const JWTExpiryDate = '30d' as const;
