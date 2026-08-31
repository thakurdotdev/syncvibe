import type { CookieOptions, Request, Response } from 'express';

const SHARED_COOKIE_DOMAIN = '.thakur.dev';

const isLocalHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

/**
 * Keep token creation and removal on exactly the same cookie contract.
 * A domain cookie is only valid for our shared production domain; local
 * development must use a host-only cookie because browsers reject a
 * `.thakur.dev` cookie from localhost.
 */
export const getAuthCookieOptions = (req: Request): CookieOptions => {
  const hostname = req.hostname?.toLowerCase() || '';
  const isProductionDomain = hostname === 'thakur.dev' || hostname.endsWith('.thakur.dev');
  const secure = process.env.NODE_ENV === 'production' || req.secure;

  return {
    ...(isProductionDomain && !isLocalHostname(hostname) ? { domain: SHARED_COOKIE_DOMAIN } : {}),
    secure,
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  };
};

export const clearAuthCookie = (req: Request, res: Response): void => {
  const options = getAuthCookieOptions(req);
  const { domain, ...hostOnlyOptions } = options;

  // Clear a host-only cookie as well as the shared-domain cookie. This also
  // removes tokens created by older/local builds with different cookie scope.
  res.clearCookie('token', hostOnlyOptions);
  if (domain) {
    res.clearCookie('token', { ...hostOnlyOptions, domain });
  }
};
