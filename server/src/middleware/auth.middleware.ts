import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@/models/index';
import type { UserAttributes } from '@/models/auth/user.model';

interface JwtPayload {
  email: string;
  role?: string;
}

interface CacheEntry {
  user: UserAttributes;
  expiresAt: number;
}

const userCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Clean up expired cache entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
      if (now > value.expiresAt) {
        userCache.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.token as string | undefined;

    const authHeader = req.headers.authorization;
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Missing token' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    const cacheKey = decoded.email;
    const now = Date.now();

    const cached = userCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      req.user = { ...cached.user, role: decoded.role ?? 'user' };
      next();
      return;
    }

    const existingUser = await User.findOne({
      where: { email: decoded.email },
      raw: true,
    });

    if (!existingUser) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    const userData = existingUser as unknown as UserAttributes;

    userCache.set(cacheKey, {
      user: userData,
      expiresAt: now + CACHE_TTL,
    });

    req.user = { ...userData, role: decoded.role ?? 'user' };
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Unauthorized: Error verifying token' });
  }
};

export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.token as string | undefined;
    const authHeader = req.headers.authorization;
    if (!token && authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
      const cacheKey = decoded.email;
      const now = Date.now();

      const cached = userCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        req.user = { ...cached.user, role: decoded.role ?? 'user' };
      } else {
        const existingUser = await User.findOne({
          where: { email: decoded.email },
          raw: true,
        });
        if (existingUser) {
          const userData = existingUser as unknown as UserAttributes;
          userCache.set(cacheKey, {
            user: userData,
            expiresAt: now + CACHE_TTL,
          });
          req.user = { ...userData, role: decoded.role ?? 'user' };
        }
      }
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }
  next();
};

export default authMiddleware;
