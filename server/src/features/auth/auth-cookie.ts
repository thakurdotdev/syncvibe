import type { CookieOptions, Request, Response } from 'express';

const SHARED_COOKIE_DOMAIN = process.env.PRODUCTION_DOMAINS || '.thakur.dev';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Keep token creation and removal on exactly the same cookie contract.
 * Derives production vs local from CLIENT_URL — single source of truth.
 *
 * Production: secure + lax + httpOnly + shared domain cookie
 * Local dev:  no-secure + lax + httpOnly + host-only cookie
 */
export const getAuthCookieOptions = (): CookieOptions => {
  if (isProd) {
    return {
      domain: SHARED_COOKIE_DOMAIN,
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    };
  }

  return {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  };
};

export const clearAuthCookie = (_req: Request, res: Response): void => {
  const options = getAuthCookieOptions();
  const { domain, ...hostOnlyOptions } = options;

  // Clear a host-only cookie as well as the shared-domain cookie. This also
  // removes tokens created by older/local builds with different cookie scope.
  res.clearCookie('token', hostOnlyOptions);
  if (domain) {
    res.clearCookie('token', { ...hostOnlyOptions, domain });
  }
};
