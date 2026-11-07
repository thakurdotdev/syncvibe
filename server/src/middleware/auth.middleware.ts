import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, type AuthSession } from '@/features/auth/auth';

const toRequestUser = (user: AuthSession['user']): Express.User => ({
  userid: Number(user.id),
  name: user.name,
  username: user.username ?? '',
  email: user.email,
  profilepic: user.image ?? null,
  bio: user.bio ?? null,
  verified: user.emailVerified,
});

/**
 * Resolves the Better Auth session for the request. Any refreshed session cookie is passed on
 * to the response so that active sessions keep sliding forward.
 */
const resolveUser = async (req: Request, res: Response): Promise<Express.User | null> => {
  const { headers, response } = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    returnHeaders: true,
  });

  const cookies = headers.getSetCookie();
  if (cookies.length > 0) res.append('Set-Cookie', cookies);

  if (!response || response.user.isDeleted) return null;
  return toRequestUser(response.user);
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await resolveUser(req, res);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error resolving session:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    req.user = (await resolveUser(req, res)) ?? undefined;
  } catch (error) {
    console.error('Error resolving session:', error);
  }
  next();
};

export default authMiddleware;
