import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@/models/index';
import type { UserAttributes } from '@/models/auth/user.model';
import { cache } from '@/utils/redis';

interface JwtPayload {
  email: string;
  role?: string;
}

const USER_SESSION_TTL_SECONDS = 10 * 60; // 10 minutes

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
    const cacheKey = `user:session:${decoded.email}`;

    const cachedUser = await cache.get<UserAttributes>(cacheKey);
    if (cachedUser) {
      req.user = { ...cachedUser, role: decoded.role ?? 'user' };
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
    await cache.set(cacheKey, userData, USER_SESSION_TTL_SECONDS);

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
      const cacheKey = `user:session:${decoded.email}`;

      const cachedUser = await cache.get<UserAttributes>(cacheKey);
      if (cachedUser) {
        req.user = { ...cachedUser, role: decoded.role ?? 'user' };
      } else {
        const existingUser = await User.findOne({
          where: { email: decoded.email },
          raw: true,
        });
        if (existingUser) {
          const userData = existingUser as unknown as UserAttributes;
          await cache.set(cacheKey, userData, USER_SESSION_TTL_SECONDS);
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
